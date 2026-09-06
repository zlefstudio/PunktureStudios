import { readFileSync } from 'node:fs';
import { test, before, beforeEach, after } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

let env;
const station = '00000000-0000-4000-8000-000000000001';
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-punkture-tests',
    firestore: { host: '127.0.0.1', port: 8180, rules: readFileSync('firestore.rules', 'utf8') },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'staff', 'allowed'), { enabled: true });
    await setDoc(doc(context.firestore(), 'cloudControl', 'station'), { installation: station });
  });
});
after(async () => { await env?.cleanup(); });
const staff = () => env.authenticatedContext('allowed').firestore();
const anon = () => env.unauthenticatedContext().firestore();
function appointment() {
  const requestedFor = Math.ceil((Date.now() + 86400000) / 60000) * 60000;
  const date = new Date(requestedFor + 8 * 3600000).toISOString();
  return { name: 'Test customer', contact: 'test@example.invalid', date: date.slice(0, 10), time: date.slice(11, 16), requestedFor, status: 'requested', createdAt: serverTimestamp() };
}
test('public may create bookings but cannot read or enumerate customer records', async () => {
  await assertSucceeds(setDoc(doc(anon(), 'appointments', 'request'), appointment()));
  await assertFails(getDoc(doc(anon(), 'appointments', 'request')));
  await assertFails(getDocs(collection(anon(), 'appointments')));
  await assertFails(getDocs(collection(anon(), 'tickets')));
  await assertFails(getDocs(collection(anon(), 'items')));
});
test('booking fields, requested time, status and server timestamp are enforced', async () => {
  for (const patch of [
    { name: '   ' }, { notes: 'x'.repeat(301) }, { unexpected: 'private field' },
    { status: 'confirmed' }, { createdAt: 1 }, { requestedFor: 1 },
    { date: '2027-02-30' }, { time: '25:00' }, { contact: '' },
  ]) await assertFails(setDoc(doc(anon(), 'appointments', crypto.randomUUID()), { ...appointment(), ...patch }));
  await assertSucceeds(setDoc(doc(staff(), 'appointments', 'staff-booking'), appointment()));
});
test('staff can manage bookings and delete personal data; outsiders cannot', async () => {
  await setDoc(doc(anon(), 'appointments', 'request'), appointment());
  await assertSucceeds(updateDoc(doc(staff(), 'appointments', 'request'), { status: 'confirmed', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(anon(), 'appointments', 'request'), { status: 'cancelled', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(staff(), 'appointments', 'request'), { name: 'changed' }));
  await assertSucceeds(deleteDoc(doc(staff(), 'appointments', 'request')));
});
test('public queue cannot include client names even from staff', async () => {
  const row = { id: 'ticket', ticketNumber: 1, status: 'waiting', position: 0, seq: 0, createdAt: 1, updatedAt: 1, calledAt: null, startedAt: null };
  await assertSucceeds(setDoc(doc(staff(), 'publicQueue', 'ticket'), row));
  await assertSucceeds(getDocs(collection(anon(), 'publicQueue')));
  await assertFails(setDoc(doc(staff(), 'publicQueue', 'ticket'), { ...row, name: 'Secret' }));
  await assertFails(setDoc(doc(anon(), 'publicQueue', 'ticket'), row));
});
test('staff writes work across browsers and validate item values', async () => {
  const row = { id: 'item', writerId: station, ticketId: 'ticket', placementName: 'Lobe', basePrice: 250, upgradeLabel: 'Free', upgradePrice: 0, quantity: 1, createdAt: 1, updatedAt: 1 };
  await assertSucceeds(setDoc(doc(staff(), 'items', 'item'), row));
  await assertSucceeds(setDoc(doc(staff(), 'items', 'item'), { ...row, writerId: 'another-station' }));
  const { writerId: _writerId, ...withoutStation } = row;
  await assertSucceeds(setDoc(doc(staff(), 'items', 'item'), withoutStation));
  await assertFails(setDoc(doc(anon(), 'items', 'item'), withoutStation));
  await assertFails(setDoc(doc(staff(), 'items', 'item'), { ...row, quantity: -1 }));
  await assertSucceeds(setDoc(doc(staff(), 'items', 'item'), { id: 'item', writerId: station, deleted: true, updatedAt: 2 }));
  await assertFails(deleteDoc(doc(staff(), 'items', 'item')));
});
test('staff access cannot be self-provisioned and station ownership cannot be stolen', async () => {
  const outsider = env.authenticatedContext('outsider').firestore();
  await assertFails(setDoc(doc(outsider, 'staff', 'outsider'), { enabled: true }));
  await assertFails(getDocs(collection(outsider, 'tickets')));
  await assertFails(updateDoc(doc(staff(), 'cloudControl', 'station'), { installation: 'changed' }));
  await assertFails(deleteDoc(doc(staff(), 'cloudControl', 'station')));
});
test('heartbeat is public, contains only a server timestamp, and cannot be forged by customers', async () => {
  await assertSucceeds(setDoc(doc(staff(), 'public', 'heartbeat'), { publishedAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(anon(), 'public', 'heartbeat')));
  await assertFails(setDoc(doc(anon(), 'public', 'heartbeat'), { publishedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(staff(), 'public', 'heartbeat'), { publishedAt: 1 }));
});
test('settings are readable by document and writable with the supported shape', async () => {
  await assertSucceeds(setDoc(doc(staff(), 'public', 'public'), { key: 'public', eventActive: false, updatedAt: 1 }));
  await assertSucceeds(getDoc(doc(anon(), 'public', 'public')));
  await assertSucceeds(getDoc(doc(staff(), 'public', 'public')));
  await assertFails(getDocs(collection(staff(), 'public')));
});
test('staff writes do not need a station claim', async () => {
  await env.withSecurityRulesDisabled(context => deleteDoc(doc(context.firestore(), 'cloudControl', 'station')));
  await assertSucceeds(setDoc(doc(staff(), 'tickets', 'ticket'), { id: 'ticket', ticketNumber: 1, name: 'Customer', status: 'waiting', createdAt: 1, updatedAt: 1 }));
});
test('valid ticket lifecycle writes pass and unsupported statuses fail', async () => {
  const ref = doc(staff(), 'tickets', 'ticket');
  await assertSucceeds(setDoc(ref, { id: 'ticket', writerId: station, ticketNumber: 1, name: 'Customer', status: 'waiting', queueOrder: 0, createdAt: 1, updatedAt: 1 }));
  await assertSucceeds(updateDoc(ref, { status: 'in_progress', startedAt: 2, updatedAt: 2 }));
  await assertSucceeds(updateDoc(ref, { status: 'finished', finishedAt: 3, updatedAt: 3 }));
  await assertFails(updateDoc(ref, { status: 'unknown' }));
});
