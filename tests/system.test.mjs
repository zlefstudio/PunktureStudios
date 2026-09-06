import 'fake-indexeddb/auto';
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db.ts';
import { useStore } from '../src/store.ts';
import { validateBackup, csvCell, validAppointmentDate, safeHttpUrl } from '../src/validation.ts';
import { sortWaiting } from '../src/queue.ts';
import { calculateQueueWaitTimes, getTicketDuration } from '../src/timeEstimate.ts';

beforeEach(async () => {
  await db.transaction('rw', db.tickets, db.items, db.meta, db.settings, async () => {
    await Promise.all([db.tickets.clear(), db.items.clear(), db.meta.clear(), db.settings.clear()]);
  });
  await useStore.getState().loadAll();
});
after(() => db.close());
const store = () => useStore.getState();
async function addItem(ticketId) {
  await store().addItem({ ticketId, placementName: 'Lobe', basePrice: 250, upgradeLabel: 'Free', upgradePrice: 0, quantity: 1 });
}

test('concurrent ticket allocations are unique and two sessions cannot start', async () => {
  const tickets = await Promise.all(Array.from({ length: 12 }, (_, i) => store().addTicket(`Client ${i}`)));
  assert.equal(new Set(tickets.map(t => t.ticketNumber)).size, 12);
  const results = await Promise.allSettled(tickets.slice(0, 2).map(t => store().startPiercing(t.id)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await db.tickets.where('status').equals('in_progress').count()), 1);
});
test('reset preserves waiting order and archives revenue', async () => {
  const a = await store().addTicket('A'); const b = await store().addTicket('B'); const c = await store().addTicket('C');
  await addItem(a.id); await store().finishTicket(a.id);
  await store().moveWaitingTicket(c.id, 0);
  await store().clearHistoryAndResetNumbering();
  assert.deepEqual(sortWaiting(store().tickets).map(t => t.id), [c.id, b.id]);
  assert.equal((await db.items.toArray()).length, 1);
  assert.ok((await db.tickets.get(a.id)).archivedAt);
  assert.equal((await store().addTicket('D')).ticketNumber, 3);
});
test('version 2 backup restores settings, counter and clears old deletion markers', async () => {
  const a = await store().addTicket('A'); await addItem(a.id);
  await db.settings.put({ key: 'public', eventActive: true, eventTitle: 'Event', updatedAt: 10 });
  await db.meta.put({ key: 'ticketCounter', value: 42 });
  const backup = await store().exportBackup();
  await store().deleteItem(store().items[0].id);
  await store().addTicket('Not in backup');
  await store().importBackup(backup);
  assert.equal(store().tickets.length, 1); assert.equal(store().items.length, 1);
  assert.equal((await db.settings.get('public')).eventTitle, 'Event');
  assert.equal((await db.meta.toArray()).filter(r => r.key.startsWith('itemDel:')).length, 0);
  assert.ok(await db.meta.get('restorePending'));
  assert.equal((await store().addTicket('Next')).ticketNumber, 43);
});
test('invalid restore does not destroy current data', async () => {
  await store().addTicket('Keep me');
  const backup = await store().exportBackup();
  for (const change of [
    b => { b.tickets[0].status = 'invalid'; },
    b => { b.tickets[0].status = ['waiting']; },
    b => { b.tickets[0].archivedAt = 1; },
    b => { b.tickets[0].ticketNumber = -1; },
    b => { b.tickets.push(b.tickets[0]); },
    b => { b.items = [{ id: 'broken' }]; },
  ]) {
    const broken = structuredClone(backup); change(broken);
    await assert.rejects(store().importBackup(broken));
    assert.equal((await db.tickets.toArray())[0].name, 'Keep me');
  }
});
test('legacy backup migration excludes archived numbers from counter', () => {
  const backup = validateBackup({ schemaVersion: 1, exportedAt: new Date().toISOString(), items: [], tickets: [
    { id: 'archived', name: 'Old', ticketNumber: 100, status: 'finished', createdAt: 1, archivedAt: 2 },
    { id: 'current', name: 'New', ticketNumber: 1, status: 'waiting', createdAt: 3 },
  ] });
  assert.equal(backup.ticketCounter, 1);
});
test('prices and closed tickets reject invalid mutations', async () => {
  const t = await store().addTicket('A'); await addItem(t.id);
  const item = store().items[0];
  await assert.rejects(store().updateItem(item.id, { quantity: -1 }));
  await assert.rejects(store().updateItem(item.id, { basePrice: Infinity }));
  await store().finishTicket(t.id);
  await assert.rejects(store().updateItem(item.id, { quantity: 2 }));
});
test('CSV text formulas are neutralized and delimiters escaped', () => {
  for (const value of ['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', ' \t=1+1']) assert.ok(csvCell(value).startsWith("'"));
  assert.equal(csvCell('a,b'), '"a,b"'); assert.equal(csvCell('a\rb'), '"a\rb"');
  assert.equal(csvCell(250), '250');
});
test('appointment time uses Manila and rejects past or invalid calendar values', () => {
  const now = Date.parse('2026-09-06T00:00:00Z');
  assert.equal(validAppointmentDate('2026-09-06', '09:00', now), true);
  assert.equal(validAppointmentDate('2026-09-06', '07:00', now), false);
  assert.equal(validAppointmentDate('2027-02-30', '09:00', now), false);
  assert.equal(safeHttpUrl('javascript:alert(1)'), undefined);
});
test('archived ticket reopening allocates a nonconflicting number', async () => {
  const old = await store().addTicket('Old'); await addItem(old.id); await store().finishTicket(old.id);
  await store().clearHistoryAndResetNumbering();
  const current = await store().addTicket('Current');
  await store().reopenTicket(old.id);
  assert.notEqual((await db.tickets.get(old.id)).ticketNumber, current.ticketNumber);
  validateBackup(await store().exportBackup());
});
test('called tickets count toward waits and jewelry-only orders take zero chair time', async () => {
  const called = await store().addTicket('Called'); const waiting = await store().addTicket('Waiting');
  await addItem(called.id); await store().callTicket(called.id);
  const estimate = calculateQueueWaitTimes(store().tickets, store().items, 1000);
  assert.equal(estimate.estimates.get(waiting.id).waitMinutes, 5);
  assert.equal(getTicketDuration([{ placementName: 'Jewelry', quantity: 2 }]), 0);
});
test('reorder failure restores the previous visible order', async () => {
  await store().addTicket('A'); const b = await store().addTicket('B');
  const before = store().tickets;
  const update = db.tickets.update;
  db.tickets.update = async () => { throw new Error('Disk full'); };
  try { await assert.rejects(store().moveWaitingTicket(b.id, 0)); }
  finally { db.tickets.update = update; }
  assert.deepEqual(store().tickets, before);
});
