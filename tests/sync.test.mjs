import 'fake-indexeddb/auto';
import { test, mock, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

const remote = new Map();
let failure = null;
let pauseWrite = null;
let writes = [];
let reads = 0;
const subscriptions = new Set();
function emitSnapshots() {
  for (const sub of subscriptions) {
    const path = sub.ref.path;
    const metadata = { fromCache: false, hasPendingWrites: false };
    const docs = [...remote.keys()].filter(key => key.startsWith(path + '/')).map(key => ({ id: key.split('/')[1], data: () => structuredClone(remote.get(key)) }));
    sub.next(path.includes('/') ? { ...snap(path), metadata } : { docs, metadata });
  }
}
const auth = { currentUser: { uid: 'staff-user' } };
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
globalThis.window = { addEventListener() {}, setTimeout: () => 1, clearTimeout() {} };
const ref = (_db, col, id) => ({ path: id ? `${col}/${id}` : col });
const snap = path => ({ exists: () => remote.has(path), data: () => structuredClone(remote.get(path)) });
async function write(path, value) {
  if (pauseWrite) { const wait = pauseWrite; pauseWrite = null; await wait(); }
  if (failure && path.startsWith(failure)) { failure = null; throw new Error('Simulated interrupted write'); }
  remote.set(path, structuredClone(value)); writes.push(path);
  emitSnapshots();
}
await mock.module('../src/firebase.ts', { namedExports: { firestore: {}, auth } });
await mock.module('firebase/auth', { namedExports: {
  signInWithEmailAndPassword: async () => {}, signOut: async () => { auth.currentUser = null; }, onAuthStateChanged: () => () => {},
} });
await mock.module('firebase/firestore', { namedExports: {
  collection: ref, doc: ref,
  onSnapshot: (ref, _options, next, error) => {
    reads++;
    const sub = { ref, next, error };
    subscriptions.add(sub);
    queueMicrotask(emitSnapshots);
    return () => subscriptions.delete(sub);
  },
  getDocFromServer: async r => { reads++; return snap(r.path); },
  getDocsFromServer: async r => {
    reads++;
    return { forEach: fn => { for (const path of remote.keys()) if (path.startsWith(r.path + '/')) fn({ id: path.split('/')[1], data: () => structuredClone(remote.get(path)) }); } };
  },
  setDoc: (r, value) => write(r.path, value),
  deleteDoc: async r => { remote.delete(r.path); emitSnapshots(); },
  serverTimestamp: () => ({ seconds: Math.floor(Date.now() / 1000) }),
  runTransaction: async (_db, fn) => fn({ get: async r => snap(r.path), set: (r, value) => { remote.set(r.path, value); } }),
  writeBatch: () => {
    const operations = [];
    return { set: (r, value) => operations.push([r.path, value]), commit: async () => { for (const [path, value] of operations) await write(path, value); } };
  },
} });
const { db } = await import('../src/db.ts');
const { useStore } = await import('../src/store.ts');
const { syncNow, getSyncStatus, signOutCloud } = await import('../src/sync.ts');
const { createRemoteRows } = await import('../src/remoteRows.ts');
const store = () => useStore.getState();
beforeEach(async () => {
  await signOutCloud();
  remote.clear(); storage.clear();
  storage.set('punkture_station_id', 'test-station');
  remote.set('cloudControl/station', { installation: 'different' });
  auth.currentUser = { uid: 'staff-user' };
  remote.clear(); writes = []; reads = 0; failure = null; pauseWrite = null;
  await db.transaction('rw', db.tickets, db.items, db.meta, db.settings, async () => {
    await Promise.all([db.tickets.clear(), db.items.clear(), db.meta.clear(), db.settings.clear()]);
  });
  await store().loadAll();
});
after(() => db.close());

test('cached and pending snapshots cannot authorize a merge; confirmed data unblocks and reset rejects waiters', async () => {
  const rows = createRemoteRows(() => {});
  try {
    await rows.read('tickets');
    const sub = [...subscriptions].find(s => s.ref.path === 'tickets');
    sub.next({ docs: [], metadata: { fromCache: true, hasPendingWrites: false } });
    let finished = false;
    const pending = rows.read('tickets').then(value => { finished = true; return value; });
    await Promise.resolve(); assert.equal(finished, false);
    sub.next({ docs: [], metadata: { fromCache: false, hasPendingWrites: true } });
    await Promise.resolve(); assert.equal(finished, false);
    emitSnapshots();
    assert.equal((await pending).size, 0);
    sub.next({ docs: [], metadata: { fromCache: true, hasPendingWrites: false } });
    const rejected = assert.rejects(rows.read('tickets'), /session changed/);
    rows.reset(); await rejected;
    assert.equal(subscriptions.size, 0);
  } finally { rows.reset(); }
});
async function ticketWithItem() {
  const t = await store().addTicket('Customer');
  await store().addItem({ ticketId: t.id, placementName: 'Lobe', basePrice: 250, upgradeLabel: 'Free', upgradePrice: 0, quantity: 1 });
  return t;
}
test('remote tombstone prevents stale local item resurrection', async () => {
  await ticketWithItem(); await syncNow();
  const item = structuredClone(store().items[0]);
  await store().deleteItem(item.id); await syncNow();
  assert.equal(remote.get(`items/${item.id}`).deleted, true);
  await db.items.put(item); await store().loadAll(); await syncNow();
  assert.equal(await db.items.get(item.id), undefined);
  assert.equal(remote.get(`items/${item.id}`).deleted, true);
});
test('restore replaces newer cloud data and tombstones absent records', async () => {
  const t = await ticketWithItem(); const backup = await store().exportBackup();
  await syncNow();
  const extra = await store().addTicket('Extra'); await syncNow();
  remote.get(`tickets/${t.id}`).name = 'Cloud name';
  remote.get(`tickets/${t.id}`).updatedAt = Date.now() + 999999;
  await store().importBackup(backup); await syncNow();
  assert.equal(remote.get(`tickets/${t.id}`).name, 'Customer');
  assert.equal(remote.get(`tickets/${extra.id}`).deleted, true);
  assert.equal(await db.meta.get('restorePending'), undefined);
  assert.equal(store().tickets.length, 1);
});
test('interrupted restore retains intent and retries without re-importing deleted rows', async () => {
  await ticketWithItem(); const backup = await store().exportBackup(); await syncNow();
  await store().addTicket('Extra'); await syncNow();
  await store().importBackup(backup); failure = 'items/';
  const log = mock.method(console, 'error', () => {});
  await syncNow(); log.mock.restore();
  assert.equal(getSyncStatus().phase, 'error');
  assert.ok(await db.meta.get('restorePending'));
  await syncNow();
  assert.equal(getSyncStatus().phase, 'synced');
  assert.equal(await db.meta.get('restorePending'), undefined);
  assert.equal(store().tickets.length, 1);
});
test('another browser can sync despite a legacy station claim', async () => {
  remote.set('cloudControl/station', { installation: 'other-browser' });
  await ticketWithItem();
  const log = mock.method(console, 'error', () => {});
  await syncNow(); log.mock.restore();
  assert.equal(getSyncStatus().phase, 'synced'); assert.ok(reads > 0); assert.ok(writes.some(path => path.startsWith('tickets/')));
});
test('idle sync reuses server listeners without redundant queue, counter or heartbeat writes', async () => {
  const t = await ticketWithItem(); await syncNow(); const readCount = reads;
  writes = []; await syncNow();
  assert.equal(reads, readCount);
  assert.ok(!writes.includes(`publicQueue/${t.id}`));
  assert.deepEqual(writes, []);
});

test('another device changes and tombstones arrive through the retained listener', async () => {
  const t = await ticketWithItem(); await syncNow();
  const count = reads;
  remote.get(`tickets/${t.id}`).name = 'Other device';
  remote.get(`tickets/${t.id}`).updatedAt += 1000;
  emitSnapshots(); await syncNow();
  assert.equal((await db.tickets.get(t.id)).name, 'Other device');
  const item = store().items[0];
  remote.set(`items/${item.id}`, { id: item.id, deleted: true, updatedAt: Date.now() + 2000 });
  emitSnapshots(); await syncNow();
  assert.equal(await db.items.get(item.id), undefined);
  assert.equal(reads, count);
});

test('heartbeat remains fresh on the periodic cycle, without rewriting the counter', async () => {
  await ticketWithItem(); await syncNow(); writes = [];
  const now = Date.now();
  const clock = mock.method(Date, 'now', () => now + 30000);
  try { await syncNow(); } finally { clock.mock.restore(); }
  assert.deepEqual(writes, ['public/heartbeat']);
});

test('listener failure stops publication and retry obtains fresh server snapshots', async () => {
  await ticketWithItem(); await syncNow(); writes = [];
  for (const sub of subscriptions) if (sub.ref.path === 'tickets') sub.error(new Error('Listener disconnected'));
  const log = mock.method(console, 'error', () => {});
  try { await syncNow(); } finally { log.mock.restore(); }
  assert.equal(getSyncStatus().phase, 'error');
  assert.deepEqual(writes, []);
  assert.equal(subscriptions.size, 0);
  await syncNow();
  assert.equal(getSyncStatus().phase, 'synced');
});
test('local cashier edits remain available during stalled cloud writes', async () => {
  await ticketWithItem();
  let release; let started;
  const waiting = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  pauseWrite = () => { started(); return waiting; };
  const sync = syncNow(); await entered;
  try {
    const t = await Promise.race([store().addTicket('Offline work'), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Local write blocked by network')), 1000); timer.unref(); })]);
    assert.equal(t.name, 'Offline work');
  } finally { release(); await sync; }
});
test('a second restore during a stalled first restore keeps its own intent', async () => {
  await ticketWithItem(); const first = await store().exportBackup(); await syncNow();
  const second = structuredClone(first); second.tickets[0].name = 'Second restore';
  await store().importBackup(first);
  let release; let started;
  const waiting = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  pauseWrite = () => { started(); return waiting; };
  const sync = syncNow(); await entered;
  await store().importBackup(second);
  release(); await sync;
  assert.ok(await db.meta.get('restorePending'));
  await syncNow();
  assert.equal(remote.get(`tickets/${first.tickets[0].id}`).name, 'Second restore');
  assert.equal(await db.meta.get('restorePending'), undefined);
});


test('public mirror masks nickname and updates order duration without leaking private fields', async () => {
  const t = await store().addTicket('Punkture', 'private notes');
  await store().addItem({ ticketId: t.id, placementName: 'Lobe', basePrice: 250, upgradeLabel: 'Free', upgradePrice: 0, quantity: 1 });
  await syncNow();
  const row = remote.get(`publicQueue/${t.id}`);
  assert.equal(row.maskedNickname, 'P******e');
  assert.equal(row.estimatedDurationMinutes, 5);
  assert.equal(row.name, undefined); assert.equal(row.notes, undefined);
  await store().updateItem(store().items[0].id, { quantity: 2 });
  await syncNow();
  assert.equal(remote.get(`publicQueue/${t.id}`).estimatedDurationMinutes, 10);
});
