import 'fake-indexeddb/auto';
import { test, mock, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

const remote = new Map();
let failure = null;
let pauseWrite = null;
let writes = [];
let reads = 0;
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
}
await mock.module('../src/firebase.ts', { namedExports: { firestore: {}, auth } });
await mock.module('firebase/auth', { namedExports: {
  signInWithEmailAndPassword: async () => {}, signOut: async () => { auth.currentUser = null; }, onAuthStateChanged: () => () => {},
} });
await mock.module('firebase/firestore', { namedExports: {
  collection: ref, doc: ref,
  getDocFromServer: async r => { reads++; return snap(r.path); },
  getDocsFromServer: async r => {
    reads++;
    return { forEach: fn => { for (const path of remote.keys()) if (path.startsWith(r.path + '/')) fn({ id: path.split('/')[1], data: () => structuredClone(remote.get(path)) }); } };
  },
  setDoc: (r, value) => write(r.path, value),
  deleteDoc: async r => { remote.delete(r.path); },
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
test('each sync refreshes other device changes without rewriting unchanged public queue', async () => {
  const t = await ticketWithItem(); await syncNow(); const readCount = reads;
  writes = []; await syncNow();
  assert.ok(reads > readCount);
  assert.ok(!writes.includes(`publicQueue/${t.id}`));
  assert.ok(writes.includes('public/heartbeat'));
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
