import type { PublicSettings } from './types';

/**
 * Studio booking grid.
 *
 * This module is the single source of truth for opening hours and appointment
 * spacing. `backend/worker.mjs` mirrors the same rules (it cannot import from
 * `src/`) and `tests/schedule.test.mjs` asserts the two stay identical.
 */

/** One appointment slot lasts (and reserves) this many minutes. */
export const SLOT_INTERVAL_MINUTES = 45;

export interface BookingWindow {
  /** 24-hour opening time, e.g. '09:00'. */
  open: string;
  /** 24-hour closing time, e.g. '20:00'. */
  close: string;
}

/**
 * Studio opening hours per weekday (0 = Sunday … 6 = Saturday) as one or more
 * appointment windows. An empty list means the studio is closed that day.
 *
 * Monday–Friday run 9:00 AM–8:00 PM with a **one-hour lunch break at noon**, so
 * the day is two windows and no appointment is booked across 12:00–1:00 PM. The
 * 45-minute grid therefore offers 09:00 → 11:15 before lunch (the 11:15 slot
 * ends exactly at 12:00) and 13:00 → 19:45 after it.
 */
export const STUDIO_HOURS: Record<number, BookingWindow[]> = {
  0: [], // Sunday — closed
  1: [{ open: '09:00', close: '12:00' }, { open: '13:00', close: '20:00' }],
  2: [{ open: '09:00', close: '12:00' }, { open: '13:00', close: '20:00' }],
  3: [{ open: '09:00', close: '12:00' }, { open: '13:00', close: '20:00' }],
  4: [{ open: '09:00', close: '12:00' }, { open: '13:00', close: '20:00' }],
  5: [{ open: '09:00', close: '12:00' }, { open: '13:00', close: '20:00' }],
  6: [{ open: '13:00', close: '17:00' }], // Saturday — 1:00 PM to 5:00 PM
};

