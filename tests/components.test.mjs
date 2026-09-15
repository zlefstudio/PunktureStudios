import 'fake-indexeddb/auto';
import { test, beforeEach, afterEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5185', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: dom.window.sessionStorage, configurable: true });
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
let serverSlots;
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
  getDocs: async ref => ({ docs: (ref?.col === 'appointments' ? queueRows : []).map(row => ({ data: () => row, ref: docRef(null, 'appointments', String(row.id ?? 'row')) })) }),
  writeBatch: () => ({ delete: () => {}, commit: async () => {} }),
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
    if (path.startsWith('/availability')) {
      if (availabilityFails) throw new Error('Availability unavailable');
      return serverSlots ? { slots: serverSlots, unavailable: unavailableSlots } : { unavailable: unavailableSlots };
    }
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
  savedSettings = null; bookingWrites = []; saveBooking = async () => {}; queueRows = []; heartbeat = 0; unavailableSlots = []; availabilityFails = false; serverSlots = null;
  await db.transaction('rw', db.tickets, db.items, db.meta, db.settings, async () => {
    await Promise.all([db.tickets.clear(), db.items.clear(), db.meta.clear(), db.settings.clear()]);
  });
  await useStore.getState().loadAll();
  document.body.style.overflow = '';
  window.sessionStorage.clear();
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
  const saveBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Save changes'));
  assert.ok(saveBtn, 'settings save button must exist in the sticky action bar');
  await act(async () => saveBtn.click());
  assert.equal(savedSettings.bookingEnabled, false);
  assert.match(container.textContent, /Settings saved/i);
});
test('settings workspace shows one panel at a time and follows deep-link anchors', async () => {
  await render(PublicSettingsView);
  const tab = (label) => [...container.querySelectorAll('nav[aria-label="Settings sections"] button')].find(b => b.textContent === label);
  const panel = (selector) => container.querySelector(selector);
  const bookingsWrapper = () => panel('#paid-bookings').parentElement;
  assert.ok(!bookingsWrapper().className.includes('hidden'), 'bookings panel is the default panel');
  assert.ok(panel('#booking-schedule').className.includes('hidden'), 'schedule panel starts hidden');
  await act(async () => tab('Schedule').click());
  assert.ok(!panel('#booking-schedule').className.includes('hidden'), 'schedule panel opens');
  assert.ok(bookingsWrapper().className.includes('hidden'), 'other panels hide when one opens');
  window.location.hash = '#incoming-requests';
  await act(async () => window.dispatchEvent(new window.Event('hashchange')));
  assert.ok(!panel('#incoming-requests').className.includes('hidden'), 'sidebar anchor opens the legacy panel');
  assert.ok(panel('#booking-schedule').className.includes('hidden'), 'previous panel hides again');
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
  const continueBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Next: Pick Schedule') || b.textContent.includes('Skip to Schedule'));
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
  const modalBox = document.body.querySelector('#waiver-modal-agree');
  assert.ok(modalBox, 'waiver consent modal should open on submit');
  assert.equal(bookingWrites.length, 0);

  // The confirm button stays disabled until BOTH checkboxes are ticked.
  const confirmBefore = [...document.body.querySelectorAll('button')].find(b => b.textContent.includes('Agree & Continue to PHP 100.00 Payment'));
  assert.ok(confirmBefore);
  assert.equal(confirmBefore.disabled, true);

  const privacyBox = document.body.querySelector('#waiver-modal-privacy');
  assert.ok(privacyBox, 'privacy & legal consent is present');

  await act(async () => modalBox.click());
  assert.equal(confirmBefore.disabled, true, 'waiver alone is not enough');

  await act(async () => privacyBox.click());
  assert.equal(confirmBefore.disabled, false, 'both consents enable the pay button');

  // Double-clicking confirm must not create duplicate requests while pending.
  const confirmBtn = [...document.body.querySelectorAll('button')].find(b => b.textContent.includes('Agree & Continue to PHP 100.00 Payment'));
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
  const continueBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Next: Pick Schedule') || b.textContent.includes('Skip to Schedule'));
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
  await render(AppointmentPage);
  const proceed = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Next: Pick Schedule') || b.textContent.includes('Skip to Schedule'));
  await act(async () => proceed.click());
  const dates = dateChips().filter(b => !b.disabled);
  await act(async () => dates[0].click());
  const taken = slotLabels()[0];
  assert.ok(taken, 'the first open day lists slots');
  unavailableSlots = [labelTo24(taken)];
  // Re-selecting the date re-runs availability with the slot now taken.
  await act(async () => dates[1].click());
  await act(async () => dates[0].click());
  const takenBtn = [...container.querySelectorAll('button')].find(b => b.textContent.replace(' · Unavailable', '').trim() === taken);
  assert.ok(takenBtn, 'the taken slot button exists');
  assert.equal(takenBtn.disabled, true); assert.match(takenBtn.textContent, /Unavailable/);
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

/** Slot labels rendered in step 2, e.g. '9:00 AM'. */
function slotLabels() {
  return [...container.querySelectorAll('button')]
    .map(b => b.textContent.replace(' · Unavailable', '').trim())
    .filter(text => /^\d{1,2}:\d{2} (AM|PM)$/.test(text));
}
/** '1:30 PM' → '13:30'. */
function labelTo24(label) {
  const [time, ampm] = label.split(' ');
  const [h, m] = time.split(':').map(Number);
  const hour = (h % 12) + (ampm === 'PM' ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function slotMinutes(label) {
  const [h, m] = labelTo24(label).split(':').map(Number);
  return h * 60 + m;
}
async function openScheduleStep() {
  const proceed = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Next: Pick Schedule') || b.textContent.includes('Skip to Schedule'));
  await act(async () => proceed.click());
}
function dateChips() { return [...container.querySelectorAll('button')].filter(b => b.querySelector('.text-lg.font-black')); }

test('step CTAs are sized alike and only step 2 carries a back control', async () => {
  await render(AppointmentPage);
  assert.match(container.textContent, /Select Piercings/);
  assert.doesNotMatch(container.textContent, /\d\.\s*Select Piercings/);

  const cta = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Skip to Schedule'));
  assert.ok(cta, 'step 1 offers the skip/next CTA');
  assert.ok(cta.className.includes('w-full') && cta.className.includes('py-3.5'), 'step 1 CTA matches the other step buttons');
  assert.ok(!cta.className.includes('flex-1'), 'step 1 CTA is no longer stretched next to a back button');
  assert.equal([...container.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Back').length, 0, 'step 1 has no back control');

  await openScheduleStep();
  const firstChip = dateChips().find(c => !c.disabled);
  await act(async () => firstChip.click());
  assert.match(container.textContent, /Choose a Time Slot/);
  assert.doesNotMatch(container.textContent, /\d\.\s*Choose a Time Slot/);
  assert.doesNotMatch(container.textContent, /\d\.\s*Select an Available Date/);
  assert.doesNotMatch(container.textContent, /Back to Piercings/, 'the heading link moved beside the Next button');

  // Step 2 shows Back beside Next: Client Details, and Back returns to step 1.
  const next = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Next: Client Details'));
  const back = [...container.querySelectorAll('button')].find(b => b.textContent.trim() === 'Back');
  assert.ok(next && back, 'step 2 renders Back and Next together');
  assert.ok(next.className.includes('flex-1'), 'Next fills the rest of the row');
  await act(async () => back.click());
  assert.match(container.textContent, /Select Piercings/);
  assert.match(container.textContent, /Next: Pick Schedule|Skip to Schedule/);
});

test('booking slots follow the 45-minute studio grid for the chosen weekday', async () => {
  await render(AppointmentPage);
  await openScheduleStep();
  let weekdays = 0; let saturdays = 0;
  for (const chip of dateChips()) {
    if (chip.disabled) continue;
    const chipLabel = chip.textContent;
    await act(async () => chip.click());
    const labels = slotLabels();
    assert.ok(labels.length > 0, `${chipLabel} must offer slots`);
    const minutes = labels.map(slotMinutes);
    for (let i = 1; i < minutes.length; i++) {
      const gap = minutes[i] - minutes[i - 1];
      // 105 minutes is the noon-break jump (11:15 AM → 1:00 PM) on weekdays only.
      assert.ok(gap === 45 || (gap === 105 && !chipLabel.includes('Sat')), `${labels[i - 1]} → ${labels[i]} on ${chipLabel}`);
    }
    if (chipLabel.includes('Sat')) {
      assert.equal(labels[0], '1:00 PM', 'Saturday opens at 1 PM');
      assert.equal(labels[labels.length - 1], '4:45 PM', 'Saturday closes at 5 PM');
      saturdays++;
    } else {
      assert.equal(labels[0], '9:00 AM', 'weekdays open at 9 AM');
      assert.equal(labels[3], '11:15 AM', 'the last morning slot is 11:15 AM');
      assert.ok(!labels.includes('12:00 PM') && !labels.includes('12:45 PM'), 'nothing is booked across the noon break');
      assert.equal(labels[4], '1:00 PM', 'the afternoon resumes at 1 PM');
      assert.equal(labels[labels.length - 1], '7:45 PM', 'weekdays run to 8 PM');
      weekdays++;
    }
  }
  assert.ok(weekdays > 0, 'a weekday was inspected');
  assert.ok(saturdays > 0, 'a Saturday was inspected');
});

test('deposit card states the 24-hour refund window and the 15-minute late fee', async () => {
  await render(AppointmentPage);
  await openScheduleStep();
  const chip = dateChips().find(c => !c.disabled);
  await act(async () => chip.click());
  const slot = [...container.querySelectorAll('button')].find(b => /^\d{1,2}:\d{2} (AM|PM)$/.test(b.textContent.trim()));
  await act(async () => slot.click());
  const nextBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Next: Client Details'));
  await act(async () => nextBtn.click());
  assert.match(container.textContent, /24 hours or more before your appointment/);
  assert.match(container.textContent, /refundable in full on request/);
  assert.match(container.textContent, /cancellation fee/);
  assert.match(container.textContent, /15 minutes or more after your slot/);
  assert.match(container.textContent, /late fee/);
});

test('emptying the cart releases the page scroll lock', async () => {
  const { BookingCartBar } = await import('../src/components/booking/BookingCartBar.tsx');
  const props = { onRemoveItem: () => {}, onProceed: () => {} };
  const item = { id: 'sel-1', name: 'Lobe', category: 'EAR', basePrice: 300 };
  await act(async () => root.render(React.createElement(BookingCartBar, { ...props, items: [item] })));
  const fab = [...document.body.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').startsWith('View cart'));
  assert.ok(fab, 'the cart button renders while something is selected');
  await act(async () => fab.click());
  assert.equal(document.body.style.overflow, 'hidden', 'the open cart locks page scroll');

  // Deleting the last item hides the panel; the booking page must scroll again.
  await act(async () => root.render(React.createElement(BookingCartBar, { ...props, items: [] })));
  assert.notEqual(document.body.style.overflow, 'hidden', 'deleting the last item releases page scroll');
  assert.doesNotMatch(document.body.textContent, /Estimated Total/);
});
test('the booking page highlights the three-person visit limit', async () => {
  await render(AppointmentPage);
  assert.match(container.textContent, /Up to 3 people per appointment/);
  assert.match(container.textContent, /up to two companions/);
  assert.doesNotMatch(container.textContent, /Something came up/, 'the old “message the studio” line is gone');

  // The reminder repeats at the confirmation step, right above the pay button.
  await openScheduleStep();
  const chip = dateChips().find(c => !c.disabled);
  await act(async () => chip.click());
  const slot = [...container.querySelectorAll('button')].find(b => /^\d{1,2}:\d{2} (AM|PM)$/.test(b.textContent.trim()));
  await act(async () => slot.click());
  const nextBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Next: Client Details'));
  await act(async () => nextBtn.click());
  assert.match(container.textContent, /up to 3 people may join the appointment/);
});

test('the booking page follows the slot list the Worker publishes', async () => {
  serverSlots = ['13:00', '14:30'];
  await render(AppointmentPage);
  await openScheduleStep();
  const chip = dateChips().find(c => !c.disabled);
  await act(async () => chip.click());
  assert.deepEqual(slotLabels(), ['1:00 PM', '2:30 PM'], 'only the accepted slots are offered');
  assert.match(container.textContent, /1:00 PM, 2:30 PM/, 'the block label reflects the accepted list');

  // An empty accepted list (closed day) explains itself instead of showing a bare grid.
  serverSlots = [];
  const otherChip = dateChips().filter(c => !c.disabled)[1];
  await act(async () => otherChip.click());
  assert.deepEqual(slotLabels(), []);
  assert.match(container.textContent, /No time slots are open on this date/);
});

test('the cart CTA label follows the current booking step', async () => {
  window.sessionStorage.setItem('punkture.booking-cart.v1', JSON.stringify([{ id: 'c1', name: 'Lobe', category: 'EAR', basePrice: 300 }]));
  const fab = () => [...document.body.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').startsWith('View cart'));
  const panelCTA = () => {
    const panel = document.querySelector('.modal-positioner');
    return panel ? [...panel.querySelectorAll('button')].find(b => b.textContent.includes('Next:') || b.textContent.includes('Back to Your Details')) : null;
  };
  const closeCart = async () => {
    const close = [...document.body.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Close cart');
    await act(async () => close.click());
  };
  await render(AppointmentPage);

  await act(async () => fab().click());
  assert.ok(panelCTA()?.textContent.includes('Next: Schedule'), 'step 1 → Next: Schedule');
  await closeCart();

  await openScheduleStep();
  const chip = dateChips().find(c => !c.disabled);
  await act(async () => chip.click());
  const slot = [...container.querySelectorAll('button')].find(b => /^\d{1,2}:\d{2} (AM|PM)$/.test(b.textContent.trim()));
  await act(async () => slot.click());
  await act(async () => fab().click());
  assert.ok(panelCTA()?.textContent.includes('Next: Client Details'), 'step 2 → Next: Client Details');
  await closeCart();

  const nextBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Next: Client Details'));
  await act(async () => nextBtn.click());
  await act(async () => fab().click());
  assert.ok(panelCTA()?.textContent.includes('Back to Your Details'), 'step 3 → Back to Your Details');
  assert.ok(!panelCTA()?.textContent.includes('Next: Schedule'), 'the stale label is gone on the details step');
});

test('the cart button hides while a modal owns the screen and releases its scroll lock', async () => {
  const { BookingCartBar } = await import('../src/components/booking/BookingCartBar.tsx');
  const props = { onRemoveItem: () => {}, onProceed: () => {} };
  const item = { id: 'sel-1', name: 'Lobe', category: 'EAR', basePrice: 300 };
  const fab = () => [...document.body.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').startsWith('View cart'));
  await act(async () => root.render(React.createElement(BookingCartBar, { ...props, items: [item] })));
  assert.ok(fab(), 'the cart button shows while nothing covers the page');
  await act(async () => fab().click());
  assert.equal(document.body.style.overflow, 'hidden', 'the open cart locks page scroll');

  await act(async () => root.render(React.createElement(BookingCartBar, { ...props, items: [item], hidden: true })));
  assert.equal(fab(), undefined, 'the cart button hides behind a modal');
  assert.notEqual(document.body.style.overflow, 'hidden', 'hiding the cart releases its scroll lock');

  await act(async () => root.render(React.createElement(BookingCartBar, { ...props, items: [item] })));
  assert.ok(fab(), 'the cart button returns when the modal closes');
});

test('the waiver modal is full screen with the pay button outside the scrolling copy', async () => {
  window.sessionStorage.setItem('punkture.booking-cart.v1', JSON.stringify([{ id: 'c1', name: 'Lobe', category: 'EAR', basePrice: 300 }]));
  const cartFab = () => [...document.body.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').startsWith('View cart'));
  await render(AppointmentPage);
  assert.ok(cartFab(), 'the cart button is available while booking');
  await openScheduleStep();
  const chip = dateChips().find(c => !c.disabled);
  await act(async () => chip.click());
  const slot = [...container.querySelectorAll('button')].find(b => /^\d{1,2}:\d{2} (AM|PM)$/.test(b.textContent.trim()));
  await act(async () => slot.click());
  const nextBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Next: Client Details'));
  await act(async () => nextBtn.click());
  await fill('input[placeholder="e.g. Maya Santos"]', 'Test Person');
  await fill('input[placeholder="e.g. 09171234567 or @mayasantos"]', 'test@example.invalid');
  await fill('input[type="email"]', 'test@example.invalid');
  await act(async () => submit());

  const dialog = document.body.querySelector('[role="dialog"][aria-modal="true"]');
  assert.ok(dialog, 'the waiver opens as a modal dialog immediately');
  assert.ok(!container.contains(dialog), 'the modal is portalled to <body> so it is fixed to the viewport');
  assert.ok(dialog.className.includes('flex-col'), 'header, copy and actions stack');
  const scroller = dialog.querySelector('.overflow-y-auto');
  assert.ok(scroller, 'the waiver copy scrolls inside the panel');
  const header = dialog.querySelector('.flex-shrink-0');
  assert.ok(header && !header.textContent.includes('EN'), 'the language toggle moved out of the header');
  assert.ok(scroller.textContent.includes('Language'), 'the language switch lives in the scrollable body');
  assert.ok(dialog.querySelector('#waiver-modal-privacy'), 'privacy & legal consent is present');
  const privacyLink = dialog.querySelector('a[href="https://punkture-studios.web.app/privacy"]');
  assert.ok(privacyLink, 'the privacy link points at the live policy page');
  assert.equal(privacyLink.getAttribute('target'), '_blank', 'the policy opens without leaving the booking');
  const cta = [...dialog.querySelectorAll('button')].find(b => b.textContent.includes('Agree & Continue'));
  assert.ok(cta && !scroller.contains(cta), 'the pay button stays visible outside the scrolling copy');
  assert.ok(!scroller.contains(dialog.querySelector('#waiver-modal-agree')), 'consent sits with the pay button');
  assert.equal(cartFab(), undefined, 'the cart button hides while the waiver modal is open');

  // Closing the modal brings the cart button back.
  const closeBtn = [...dialog.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Close');
  await act(async () => closeBtn.click());
  assert.ok(cartFab(), 'the cart button returns after the modal closes');
});

test('settings schedule panel offers studio hours and per-weekday slots', async () => {
  await render(PublicSettingsView);
  await act(async () => [...container.querySelectorAll('nav[aria-label="Settings sections"] button')].find(b => b.textContent === 'Schedule').click());
  assert.match(container.textContent, /Mon–Fri 9:00 AM – 12:00 PM, 1:00 PM – 8:00 PM/);
  assert.match(container.textContent, /Sat 1:00 PM – 5:00 PM/);
  assert.match(container.textContent, /Sun closed/);
  assert.match(container.textContent, /45-minute appointments/);

  const apply = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Apply studio hours'));
  assert.ok(apply, 'studio hours preset button exists');
  await act(async () => apply.click());
  const saveBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Save changes'));
  await act(async () => saveBtn.click());
  assert.deepEqual(savedSettings.bookingDays, [1, 2, 3, 4, 5, 6], 'Sunday is not offered');
  assert.deepEqual(savedSettings.bookingDaySlots['1'].slice(0, 2), ['09:00', '09:45']);
  assert.deepEqual(savedSettings.bookingDaySlots['6'], ['13:00', '13:45', '14:30', '15:15', '16:00', '16:45']);
  assert.ok(!('0' in savedSettings.bookingDaySlots), 'no Sunday grid is saved');
  assert.equal(savedSettings.bookingSlots[0], '09:00');
  assert.equal(savedSettings.bookingSlots[savedSettings.bookingSlots.length - 1], '19:45');
});
