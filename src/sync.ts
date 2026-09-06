// Cloud sync service — offline-first.
//
// The local IndexedDB (Dexie) is always the source of truth while working.
// When online AND signed in, this module:
//   · pushes local tickets/items that changed (newer updatedAt) → Firestore
//   · pulls remote changes into the local DB (last-write-wins by updatedAt)
//   · republishes a sanitized "publicQueue" mirror (ticket # + status ONLY —
//     never names) for the public live-queue page to read.
//
// Multiple cashier browsers can connect; records merge by updatedAt.

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocsFromServer,
  getDocFromServer,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { firestore, auth } from './firebase';
import { db, setTicketCounter, listItemDeletions, clearItemDeletions } from './db';
import { useStore } from './store';
import { sortWaiting } from './queue';
import { withDataLock } from './dataLock';
import { validateTicket, validateItem, validateSettings } from './validation';
import type { Ticket, PiercingItem, PublicSettings } from './types';

const TICKETS = 'tickets';
const ITEMS = 'items';
const PUBLIC_QUEUE = 'publicQueue';
const PUBLIC_COL = 'public';

export type SyncPhase =
  | 'idle'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'signedout'
  | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  lastSyncAt?: number;
  message?: string;
}

let status: SyncStatus = { phase: 'idle' };
const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  for (const l of listeners) l(status);
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(cb: (s: SyncStatus) => void): () => void {
  listeners.add(cb);
  cb(status);
  return () => {
    listeners.delete(cb);
  };
}

// ── Online state ──
let online = typeof navigator === 'undefined' || !('onLine' in navigator) ? true : navigator.onLine;
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    online = true;
    if (watcherStarted) scheduleSync(0);
  });
  window.addEventListener('offline', () => {
    online = false;
    setStatus({ phase: 'offline', message: 'No internet — data is safe locally.' });
  });
}

export function isOnline(): boolean {
  return online;
}

// ── Auth (staff email/password; session persists ~1 year) ──
export function getSyncUser(): User | null {
  return auth.currentUser;
}

export async function signInToCloud(email: string, password: string): Promise<void> {
  setStatus({ phase: 'connecting', message: 'Connecting to cloud…' });
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    scheduleSync(0);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[sync] signInToCloud failed:', e);
    const msg = friendlyAuthError(e);
    setStatus({ phase: 'error', message: msg });
    throw new Error(msg);
  }
}

export async function signOutCloud(): Promise<void> {
  remoteCache.clear();
  try {
    await signOut(auth);
  } finally {
    setStatus({ phase: 'signedout', message: 'Not connected to cloud.' });
  }
}

function friendlyAuthError(e: unknown): string {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Wrong email or password.';
  }
  if (code.includes('invalid-email')) return 'That email address looks invalid.';
  if (code.includes('too-many-requests')) return 'Too many attempts — try again later.';
  if (code.includes('network')) return 'No internet connection right now.';
  return 'Sign-in failed. Check Authentication → Email/Password is enabled in Firebase.';
}

// ── Remote helpers ──
interface CloudRow {
  id: string;
  updatedAt?: number;
  deleted?: boolean;
}

// Reuse snapshots within a sync cycle; refresh each cycle for other devices.
const remoteCache = new Map<string, { at: number; rows: Map<string, CloudRow> }>();
async function readRemoteRows(col: string): Promise<Map<string, CloudRow>> {
  const cached = remoteCache.get(col);
  if (cached && Date.now() - cached.at < 300000) return cached.rows;
  const rows = new Map<string, CloudRow>();
  if (col === PUBLIC_COL) {
    // Settings rules allow this document, not arbitrary collection queries.
    const snap = await getDocFromServer(doc(firestore, PUBLIC_COL, 'public'));
    if (snap.exists()) rows.set('public', { ...snap.data(), id: 'public' } as CloudRow);
  } else {
    const snap = await getDocsFromServer(collection(firestore, col));
    snap.forEach(d => rows.set(d.id, { ...d.data(), id: d.id } as CloudRow));
  }
  remoteCache.set(col, { at: Date.now(), rows });
  return rows;
}

