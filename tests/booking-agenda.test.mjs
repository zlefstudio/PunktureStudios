import { test, beforeEach, afterEach, after } from 'node:test';
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
const { bookingCartNotes } = await import('../src/components/booking/cartSnapshot.ts');
const agenda = await import('../src/components/booking/bookingAgenda.ts');
const social = await import('../src/socialContact.ts');
const { BookingsBoard } = await import('../src/components/booking/BookingsBoard.tsx');
const { studioDaySlots, DEFAULT_DAYS } = await import('../src/schedule.ts');

// Monday 28 September 2026, 10:40 AM in Manila.
const NOW = Date.parse('2026-09-28T10:40:00+08:00');
const settings = {
  key: 'public', updatedAt: 1, eventActive: false, bookingEnabled: true,
  bookingDays: [...DEFAULT_DAYS], bookingDaySlots: studioDaySlots(),
  blockedDates: ['2026-09-30'],
  blockedDateSlots: { '2026-09-28': ['19:00', '19:45'] },
  events: [{ id: 'pop', eventDate: '2026-10-03', eventTitle: 'Night Market', eventHours: '', eventLocation: 'Somewhere', eventMapUrl: '', eventActive: true }],
};
const cartNotes = bookingCartNotes([
  { id: 'a', name: 'Helix', category: 'EAR', basePrice: 400, upgradeLabel: 'Surgical Steel', upgradePrice: 0, side: 'left' },
  { id: 'b', name: 'Lobe', category: 'EAR', basePrice: 300, upgradeLabel: 'Rhinestone Jewelry', upgradePrice: 50, side: 'both' },
  { id: 'c', name: 'Aftercare Solution', category: 'CUSTOM', basePrice: 150, notes: 'Pick up at the counter' },
], 'First piercing, a bit nervous');
const booking = (id, date, time, status, extra = {}) => ({
  id, name: extra.name ?? id, email: `${id}@example.com`, contact: extra.contact ?? '09171234567', notes: extra.notes ?? 'Lobe', date, time, status,
  createdAt: extra.createdAt ?? Date.parse('2026-09-20T09:00:00+08:00'), expiresAt: extra.expiresAt ?? 0,
  paidAt: status === 'confirmed' || status === 'payment_review' ? Date.parse('2026-09-20T09:02:00+08:00') : null,
  payment_id: status === 'confirmed' || status === 'payment_review' ? `pay_${id}` : null, amount: 10000, last_error: null,
});
const maya = booking('maya', '2026-09-28', '09:45', 'confirmed', { name: 'Maya Santos', notes: cartNotes });
const jo = booking('jo', '2026-09-28', '15:15', 'confirmed', { name: 'Jo Cruz', notes: 'No items selected — consultation only.' });
const hold = booking('hold', '2026-09-28', '16:00', 'pending', { name: 'Kai Reyes', expiresAt: NOW + 600000 });
const closedDay = booking('closed', '2026-09-30', '13:00', 'confirmed', { name: 'Ria Lim' });
const late = booking('late', '2026-09-29', '13:00', 'payment_review', { name: 'Late Payer' });
const expired = booking('gone', '2026-09-29', '09:00', 'expired', { name: 'Walked Away' });
const report = (extra = {}) => ({
  bookings: [expired, late], upcoming: [maya, jo, hold, closedDay], reviews: [late],
  notifications: [], totals: { payments: 4, grossCentavos: 40000, needsReview: 1 }, ...extra,
});

test('booking notes written by the cart are read back as items, totals and client notes', () => {
  const parsed = agenda.parseBookingNotes(cartNotes);
  assert.equal(parsed.structured, true);
  assert.deepEqual(parsed.items.map(i => [i.title, i.jewelry, i.estimate]), [
    ['Helix (left)', 'Surgical Steel', 400],
    ['Lobe (both ears)', 'Rhinestone Jewelry', 700],
    ['Aftercare Solution', 'No paid upgrade', 150],
  ]);
  assert.deepEqual(parsed.items[2].extra, ['Pick up at the counter']);
  assert.equal(parsed.total, 1250);
  assert.equal(parsed.clientNotes, 'First piercing, a bit nervous');
  assert.equal(agenda.servicesSummary(parsed), 'Helix (left) · Lobe (both ears) +1 more');
  assert.equal(agenda.parseBookingNotes('No items selected — consultation only.\nClient notes: Just asking').consultationOnly, true);
  const legacy = agenda.parseBookingNotes('Lobe please, both ears');
  assert.equal(legacy.structured, false);
  assert.equal(agenda.servicesSummary(legacy), 'Lobe please, both ears');
});

