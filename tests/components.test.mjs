import 'fake-indexeddb/auto';
import { test, beforeEach, afterEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5185', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
let savedSettings;
let bookingWrites;
let saveBooking;
let queueRows;
let heartbeat;
let unavailableSlots;
let availabilityFails;
const docRef = (_db, col, id) => ({ kind: 'doc', col, id });
await mock.module('../src/firebase.ts', { namedExports: { auth: {}, firestore: {} } });
await mock.module('../src/sync.ts', { namedExports: {
  getLocalPublicSettings: async () => null,
  saveLocalPublicSettings: async patch => { savedSettings = patch; return { ...patch, key: 'public', updatedAt: 1 }; },
  syncNow: async () => {},
} });
await mock.module('firebase/auth', { namedExports: {
  onAuthStateChanged: (_auth, callback) => { callback(null); return () => {}; },
} });
await mock.module('firebase/firestore', { namedExports: {
  doc: docRef,
  collection: (_db, col) => ({ kind: 'collection', col }),
  query: ref => ref,
  orderBy: () => ({}), limit: () => ({}),
  serverTimestamp: () => 'server-timestamp',
  setDoc: async (ref, value) => { bookingWrites.push({ ref, value }); await saveBooking(); },
  updateDoc: async () => {}, deleteDoc: async () => {},
  onSnapshot: (ref, callback) => {
    if (ref.kind === 'collection') callback({ forEach: visit => queueRows.forEach(row => visit({ data: () => row })) });
    else if (ref.id === 'heartbeat') callback({ data: () => ({ publishedAt: { toMillis: () => heartbeat } }) });
    else callback({ exists: () => false });
    return () => {};
  },
} });
await mock.module('../src/bookingApi.ts', { namedExports: {
  RESERVATION_POLICY: 'PHP 100.00 reservation fee',
  bookingApi: async (path, options = {}) => {
    if (path.startsWith('/availability')) { if (availabilityFails) throw new Error('Availability unavailable'); return { unavailable: unavailableSlots }; }
    if (path === '/bookings') { const value = JSON.parse(options.body); bookingWrites.push({ value }); await saveBooking(); return { id: value.id, status: 'pending' }; }
    return { id: 'booking', status: 'pending', date: '2026-09-20', time: '13:00', expiresAt: Date.now()+900000, policy: 'PHP 100.00 reservation fee', emails: [] };
  },
} });
await mock.module('../src/components/PiercingRitualAnimation.tsx', { namedExports: {
  PiercingRitualAnimation: () => React.createElement('div', null, 'Animation'),
} });
const { PublicSettingsView } = await import('../src/components/PublicSettingsView.tsx');
const { AppointmentPage } = await import('../src/components/AppointmentPage.tsx');
const { WorkspaceHeader } = await import('../src/components/WorkspaceHeader.tsx');
const { LiveQueuePage } = await import('../src/components/LiveQueuePage.tsx');
const { useStore } = await import('../src/store.ts');
const { db } = await import('../src/db.ts');
let root;
let container;
beforeEach(async () => {
  window.history.replaceState(null, '', '/');
  savedSettings = null; bookingWrites = []; saveBooking = async () => {}; queueRows = []; heartbeat = 0; unavailableSlots = []; availabilityFails = false;
  await db.transaction('rw', db.tickets, db.items, db.meta, db.settings, async () => {
    await Promise.all([db.tickets.clear(), db.items.clear(), db.meta.clear(), db.settings.clear()]);
  });
  await useStore.getState().loadAll();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
after(() => { db.close(); dom.window.close(); });
async function render(component, props = {}) { await act(async () => root.render(React.createElement(component, props))); }
async function fill(selector, value) {
  const input = container.querySelector(selector); assert.ok(input, selector);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
function submit() { container.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }

test('fresh settings form can save its first change', async () => {
  await render(PublicSettingsView);
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  // Booking availability remains independently editable.
  await act(async () => checkboxes[0].click());
  const saveBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Save all changes'));
  await act(async () => saveBtn.click());
  assert.equal(savedSettings.bookingEnabled, false);
  assert.match(container.textContent, /Settings saved/i);
});
test('second ticket cannot start while another session is active', async () => {
  const first = await useStore.getState().addTicket('First');
  const second = await useStore.getState().addTicket('Second');
  await useStore.getState().startPiercing(first.id);
  await render(WorkspaceHeader, { ticket: second });
  const start = [...container.querySelectorAll('button')].find(button => button.textContent === 'Another session is active');
  assert.ok(start); assert.equal(start.disabled, true);
});
test('booking form requires waiver consent inside the review modal before submitting', async () => {
  let finish;
  saveBooking = () => new Promise(resolve => { finish = resolve; });
  await render(AppointmentPage);
  const continueBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('proceed to schedule') || b.textContent.includes('Continue'));
  await act(async () => continueBtn.click());
  const dateChip = [...container.querySelectorAll('button')].find(b => b.querySelector('.text-lg.font-black') && !b.disabled);
  await act(async () => dateChip.click());
  const slotBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('PM') || b.textContent.includes('AM'));
  await act(async () => slotBtn.click());
  const nextBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Next: Client Details'));
  await act(async () => nextBtn.click());
  await fill('input[placeholder="e.g. Maya Santos"]', 'Test Person');
  await fill('input[placeholder="e.g. 09171234567 or @mayasantos"]', 'test@example.invalid');

  await fill('input[type="email"]', 'test@example.invalid');

  // Submitting opens the waiver consent modal — no request is written yet.
  await act(async () => { submit(); });
  const modalBox = container.querySelector('#waiver-modal-agree');
  assert.ok(modalBox, 'waiver consent modal should open on submit');
  assert.equal(bookingWrites.length, 0);

  // The confirm button stays disabled until the checkbox is ticked.
  const confirmBefore = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Agree & Continue to PHP 100.00 Payment'));
  assert.ok(confirmBefore);
  assert.equal(confirmBefore.disabled, true);

  await act(async () => modalBox.click());

  // Double-clicking confirm must not create duplicate requests while pending.
  const confirmBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Agree & Continue to PHP 100.00 Payment'));
  await act(async () => { confirmBtn.click(); confirmBtn.click(); });
  assert.equal(bookingWrites.length, 1);
  assert.equal(bookingWrites[0].value.consent, true);
  assert.equal(bookingWrites[0].value.email, 'test@example.invalid');
  assert.equal(bookingWrites[0].value.policy, 'PHP 100.00 reservation fee');
  await act(async () => finish());
  assert.match(container.textContent, /Waiting for verified payment/i);
});
test('booking form rejects incomplete requests before contacting the cloud', async () => {
  await render(AppointmentPage);
  const continueBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('proceed to schedule') || b.textContent.includes('Continue'));
  await act(async () => continueBtn.click());
  const dateChip = [...container.querySelectorAll('button')].find(b => b.querySelector('.text-lg.font-black') && !b.disabled);
  await act(async () => dateChip.click());
  const slotBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('PM') || b.textContent.includes('AM'));
  await act(async () => slotBtn.click());
  const nextBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Next: Client Details'));
  await act(async () => nextBtn.click());
  await fill('input[placeholder="e.g. Maya Santos"]', 'Test Person');
  await act(async () => submit());
  assert.equal(bookingWrites.length, 0);
  assert.match(container.textContent, /Please enter your name and contact info/);
});
test('an old queue heartbeat shows paused updates', async () => {
  queueRows = [{ ticketNumber: 1, status: 'waiting', position: 0, seq: 0, updatedAt: Date.now() }];
  heartbeat = Date.now() - 120000;
  await render(LiveQueuePage);
  assert.match(container.textContent, /UPDATES PAUSED/);
  assert.match(container.textContent, /last known queue/);
});