/**
 * Firestore rejects `undefined` (and NaN) values — e.g. a Ticket whose
 * optional `notes` key is present-but-undefined in IndexedDB. Deep-copy the
 * value dropping every key whose value is undefined/NaN so writes never fail
 * with "invalid-argument / Unsupported field value: undefined".
 */
function sanitizeForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      const clean = sanitizeForFirestore(item);
      if (clean !== undefined) out.push(clean);
    }
    return out as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined || (typeof v === 'number' && Number.isNaN(v))) continue;
      out[k] = sanitizeForFirestore(v);
    }
    return out as T;
  }
  return value;
}

async function writeRows(col: string, rows: CloudRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const batch = writeBatch(firestore);
    for (const row of chunk) batch.set(doc(firestore, col, row.id), sanitizeForFirestore(row));
    await batch.commit();
    for (const row of chunk) remoteCache.get(col)?.rows.set(row.id, sanitizeForFirestore(row));
  }
}

// Restore is an explicit replacement, never a timestamp merge. Retry safely
// after partial failure and retain remote tombstones for missing records.
async function applyPendingRestore(): Promise<boolean> {
  const snapshot = await withDataLock(async () => ({
    pending: await db.meta.get('restorePending'),
    tickets: await db.tickets.toArray(), items: await db.items.toArray(),
    settings: await db.settings.get('public'),
    counter: (await db.meta.get('ticketCounter'))?.value ?? 0,
  }));
  const pending = snapshot.pending;
  if (!pending) return false;
  remoteCache.clear();
  for (const [col, local] of [[TICKETS, snapshot.tickets], [ITEMS, snapshot.items]] as const) {
    const ids = new Set(local.map(row => row.id));
    const remote = await readRemoteRows(col);
    const deleted = [...remote.keys()].filter(id => !ids.has(id)).map(id => ({ id, deleted: true, updatedAt: pending.value }));
    await writeRows(col, [...local, ...deleted]);
  }
  const settings = snapshot.settings ?? { key: 'public', eventActive: false, updatedAt: pending.value };
  await setDoc(doc(firestore, PUBLIC_COL, 'public'), sanitizeForFirestore(settings));
  await setDoc(doc(firestore, 'cloudControl', 'counter'), { value: snapshot.counter });
  await withDataLock(async () => {
    if ((await db.meta.get('restorePending'))?.value === pending.value) {
      // Keep edits made while the network request was running.
      if (!(await db.settings.get('public'))) await db.settings.put(settings);
      await db.meta.delete('restorePending');
    }
  });
  remoteCache.clear();
  return true;
}

/** Push local tickets/items that are missing remotely or newer than remote. */
async function pushLocalChanges(): Promise<void> {
  const [localTickets, localItems] = await withDataLock(() => Promise.all([
    db.tickets.toArray(),
    db.items.toArray(),
  ]));
  const remoteTickets = await readRemoteRows(TICKETS);
  const remoteItems = await readRemoteRows(ITEMS);

  const newerThan = (row: CloudRow, remote: Map<string, CloudRow>): boolean => {
    const ex = remote.get(row.id);
    if (!ex) return true;
    if (ex.deleted) return false;
    return typeof ex.updatedAt === 'number'
      ? (ex.updatedAt as number) < (row.updatedAt ?? 0)
      : true;
  };

  const ticketWrites = localTickets.filter((t) => newerThan(t, remoteTickets));
  const itemWrites = localItems.filter((i) => newerThan(i, remoteItems));

  if (ticketWrites.length > 0) await writeRows(TICKETS, ticketWrites);
  if (itemWrites.length > 0) await writeRows(ITEMS, itemWrites);

  // Apply pending local deletions to the cloud, then forget the tombstones.
  const deletions = await listItemDeletions();
  if (deletions.size > 0) {
    for (const id of deletions.keys()) {
      await writeRows(ITEMS, [{ id, deleted: true, updatedAt: deletions.get(id)! }]);
    }
    await clearItemDeletions(deletions);
  }
}