test('a day plan shows bookings at their time, merged open ranges, breaks and date blocks', () => {
  const plan = agenda.buildDayPlan('2026-09-28', [maya, jo, hold, closedDay], settings, '2026-09-28');
  const rows = plan.rows.map(r => r.kind === 'booking' ? `booking ${r.start} ${r.booking.id}` : `${r.kind} ${r.start}-${r.end}${'count' in r ? ` ×${r.count}` : ''}`);
  assert.deepEqual(rows, [
    'open 09:00-09:45 ×1',
    'booking 09:45 maya',
    'open 10:30-12:00 ×2',
    'break 12:00-13:00',
    'open 13:00-15:15 ×3',
    'booking 15:15 jo',
    'booking 16:00 hold',
    'open 16:45-19:00 ×3',
    'blocked 19:00-20:30 ×2',
  ]);
  assert.equal(plan.openCount, 9);
  assert.equal(plan.closed, null);
  const load = agenda.dayLoad('2026-09-28', [maya, jo, hold], settings, '2026-09-28');
  assert.deepEqual([load.booked, load.open, load.closed], [3, 9, false]);
});

test('closures made after a booking are flagged, but never for past dates or released slots', () => {
  const today = '2026-09-28';
  assert.equal(agenda.scheduleConflict(closedDay, settings, today), 'You blocked this whole date');
  assert.match(agenda.scheduleConflict(booking('p', '2026-10-03', '13:00', 'confirmed'), settings, today), /Pop-up day · Night Market/);
  assert.match(agenda.scheduleConflict(booking('s', '2026-10-04', '13:00', 'confirmed'), settings, today), /Sundays are closed/);
  assert.equal(agenda.scheduleConflict(booking('t', '2026-09-28', '19:00', 'confirmed'), settings, today), 'You blocked this time');
  assert.equal(agenda.scheduleConflict(booking('ok', '2026-09-29', '13:00', 'confirmed'), settings, today), null);
  assert.equal(agenda.scheduleConflict({ ...closedDay, status: 'cancelled' }, settings, today), null);
  assert.equal(agenda.scheduleConflict(closedDay, settings, '2026-10-01'), null, 'past appointments are history, not conflicts');
  const plan = agenda.buildDayPlan('2026-09-30', [closedDay], settings, today);
  assert.equal(plan.closed, 'You blocked this whole date');
  assert.deepEqual(plan.rows.map(r => r.kind), ['booking'], 'a closed date still lists the booking made before closing it');
});

test('merging keeps one row per booking and treats lapsed holds as expired', () => {
  const lapsed = booking('lapsed', '2026-09-28', '17:30', 'pending', { expiresAt: NOW - 1 });
  const merged = agenda.mergeBookings({ ...report(), bookings: [maya, lapsed], upcoming: [maya, lapsed] }, NOW);
  assert.equal(merged.filter(b => b.id === 'maya').length, 1);
  assert.equal(merged.find(b => b.id === 'lapsed').status, 'expired');
});

test('reminder text names the day, time and deposit terms', () => {
  const text = agenda.reminderMessage(maya, '2026-09-27');
  assert.match(text, /^Hi Maya! /);
  assert.match(text, /tomorrow, Monday, September 28 at 9:45 AM \(Philippine time\)/);
  assert.match(text, /₱100 deposit/);
  assert.match(text, /15 minutes or more late/);
  assert.match(agenda.reminderMessage(jo, '2026-09-20'), /appointment on Monday, September 28 at 3:15 PM/);
});

/* ─────────── Rendered board ─────────── */

let root;
let container;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
after(() => dom.window.close());
const props = (extra = {}) => ({ report: report(), settings, now: NOW, busy: false, canLoadMore: false, onLoadMore: () => {}, onCancel: () => {}, onImportLegacy: () => {}, onSyncCalendar: () => {}, ...extra });
async function render(extra) { await act(async () => root.render(React.createElement(BookingsBoard, props(extra)))); }
const buttons = () => [...container.querySelectorAll('button')];
const button = (text) => buttons().find(b => b.textContent.includes(text));
async function click(element) { assert.ok(element); await act(async () => element.click()); }