test('taken slots and availability failures disable schedule buttons', async () => {
  unavailableSlots = ['13:00'];
  await render(AppointmentPage);
  const proceed = [...container.querySelectorAll('button')].find(b => b.textContent.includes('proceed to schedule') || b.textContent.includes('Continue'));
  await act(async () => proceed.click());
  const dates = [...container.querySelectorAll('button')].filter(b => b.querySelector('.text-lg.font-black') && !b.disabled);
  await act(async () => dates[0].click());
  const taken = [...container.querySelectorAll('button')].find(b => b.textContent.includes('1:00 PM'));
  assert.equal(taken.disabled, true); assert.match(taken.textContent, /Unavailable/);
  availabilityFails = true;
  await act(async () => dates[1].click());
  const slots = [...container.querySelectorAll('button')].filter(b => /\d:\d\d (AM|PM)/.test(b.textContent));
  assert.ok(slots.length > 0); assert.ok(slots.every(b => b.disabled));
  assert.match(container.textContent, /Availability unavailable/);
});
test('unpaid success return does not display booking confirmation', async () => {
  window.history.replaceState(null, '', '/appointment.html#booking=unpaid&token=private');
  await render(AppointmentPage);
  assert.match(container.textContent, /Waiting for verified payment/);
  assert.doesNotMatch(container.textContent, /Booking confirmed|Payment acknowledgement receipt/);
});