/** Pull remote rows that are missing locally or newer than the local copy. */
async function pullRemoteChanges(): Promise<void> {
  const remoteTickets = await readRemoteRows(TICKETS);
  const remoteItems = await readRemoteRows(ITEMS);
  if (remoteTickets.size === 0 && remoteItems.size === 0) return;
  await withDataLock(async () => {
    if (await db.meta.get('restorePending')) return;
    const [localTickets, localItems] = await Promise.all([
      db.tickets.toArray(),
      db.items.toArray(),
    ]);
    const localTById = new Map(localTickets.map((t) => [t.id, t]));
    const localIById = new Map(localItems.map((i) => [i.id, i]));

    const incomingTickets: Ticket[] = [];
    const incomingItems: PiercingItem[] = [];
    let maxNumber = 0;
    const deletedTickets: string[] = [];
    const deletedItems: string[] = [];
    // Items deleted on THIS device stay deleted until the remote delete is
    // applied (pushLocalChanges) — do not re-import them during a pull.
    const deletions = await listItemDeletions();

    for (const [id, remote] of remoteTickets) {
      if (remote.deleted) { if (localTById.has(id)) deletedTickets.push(id); continue; }
      const local = localTById.get(id);
      const remoteUpdated = typeof remote.updatedAt === 'number' ? remote.updatedAt : 0;
      if (!local || (typeof local.updatedAt === 'number' ? local.updatedAt : 0) < remoteUpdated) {
        // Cloud rows don't carry the document id as a guaranteed field — make
        // sure the primary key is set before bulkPut.
        const row = validateTicket({ ...remote, id });
        incomingTickets.push(row);
        if (typeof row.archivedAt !== 'number' && row.ticketNumber > maxNumber) {
          maxNumber = row.ticketNumber;
        }
      }
    }
    for (const [id, remote] of remoteItems) {
      if (remote.deleted) { if (localIById.has(id)) deletedItems.push(id); continue; }
      const deletedAt = deletions.get(id);
      const remoteUpdated = typeof remote.updatedAt === 'number' ? remote.updatedAt : 0;
      if (deletedAt !== undefined) continue;
      const local = localIById.get(id);
      if (!local || (typeof local.updatedAt === 'number' ? local.updatedAt : 0) < remoteUpdated) {
        incomingItems.push(validateItem({ ...remote, id }));
      }
    }

    if (incomingTickets.length === 0 && incomingItems.length === 0 && !deletedTickets.length && !deletedItems.length) return;
    await db.transaction('rw', db.tickets, db.items, db.meta, async () => {
      await db.tickets.bulkDelete(deletedTickets);
      await db.items.bulkDelete(deletedItems);
      for (const id of deletedTickets) await db.items.where('ticketId').equals(id).delete();
      await db.tickets.bulkPut(incomingTickets);
      for (const item of incomingItems) {
        if (!(await db.tickets.get(item.ticketId))) throw new Error('Cloud item refers to a missing ticket.');
      }
      await db.items.bulkPut(incomingItems);
      const counter = (await db.meta.get('ticketCounter'))?.value ?? 0;
      await setTicketCounter(Math.max(counter, maxNumber));
    });

    await useStore.getState().loadAll();
  });
}

// ── Public page settings (local-first, mirrored to Firestore `public`) ──

/** Read the local public settings row (works fully offline). */
export async function getLocalPublicSettings(): Promise<PublicSettings | null> {
  return (await db.settings.get('public')) ?? null;
}

/**
 * Save public page settings locally (offline-safe), then ask the cloud sync
 * to push it shortly.
 */
