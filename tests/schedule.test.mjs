import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DAYS,
  DEFAULT_DAY_SLOTS,
  DEFAULT_SLOTS,
  SLOT_INTERVAL_MINUTES,
  flattenDaySlots,
  slotRangesLabel,
  slotsForDay,
  studioDaySlots,
  studioHoursLabel,
  studioSlotsForDay,
} from '../src/schedule.ts';
import {
  DEFAULT_DAYS as WORKER_DAYS,
  DEFAULT_DAY_SLOTS as WORKER_DAY_SLOTS,
  POLICY,
  SLOT_INTERVAL_MINUTES as WORKER_INTERVAL,
  slotsForDay as workerSlotsForDay,
  validateSchedule,
} from '../backend/worker.mjs';
import { RESERVATION_POLICY } from '../src/bookingApi.ts';
import { validateSettings } from '../src/validation.ts';

const WEEKDAY_SLOTS = [
  '09:00', '09:45', '10:30', '11:15',
  '13:00', '13:45', '14:30', '15:15', '16:00', '16:45', '17:30', '18:15', '19:00', '19:45',
];
const SATURDAY_SLOTS = ['13:00', '13:45', '14:30', '15:15', '16:00', '16:45'];
const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

test('studio grid runs Monday to Friday 9 AM to 8 PM with a one-hour noon break', () => {
  assert.equal(SLOT_INTERVAL_MINUTES, 45);
  for (const day of [1, 2, 3, 4, 5]) {
    assert.deepEqual(studioSlotsForDay(day), WEEKDAY_SLOTS, `weekday ${day}`);
  }
  assert.deepEqual(DEFAULT_DAY_SLOTS['1'], WEEKDAY_SLOTS);
  // The lunch break is respected: the last morning slot ends exactly at 12:00 and
  // nothing is offered inside 12:00–1:00 PM.
  assert.equal(WEEKDAY_SLOTS[3], '11:15');
  assert.equal(minutes(WEEKDAY_SLOTS[3]) + SLOT_INTERVAL_MINUTES, 12 * 60);
  assert.equal(WEEKDAY_SLOTS[4], '13:00');
  assert.ok(WEEKDAY_SLOTS.every((slot) => minutes(slot) < 12 * 60 || minutes(slot) >= 13 * 60));
  assert.equal(SATURDAY_SLOTS[0], '13:00', 'Saturday has no noon slot to break');
});

test('Saturday closes at 5 PM and Sunday is closed', () => {
  assert.deepEqual(studioSlotsForDay(6), SATURDAY_SLOTS);
  assert.deepEqual(studioSlotsForDay(0), [], 'Sunday has no bookable slot');
  assert.equal(DEFAULT_DAY_SLOTS['0'], undefined);
  assert.deepEqual(DEFAULT_DAYS, [1, 2, 3, 4, 5, 6]);
});

test('every slot inside a block steps by exactly one interval', () => {
  for (const slots of [WEEKDAY_SLOTS, SATURDAY_SLOTS]) {
    for (let i = 1; i < slots.length; i++) {
      const gap = minutes(slots[i]) - minutes(slots[i - 1]);
      // 105 minutes is the single noon-break jump (11:15 → 13:00).
      assert.ok(gap === SLOT_INTERVAL_MINUTES || gap === 105, `${slots[i - 1]} → ${slots[i]} must step by 45 minutes or cross the break`);
    }
  }
  assert.equal(DEFAULT_SLOTS[0], '09:00');
  assert.equal(DEFAULT_SLOTS[DEFAULT_SLOTS.length - 1], '19:45');
});

test('studio hours and slot blocks read back as friendly labels', () => {
  assert.equal(studioHoursLabel(), 'Mon–Fri 9:00 AM – 12:00 PM, 1:00 PM – 8:00 PM · Sat 1:00 PM – 5:00 PM · Sun closed');
  assert.equal(slotRangesLabel(studioSlotsForDay(1)), '9:00 AM – 11:15 AM, 1:00 PM – 7:45 PM');
  assert.equal(slotRangesLabel(studioSlotsForDay(6)), '1:00 PM – 4:45 PM');
  assert.equal(slotRangesLabel(['13:00']), '1:00 PM', 'a lone slot prints without a range dash');
  assert.equal(slotRangesLabel([]), '');
});

test('saved per-weekday grids win over the legacy flat list and closed days disappear', () => {
  assert.deepEqual(slotsForDay(null, 6), SATURDAY_SLOTS, 'no settings uses the built-in grid');
  assert.deepEqual(slotsForDay({ bookingSlots: ['13:00'] }, 1), ['13:00'], 'legacy flat list still applies to every day');
  const grid = { bookingDaySlots: { '6': ['13:00'] }, bookingSlots: ['13:00', '14:00'] };
  assert.deepEqual(slotsForDay(grid, 6), ['13:00']);
  assert.deepEqual(slotsForDay(grid, 1), [], 'a weekday missing from the saved grid is closed');
});