test('schedule opens on today with who is next, open time and a load count per day', async () => {
  await render();
  const text = container.textContent;
  assert.match(text, /Monday, September 28, 2026/);
  assert.match(text, /Up nextJo Cruz/);
  assert.match(text, /3 appointments · 2h 15m · 9 open slots/);
  assert.match(text, /Break · 12:00 PM – 1:00 PM/);
  assert.match(text, /Blocked by you · 2 slots/);
  assert.match(text, /Paying now · 10 min left/);
  const todayChip = container.querySelector('[aria-label^="Monday, September 28: 3 booked, 9 open"]');
  assert.ok(todayChip, 'day chip announces its load');
  assert.equal(todayChip.getAttribute('aria-pressed'), 'true');
  assert.match(todayChip.textContent, /3\/12/);
  assert.match(container.querySelector('[aria-label^="Wednesday, September 30"]').getAttribute('aria-label'), /needs attention/);
  // Maya's 9:45 appointment already ended, so the now marker sits before the next open range.
  const items = [...container.querySelectorAll('ol > li')];
  assert.match(items[2].textContent, /^Now/);
});

test('expanding a booking shows services, balance, client notes and contact actions', async () => {
  let cancelled;
  await render({ onCancel: b => { cancelled = b; } });
  const row = buttons().find(b => b.getAttribute('aria-expanded') === 'false' && b.textContent.includes('Maya Santos'));
  assert.match(row.textContent, /Helix \(left\) · Lobe \(both ears\) \+1 more/);
  assert.match(row.textContent, /₱1,250/);
  await click(row);
  const details = container.querySelector('#booking-maya');
  assert.ok(details);
  assert.match(details.textContent, /Balance to collect≈ ₱1,150/);
  assert.match(details.textContent, /First piercing, a bit nervous/);
  assert.equal(details.querySelector('a[href="mailto:maya@example.com"]').textContent, 'maya@example.com');
  assert.ok(!button('Cancel booking') || !details.contains(button('Cancel booking')), 'a finished appointment cannot be cancelled from here');
  await click(buttons().find(b => b.textContent.includes('Jo Cruz') && b.getAttribute('aria-expanded') === 'false'));
  assert.match(container.querySelector('#booking-jo').textContent, /Consultation only/);
  await click(button('Cancel booking'));
  assert.equal(cancelled.id, 'jo');
});

test('attention strip jumps to closed-date bookings and late payments', async () => {
  await render();
  const strip = container.querySelector('[aria-label="Needs attention"]');
  assert.match(strip.textContent, /1 booking is on a date or time you’ve since closed — next: Ria Lim/);
  assert.match(strip.textContent, /1 payment arrived after the hold expired/);
  await click([...strip.querySelectorAll('button')][0]);
  assert.match(container.textContent, /Wednesday, September 30, 2026/);
  assert.match(container.querySelector('#booking-closed').textContent, /You blocked this whole date\. The booking is still valid/);
  await click([...container.querySelector('[aria-label="Needs attention"]').querySelectorAll('button')][1]);
  assert.equal(container.querySelector('[role="tab"][aria-selected="true"]').textContent, 'All bookings');
  assert.equal(button('Paid late').getAttribute('aria-pressed'), 'true');
  assert.match(container.querySelector('#record-late').textContent, /no slot was reserved/);
});