export async function saveLocalPublicSettings(
  patch: Partial<Omit<PublicSettings, 'key' | 'updatedAt'>>
): Promise<PublicSettings> {
  return withDataLock(async () => {
    const current = (await db.settings.get('public')) ?? {
      key: 'public',
      eventActive: false,
      updatedAt: 0,
    };
    const next: PublicSettings = {
      ...current,
      ...patch,
      key: 'public',
      updatedAt: Math.max(Date.now(), current.updatedAt + 1),
    };
    validateSettings(next);
    await db.settings.put(next);
    requestSyncSoon(500);
    return next;
  });
}

async function pullPublicSettings(): Promise<void> {
  const remote = await readRemoteRows(PUBLIC_COL);
  const row = remote.get('public');
  if (!row) return;
  await withDataLock(async () => {
    if (await db.meta.get('restorePending')) return;
    const remoteTs = typeof row.updatedAt === 'number' ? row.updatedAt : 0;
    const local = await db.settings.get('public');
    const localTs = local && typeof local.updatedAt === 'number' ? local.updatedAt : 0;
    if (remoteTs > localTs) {
      const incoming = validateSettings(row);
      if (incoming && incoming.key !== 'public') incoming.key = 'public';
      if (incoming && typeof incoming.updatedAt === 'number') {
        await db.settings.put(incoming);
      }
    }
  });
}

async function pushPublicSettings(): Promise<void> {
  const local = await db.settings.get('public');
  if (!local) return;
  const remote = await readRemoteRows(PUBLIC_COL);
  const row = remote.get('public');
  const remoteTs = row && typeof row.updatedAt === 'number' ? row.updatedAt : 0;
  if (!row || local.updatedAt > remoteTs) {
    await setDoc(doc(firestore, PUBLIC_COL, 'public'), sanitizeForFirestore(local));
    remoteCache.get(PUBLIC_COL)?.rows.set('public', { ...local, id: 'public' });
  }
}


/**
 * Republish the sanitized live queue mirror. Only rows that are currently
 * waiting / called / in_progress are published. Stale rows (finished,
 * cancelled, archived or gone) are removed from the public collection.
 */
async function publishPublicQueue(): Promise<void> {
  const localTickets = await db.tickets.toArray();
  const live = localTickets.filter(
    (t) => (t.status === 'waiting' || t.status === 'called' || t.status === 'in_progress') &&
      typeof t.archivedAt !== 'number'
  );
  const waiting = sortWaiting(localTickets);
  const waitingIndex = new Map(waiting.map((t, i) => [t.id, i]));
  const called = live
    .filter((t) => t.status === 'called')
    .sort((a, b) => (a.calledAt ?? 0) - (b.calledAt ?? 0));
  const active = live
    .filter((t) => t.status === 'in_progress')
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));

  const desired = new Map<string, Record<string, unknown>>();

  for (const t of called) {
    desired.set(t.id, {
      ticketNumber: t.ticketNumber,
      status: t.status,
      position: null,
      seq: 100 + desired.size,
      createdAt: t.createdAt,
      calledAt: t.calledAt ?? null,
      startedAt: null,
      updatedAt: t.updatedAt,
    });
  }
  for (const t of active) {
    desired.set(t.id, {
      ticketNumber: t.ticketNumber,
      status: t.status,
      position: null,
      seq: 200 + desired.size,
      createdAt: t.createdAt,
      calledAt: t.calledAt ?? null,
      startedAt: t.startedAt ?? null,
      updatedAt: t.updatedAt,
    });
  }
  for (const t of live) {
    if (t.status !== 'waiting') continue;
    const position = waitingIndex.get(t.id) ?? 0;
    desired.set(t.id, {
      ticketNumber: t.ticketNumber,
      status: t.status,
      position,
      seq: position,
      createdAt: t.createdAt,
      calledAt: null,
      startedAt: null,
      updatedAt: t.updatedAt,
    });
  }

  const remote = await readRemoteRows(PUBLIC_QUEUE);
  const upserts: CloudRow[] = [];
  for (const [id, data] of desired) {
    const previous = remote.get(id) as unknown as Record<string, unknown> | undefined;
    if (!previous || Object.entries(data).some(([key, value]) => previous[key] !== value)) {
      upserts.push({ id, ...data } as CloudRow);
    }
  }
  await writeRows(PUBLIC_QUEUE, upserts);

  // Remove public rows that no longer reflect a live ticket.
  const removals: string[] = [];
  for (const id of remote.keys()) {
    if (!desired.has(id)) removals.push(id);
  }
  if (removals.length > 0) {
    await Promise.all(removals.map(async (id) => { await deleteDoc(doc(firestore, PUBLIC_QUEUE, id)); remoteCache.get(PUBLIC_QUEUE)?.rows.delete(id); }));
  }
}


