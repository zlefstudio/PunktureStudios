// Cloud sync service — offline-first.
//
// The local IndexedDB (Dexie) is always the source of truth while working.
// When online AND signed in, this module:
//   · pushes local tickets/items that changed (newer updatedAt) → Firestore
//   · pulls remote changes into the local DB (last-write-wins by updatedAt)
//   · republishes a sanitized "publicQueue" mirror (ticket # + status ONLY —
//     never names) for the public live-queue page to read.
//
// v1 assumption: one active cashier device writes to the cloud (single writer).

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
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
let online = typeof navigator === 'undefined' ? true : navigator.onLine;
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    online = true;
    scheduleSync(0);
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
}

async function readRemoteRows(col: string): Promise<Map<string, CloudRow>> {
  const snap = await getDocs(collection(firestore, col));
  const map = new Map<string, CloudRow>();
  snap.forEach((d) => {
    const data = d.data() as Partial<CloudRow>;
    map.set(d.id, data as CloudRow);
  });
  return map;
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
  if (rows.length === 0) return;
  // Firestore supports batches of up to 500 writes — chunk defensively.
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    await Promise.all(
      chunk.map((r) => setDoc(doc(firestore, col, r.id), sanitizeForFirestore(r)))
    );
  }
}

/** Push local tickets/items that are missing remotely or newer than remote. */
async function pushLocalChanges(): Promise<void> {
  const [localTickets, localItems] = await Promise.all([
    db.tickets.toArray(),
    db.items.toArray(),
  ]);
  const remoteTickets = await readRemoteRows(TICKETS);
  const remoteItems = await readRemoteRows(ITEMS);

  const newerThan = (row: CloudRow, remote: Map<string, CloudRow>): boolean => {
    const ex = remote.get(row.id);
    if (!ex) return true;
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
    const applied: string[] = [];
    for (const id of deletions.keys()) {
      if (remoteItems.has(id)) {
        await deleteDoc(doc(firestore, ITEMS, id));
      }
      applied.push(id);
    }
    await clearItemDeletions(applied);
  }
}

/** Pull remote rows that are missing locally or newer than the local copy. */
async function pullRemoteChanges(): Promise<void> {
  const remoteTickets = await readRemoteRows(TICKETS);
  const remoteItems = await readRemoteRows(ITEMS);
  if (remoteTickets.size === 0 && remoteItems.size === 0) return;

  const [localTickets, localItems] = await Promise.all([
    db.tickets.toArray(),
    db.items.toArray(),
  ]);
  const localTById = new Map(localTickets.map((t) => [t.id, t]));
  const localIById = new Map(localItems.map((i) => [i.id, i]));

  const incomingTickets: Ticket[] = [];
  const incomingItems: PiercingItem[] = [];
  let maxNumber = 0;
  // Items deleted on THIS device stay deleted until the remote delete is
  // applied (pushLocalChanges) — do not re-import them during a pull.
  const deletions = await listItemDeletions();

  for (const [id, remote] of remoteTickets) {
    const local = localTById.get(id);
    const remoteUpdated = typeof remote.updatedAt === 'number' ? remote.updatedAt : 0;
    if (!local || (typeof local.updatedAt === 'number' ? local.updatedAt : 0) < remoteUpdated) {
      // Cloud rows don't carry the document id as a guaranteed field — make
      // sure the primary key is set before bulkPut.
      const row = { ...(remote as object), id } as unknown as Ticket;
      incomingTickets.push(row);
      if (typeof row.ticketNumber === 'number' && row.ticketNumber > maxNumber) {
        maxNumber = row.ticketNumber;
      }
    }
  }
  for (const [id, remote] of remoteItems) {
    const deletedAt = deletions.get(id);
    const remoteUpdated = typeof remote.updatedAt === 'number' ? remote.updatedAt : 0;
    if (deletedAt !== undefined && deletedAt >= remoteUpdated) continue;
    const local = localIById.get(id);
    if (!local || (typeof local.updatedAt === 'number' ? local.updatedAt : 0) < remoteUpdated) {
      incomingItems.push({ ...(remote as object), id } as unknown as PiercingItem);
    }
  }

  if (incomingTickets.length === 0 && incomingItems.length === 0) return;

  if (incomingTickets.length > 0) await db.tickets.bulkPut(incomingTickets);
  if (incomingItems.length > 0) await db.items.bulkPut(incomingItems);

  // Keep local counter ahead of any pulled ticket numbers.
  const all = await db.tickets.orderBy('ticketNumber').last();
  const highest = Math.max(maxNumber, all?.ticketNumber ?? 0);
  await setTicketCounter(highest);

  await useStore.getState().loadAll();
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
  const current = (await db.settings.get('public')) ?? {
    key: 'public',
    eventActive: false,
    updatedAt: 0,
  };
  const next: PublicSettings = {
    ...current,
    ...patch,
    key: 'public',
    updatedAt: Date.now(),
  };
  await db.settings.put(next);
  requestSyncSoon(500);
  return next;
}

async function pullPublicSettings(): Promise<void> {
  const remote = await readRemoteRows(PUBLIC_COL);
  const row = remote.get('public');
  if (!row) return;
  const remoteTs = typeof row.updatedAt === 'number' ? row.updatedAt : 0;
  const local = await db.settings.get('public');
  const localTs = local && typeof local.updatedAt === 'number' ? local.updatedAt : 0;
  if (remoteTs > localTs) {
    const incoming = row as unknown as PublicSettings;
    if (incoming && incoming.key !== 'public') incoming.key = 'public';
    if (incoming && typeof incoming.updatedAt === 'number') {
      await db.settings.put(incoming);
    }
  }
}

async function pushPublicSettings(): Promise<void> {
  const local = await db.settings.get('public');
  if (!local) return;
  const remote = await readRemoteRows(PUBLIC_COL);
  const row = remote.get('public');
  const remoteTs = row && typeof row.updatedAt === 'number' ? row.updatedAt : 0;
  if (!row || local.updatedAt > remoteTs) {
    await setDoc(doc(firestore, PUBLIC_COL, 'public'), sanitizeForFirestore(local));
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
    upserts.push({ id, ...data } as CloudRow);
  }
  await writeRows(PUBLIC_QUEUE, upserts);

  // Remove public rows that no longer reflect a live ticket.
  const removals: string[] = [];
  for (const id of remote.keys()) {
    if (!desired.has(id)) removals.push(id);
  }
  if (removals.length > 0) {
    await Promise.all(removals.map((id) => deleteDoc(doc(firestore, PUBLIC_QUEUE, id))));
  }
}


// ── Orchestration ──
let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let watcherStarted = false;

export async function syncNow(): Promise<void> {
  if (running) return;
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
    await pullRemoteChanges();
    await pullPublicSettings();
    await pushLocalChanges();
    await pushPublicSettings();
    await publishPublicQueue();
    setStatus({ phase: 'synced', lastSyncAt: Date.now(), message: undefined });
  } catch (e) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
    // eslint-disable-next-line no-console
    console.error('[sync] syncNow failed (code=' + code + '):', e);
    let message = 'Cloud sync failed.';
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