test('records search every loaded booking, including notes, with status filters', async () => {
  await render();
  await click(button('All bookings'));
  const search = container.querySelector('input[type="search"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(search, 'helix');
    search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  const region = () => container.querySelector('[aria-label="Booking records"]');
  assert.equal(region().querySelectorAll('article').length, 1);
  assert.match(region().textContent, /Maya Santos/);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(search, '');
    search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await click(button('Expired'));
  assert.deepEqual([...region().querySelectorAll('h4')].map(h => h.textContent), ['Walked Away']);
});

test('older Workers without the agenda still render from loaded records, with a deploy hint', async () => {
  await render({ report: { ...report(), upcoming: undefined, reviews: undefined, bookings: [maya, expired] } });
  assert.match(container.textContent, /Maya Santos/);
  assert.match(container.textContent, /Deploy the updated booking Worker/);
});

/* ─────────── Social media contact ─────────── */

test('social media contact accepts handles and profile links, and rejects phone numbers as usernames', () => {
  assert.deepEqual(social.socialContact('instagram', '@maya.santos'), { value: 'Instagram: @maya.santos' });
  assert.deepEqual(social.socialContact('instagram', 'https://www.instagram.com/maya.santos/?hl=en'), { value: 'Instagram: @maya.santos' });
  assert.deepEqual(social.socialContact('tiktok', 'maya_s'), { value: 'TikTok: @maya_s' });
  assert.deepEqual(social.socialContact('facebook', '  Maya   Santos '), { value: 'Facebook: Maya Santos' });
  assert.deepEqual(social.socialContact('other', 'Telegram @maya'), { value: 'Other: Telegram @maya' });
  assert.match(social.socialContact('instagram', '0917 123 4567').error, /valid Instagram username/);
  assert.match(social.socialContact('facebook', ' ').error, /add your social media/);
  assert.ok(social.socialContact('other', 'x'.repeat(60)).value.length <= 80, 'fits the Worker contact limit');
});

test('staff profile links are built only for safe, recognised accounts', () => {
  assert.deepEqual(social.socialProfileLink('Instagram: @maya.santos'), { label: 'Open Instagram', href: 'https://www.instagram.com/maya.santos/' });
  assert.equal(social.socialProfileLink('@maya').href, 'https://www.instagram.com/maya/', 'older bookings asked for an Instagram handle');
  assert.equal(social.socialProfileLink('TikTok: @maya_s').href, 'https://www.tiktok.com/@maya_s');
  assert.equal(social.socialProfileLink('Facebook: facebook.com/maya.santos').href, 'https://facebook.com/maya.santos');
  assert.equal(social.socialProfileLink('Facebook: https://m.me/maya.santos').href, 'https://m.me/maya.santos');
  assert.equal(social.socialProfileLink('Facebook: Maya Santos').href, 'https://www.facebook.com/search/people/?q=Maya%20Santos');
  assert.match(social.socialProfileLink('Facebook: https://evil.example/facebook.com/x').href, /^https:\/\/www\.facebook\.com\/search\//, 'other hosts are never linked directly');
  assert.equal(social.socialProfileLink('09171234567'), null);
  assert.equal(social.socialProfileLink('Other: Telegram @maya'), null);
});

test('booking details link to the customer’s social profile', async () => {
  const ig = booking('ig', '2026-09-28', '13:00', 'confirmed', { name: 'Ivy Gomez', contact: 'Instagram: @ivy.gomez' });
  await render({ report: { ...report(), upcoming: [ig] } });
  await click(buttons().find(b => b.getAttribute('aria-expanded') === 'false' && b.textContent.includes('Ivy Gomez')));
  const link = container.querySelector('#booking-ig a[href="https://www.instagram.com/ivy.gomez/"]');
  assert.ok(link);
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  assert.match(link.textContent, /Open Instagram/);
});

/* ─────────── Google Calendar status ─────────── */

test('calendar bar asks for a sync when upcoming bookings are missing, and details show each state', async () => {
  let synced = 0;
  await render({ onSyncCalendar: () => { synced++; }, report: { ...report(), calendar: [{ booking_id: 'jo', status: 'sent', last_error: null }] } });
  const bar = () => [...container.querySelectorAll('[role="status"]')].find(el => el.textContent.includes('Google Calendar'));
  assert.match(bar().textContent, /1 upcoming booking isn’t on your calendar yet/, 'Ria Lim (Sep 30) predates calendar sync');
  await click(button('Sync to Google Calendar'));
  assert.equal(synced, 1);
  await click(buttons().find(b => b.getAttribute('aria-expanded') === 'false' && b.textContent.includes('Jo Cruz')));
  assert.match(container.querySelector('#booking-jo').textContent, /Google Calendar\s*On Google Calendar/);
  await click(buttons().find(b => b.getAttribute('aria-expanded') === 'false' && b.textContent.includes('Maya Santos')));
  assert.doesNotMatch(container.querySelector('#booking-maya').textContent, /Google Calendar/, 'finished appointments show no calendar row');
});

test('calendar setup problems surface in the attention strip; all-synced stays quiet', async () => {
  const retrying = [{ booking_id: 'jo', status: 'pending', last_error: 'calendar_not_configured' }, { booking_id: 'closed', status: 'pending', last_error: 'calendar_not_configured' }];
  await render({ report: { ...report(), calendar: retrying } });
  assert.match(container.querySelector('[aria-label="Needs attention"]').textContent, /2 bookings couldn’t be added to Google Calendar yet/);
  assert.match(container.textContent, /Google Calendar · isn’t set up yet\. Run setupCalendar/);
  const allSent = [{ booking_id: 'jo', status: 'sent', last_error: null }, { booking_id: 'closed', status: 'sent', last_error: null }];
  await render({ report: { ...report(), calendar: allSent } });
  assert.match(container.textContent, /Google Calendar · all 2 upcoming bookings are on your calendar/);
  assert.ok(button('Sync again'));
  assert.doesNotMatch(container.querySelector('[aria-label="Needs attention"]').textContent, /Google Calendar/);
});