// ── Orchestration ──
let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let watcherStarted = false;

export async function syncNow(): Promise<void> {
  if (running) { scheduleSync(2500); return; }
  const user = auth.currentUser;
  if (!user) {
    setStatus({ phase: 'signedout', message: 'Not connected to cloud.' });
    return;
  }
  if (!online) {
    setStatus({ phase: 'offline', message: 'No internet — will sync when back online.' });
    return;
  }
  running = true;
  setStatus({ phase: 'syncing' });
  try {
    remoteCache.clear();
    const restored = await applyPendingRestore();
    if (!restored) { await pullRemoteChanges(); await pullPublicSettings(); }
    if (await db.meta.get('restorePending')) { scheduleSync(0); return; }
    await pushLocalChanges();
    await pushPublicSettings();
    if (await db.meta.get('restorePending')) { scheduleSync(0); return; }
    await publishPublicQueue();
    await setDoc(doc(firestore, 'public', 'heartbeat'), { publishedAt: serverTimestamp() });
    await setDoc(doc(firestore, 'cloudControl', 'counter'), { value: (await db.meta.get('ticketCounter'))?.value ?? 0 });
    setStatus({ phase: 'synced', lastSyncAt: Date.now(), message: undefined });
  } catch (e) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
    // eslint-disable-next-line no-console
    console.error('[sync] syncNow failed (code=' + code + '):', e);
    remoteCache.clear();
    let message = e instanceof Error ? e.message : 'Cloud sync failed.';
    if (code.includes('permission-denied')) {
      message = 'Firestore rules are blocking sync. Publish the rules from firestore.rules.';
    } else if (code.includes('unavailable') || code.includes('network')) {
      message = 'Can’t reach the cloud right now.';
    } else if (code.includes('not-found')) {
      message = 'Firestore database not found. Enable Firestore in the console.';
    }
    setStatus({ phase: 'error', message });
  } finally {
    running = false;
  }
}

function scheduleSync(delayMs = 1500): void {
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void syncNow();
  }, delayMs);
}

/** Ask the cloud sync to run soon (used after local edits like settings). */
export function requestSyncSoon(delayMs = 800): void {
  scheduleSync(delayMs);
}

/**
 * Starts the background watcher once the app has loaded:
 *  · syncs after sign-in / going online
 *  · re-syncs shortly after every local change
 *  · periodic safety sync every 30 s while online & signed in
 */
export function startSyncWatcher(): void {
  if (watcherStarted) return;
  watcherStarted = true;

  onAuthStateChanged(auth, (user) => {
    remoteCache.clear();
    if (user) {
      scheduleSync(300);
    } else {
      setStatus({ phase: 'signedout', message: 'Not connected to cloud.' });
    }
  });

  useStore.subscribe((s, prev) => {
    if (s.tickets !== prev.tickets || s.items !== prev.items) {
      scheduleSync(2500);
    }
  });

  window.setInterval(() => {
    if (auth.currentUser && online) scheduleSync(0);
  }, 30000);
}