/** Weekdays the studio accepts appointments on, Monday first. */
export const STUDIO_OPEN_DAYS: number[] = [1, 2, 3, 4, 5, 6];

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** '13:30' → '1:30 PM'. Unknown values are returned unchanged. */
export function format12Hour(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m < 10 ? '0' + m : m} ${ampm}`;
}

/** Full weekday name, e.g. 6 → 'Saturday'. */
export function dayName(day: number): string {
  return DAY_FULL[day] ?? String(day);
}

function toMinutes(time24: string): number {
  const [h, m] = time24.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.NaN;
  return h * 60 + m;
}

function toTime24(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
}

/**
 * Build the slot grid for one opening window. The first slot starts at the
 * opening time and each following slot is one interval later; the last slot is
 * the latest start that still falls inside the window, so a booking may run a
 * little past closing time (Mon–Fri 9:00 AM – 8:00 PM → last start 7:30 PM).
 */
export function slotsForWindow(window: BookingWindow, intervalMinutes = SLOT_INTERVAL_MINUTES): string[] {
  const open = toMinutes(window.open);
  const close = toMinutes(window.close);
  if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open || intervalMinutes <= 0) return [];
  const slots: string[] = [];
  for (let start = open; start < close; start += intervalMinutes) slots.push(toTime24(start));
  return slots;
}

/** Slot grid for one weekday; an empty list means the studio is closed. */
export function studioSlotsForDay(day: number): string[] {
  return (STUDIO_HOURS[day] ?? []).flatMap((window) => slotsForWindow(window));
}

/** Slot grid for the whole week, keyed by weekday number as a string. */
export function studioDaySlots(): Record<string, string[]> {
  return Object.fromEntries(STUDIO_OPEN_DAYS.map((day) => [String(day), studioSlotsForDay(day)]));
}

/** Built-in studio grid: Mon–Fri 45-minute slots, Saturday 45-minute slots. */
export const DEFAULT_DAY_SLOTS: Record<string, string[]> = studioDaySlots();

/** Every distinct studio slot, earliest first (legacy `bookingSlots` fallback). */
export const DEFAULT_SLOTS: string[] = [...new Set(Object.values(DEFAULT_DAY_SLOTS).flat())].sort();

/** Allowed days used when the saved settings carry no day list. */
export const DEFAULT_DAYS: number[] = [...STUDIO_OPEN_DAYS];

/**
 * Human summary of the built-in hours, grouping consecutive days that share a
 * window and joining each day's windows, e.g.
 * "Mon–Fri 9:00 AM – 12:00 PM, 1:00 PM – 8:00 PM · Sat 1:00 PM – 5:00 PM · Sun closed".
 */
export function studioHoursLabel(): string {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const sameHours = (a: BookingWindow[], b: BookingWindow[]) =>
    a.length === b.length && a.every((window, index) => window.open === b[index].open && window.close === b[index].close);
  const label = (windows: BookingWindow[]) =>
    windows.length === 0
      ? 'closed'
      : windows.map((window) => `${format12Hour(window.open)} – ${format12Hour(window.close)}`).join(', ');
  const parts: string[] = [];
  let index = 0;
  while (index < order.length) {
    const windows = STUDIO_HOURS[order[index]] ?? [];
    let last = index;
    while (last + 1 < order.length && sameHours(STUDIO_HOURS[order[last + 1]] ?? [], windows)) last += 1;
    const names = order.slice(index, last + 1).map((day) => DAY_SHORT[day]);
    const name = names.length > 1 ? `${names[0]}–${names[names.length - 1]}` : names[0];
    parts.push(`${name} ${label(windows)}`);
    index = last + 1;
  }
  return parts.join(' · ');
}

/**
 * Readable label for one day's actual slot list, grouping consecutive slots
 * into blocks so a lunch break shows up, e.g.
 * "9:00 AM – 11:15 AM, 1:00 PM – 7:45 PM". Labels are slot start times.
 */
export function slotRangesLabel(slots: string[]): string {
  if (slots.length === 0) return '';
  const blocks: string[][] = [];
  for (const slot of slots) {
    const block = blocks[blocks.length - 1];
    if (block && toMinutes(slot) - toMinutes(block[block.length - 1]) === SLOT_INTERVAL_MINUTES) block.push(slot);
    else blocks.push([slot]);
  }
  return blocks
    .map((block) => (block.length === 1 ? format12Hour(block[0]) : `${format12Hour(block[0])} – ${format12Hour(block[block.length - 1])}`))
    .join(', ');
}

/**
 * Slots a customer may pick on one weekday (0 = Sunday … 6 = Saturday).
 *
 * Resolution order:
 * 1. `bookingDaySlots` — the studio's explicit per-weekday grid. When this map
 *    exists, a weekday missing from it is closed and `bookingSlots` is ignored.
 * 2. `bookingSlots` — the legacy single list applied to every allowed day.
 * 3. The built-in studio hours above.
 */
export function slotsForDay(
  schedule: Pick<PublicSettings, 'bookingSlots' | 'bookingDaySlots'> | null | undefined,
  day: number
): string[] {
  const map = schedule?.bookingDaySlots;
  if (map && Object.keys(map).length > 0) return map[String(day)] ?? [];
  if (schedule?.bookingSlots?.length) return schedule.bookingSlots;
  return DEFAULT_DAY_SLOTS[String(day)] ?? [];
}

/**
 * Keep the derived legacy fields in step with a per-weekday map: the allowed
 * day list (days that have at least one slot) and the flat earliest-first list
 * older clients and staff reports still read.
 */
export function flattenDaySlots(map: Record<string, string[]>): { days: number[]; slots: string[] } {
  const days = Object.keys(map)
    .filter((key) => (map[key] ?? []).length > 0)
    .map(Number)
    .sort((a, b) => a - b);
  const slots = [...new Set(days.flatMap((day) => map[String(day)]))].sort();
  return { days, slots };
}