test('flattening a per-weekday grid keeps the legacy fields in step', () => {
  assert.deepEqual(flattenDaySlots(studioDaySlots()), { days: [1, 2, 3, 4, 5, 6], slots: DEFAULT_SLOTS });
  assert.deepEqual(flattenDaySlots({ '1': ['10:00'], '6': [] }), { days: [1], slots: ['10:00'] });
  assert.deepEqual(flattenDaySlots({}), { days: [], slots: [] });
});

test('the booking worker mirrors the public studio grid exactly', () => {
  assert.equal(WORKER_INTERVAL, SLOT_INTERVAL_MINUTES);
  assert.deepEqual(WORKER_DAYS, DEFAULT_DAYS);
  assert.deepEqual(WORKER_DAY_SLOTS, { ...DEFAULT_DAY_SLOTS });
  for (const day of [0, 1, 6]) assert.deepEqual(workerSlotsForDay({}, day), studioSlotsForDay(day));
});

test('the worker accepts only studio slots and refuses the noon break and Sunday', () => {
  const now = Date.parse('2026-09-10T17:00:00Z'); // Friday 1 AM in Manila
  const at = (date, time) => Date.parse(`${date}T${time}:00+08:00`);
  // 2026-09-14 is a Monday, 2026-09-12 a Saturday, 2026-09-13 a Sunday.
  assert.equal(validateSchedule({}, '2026-09-14', '09:00', now), at('2026-09-14', '09:00'));
  assert.equal(validateSchedule({}, '2026-09-14', '11:15', now), at('2026-09-14', '11:15'));
  assert.equal(validateSchedule({}, '2026-09-14', '13:00', now), at('2026-09-14', '13:00'));
  assert.equal(validateSchedule({}, '2026-09-14', '19:45', now), at('2026-09-14', '19:45'));
  assert.equal(validateSchedule({}, '2026-09-12', '13:00', now), at('2026-09-12', '13:00'));
  for (const [date, time, why] of [
    ['2026-09-14', '12:00', 'noon break starts'],
    ['2026-09-14', '12:45', 'inside the noon break'],
    ['2026-09-14', '13:15', 'off the 45-minute grid'],
    ['2026-09-14', '20:00', 'past closing'],
    ['2026-09-12', '09:00', 'Saturday opens at 1 PM'],
    ['2026-09-13', '13:00', 'Sunday is closed'],
  ]) {
    assert.throws(() => validateSchedule({}, date, time, now), /no longer available|schedule/i, why);
  }
  assert.equal(validateSchedule({ bookingDaySlots: { '6': ['10:00'] } }, '2026-09-12', '10:00', now), at('2026-09-12', '10:00'));
  assert.throws(() => validateSchedule({ bookingDaySlots: { '6': ['10:00'] } }, '2026-09-14', '10:00', now));
});

test('deposit policy states the 24-hour refund window and the 15-minute late fee', () => {
  assert.equal(RESERVATION_POLICY, POLICY, 'Customer consent must match the server and receipt policy');
  assert.match(RESERVATION_POLICY, /at least 24 hours/);
  assert.match(RESERVATION_POLICY, /refund/);
  assert.match(RESERVATION_POLICY, /15 minutes or more/);
  assert.match(RESERVATION_POLICY, /cancellation or late fee/);
});

test('settings accept a per-weekday grid and reject malformed ones', () => {
  const base = { key: 'public', eventActive: false, updatedAt: 1 };
  const grid = { '1': ['09:00', '19:30'], '6': ['13:00'] };
  assert.deepEqual(validateSettings({ ...base, bookingDays: [1, 6], bookingDaySlots: grid }).bookingDaySlots, grid);
  assert.deepEqual(validateSettings({ ...base, bookingDays: [1, 6] }).bookingDays, [1, 6]);
  for (const bad of [
    { bookingDaySlots: { '7': ['09:00'] } },
    { bookingDaySlots: { '1': ['9:00'] } },
    { bookingDaySlots: { '1': ['13:00', '13:00'] } },
    { bookingDaySlots: { '1': '13:00' } },
    { bookingSlots: ['25:00'] },
    { bookingDays: [1, 1] },
    { bookingDays: [7] },
  ]) {
    assert.throws(() => validateSettings({ ...base, ...bad }), undefined, JSON.stringify(bad));
  }
});
