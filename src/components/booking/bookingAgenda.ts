import type { PublicSettings } from '../../types';
import { DEFAULT_DAYS, SLOT_INTERVAL_MINUTES, format12Hour, slotEndTime, slotsForDate, slotsForDay, slotsOverlap, validSlotTime } from '../../schedule';
import { editableEvents } from '../../popupEvents';

/** Staff-only booking row returned by the Worker's `/admin/bookings` report. */
export type BookingStatus = 'creating' | 'pending' | 'confirmed' | 'expired' | 'payment_review' | 'cancelled';
export interface AdminBooking {
  id: string; name: string; email: string; contact: string; notes: string;
  date: string; time: string; status: BookingStatus;
  createdAt: number; expiresAt: number; paidAt: number | null;
  payment_id: string | null; amount: number; last_error: string | null;
  policy?: string;
}
export interface AdminNotification { booking_id: string; audience: string; kind: string; status: string; attempts?: number; last_error: string | null }
export interface AdminReport {
  /** Newest-created records (the ledger). */
  bookings: AdminBooking[];
  /** Slot holders by appointment date. Absent on Workers deployed before 2026-09-27. */
  upcoming?: AdminBooking[];
  /** Late payments that never secured a slot. Absent on older Workers. */
  reviews?: AdminBooking[];
  notifications: AdminNotification[];
  /** Google Calendar job per upcoming confirmed booking. Absent on Workers without calendar sync. */
  calendar?: { booking_id: string; status: string; last_error: string | null }[];
  totals: { payments: number; grossCentavos: number; needsReview: number | null };
}

/** Where an upcoming confirmed booking stands with the studio's Google Calendar. */
export type CalendarState = 'synced' | 'queued' | 'retrying' | 'missing';
export function calendarState(b: AdminBooking, report: AdminReport, now = Date.now()): CalendarState | null {
  if (!report.calendar || b.status !== 'confirmed' || appointmentStart(b) + 45 * 60000 <= now) return null;
  const job = report.calendar.find(j => j.booking_id === b.id);
  if (!job) return 'missing';
  if (job.status === 'sent') return 'synced';
  return job.last_error ? 'retrying' : 'queued';
}

const DAY_MS = 86400000;
const MANILA_OFFSET_MS = 28800000;
export const DEPOSIT_PESOS = 100;
/** Deposit policy: arriving this late turns the deposit into a late fee. */
export const LATE_GRACE_MINUTES = 15;

export const manilaToday = (now = Date.now()) => new Date(now + MANILA_OFFSET_MS).toISOString().slice(0, 10);
export const manilaMinutes = (now = Date.now()) => { const d = new Date(now + MANILA_OFFSET_MS); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
export const toMinutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
export const addMinutes = (time: string, minutes: number) => { const total = toMinutes(time) + minutes; return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; };
/** Epoch milliseconds of a Manila appointment start. */
export const appointmentStart = (b: Pick<AdminBooking, 'date' | 'time'>) => Date.parse(`${b.date}T${b.time}:00+08:00`);
export function countdown(target: number, now: number): string {
  const minutes = Math.round((target - now) / 60000);
  if (minutes <= 0) return 'now';
  if (minutes < 60) return `in ${minutes} min`;
  if (minutes < 1440) return `in ${formatDuration(minutes)}`;
  const days = Math.round(minutes / 1440);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
/** Calendar dates are formatted in UTC noon so the viewer's own timezone never shifts the day. */
export function formatDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-PH', { timeZone: 'UTC', ...options });
}
export const manilaStamp = (value: number | null | undefined) => value
  ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
  : '—';
export const timeRange = (time: string) => `${format12Hour(time)} – ${format12Hour(slotEndTime(time))}`;
export const peso = (value: number) => `₱${value.toLocaleString('en-PH')}`;
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}
export function relativeDay(date: string, today: string): string {
  const diff = Math.round((Date.parse(date) - Date.parse(today)) / DAY_MS);
  return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : formatDate(date, { weekday: 'long' });
}

export const holdsSlot = (b: AdminBooking) => b.status === 'confirmed' || b.status === 'pending' || b.status === 'creating';
export const isHolding = (b: AdminBooking) => b.status === 'pending' || b.status === 'creating';

export const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: 'Confirmed',
  pending: 'Paying now',
  creating: 'Paying now',
  payment_review: 'Paid late',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

/**
 * One list of everything loaded, newest report first. Unpaid holds whose
 * checkout window has passed are shown as expired until the next refresh
 * confirms it, so a stale hold never looks like a real appointment.
 */
export function mergeBookings(report: AdminReport, now = Date.now()): AdminBooking[] {
  const byId = new Map<string, AdminBooking>();
  for (const b of [...(report.upcoming ?? []), ...(report.reviews ?? []), ...report.bookings]) {
    if (!byId.has(b.id)) byId.set(b.id, isHolding(b) && b.expiresAt && b.expiresAt <= now ? { ...b, status: 'expired' } : b);
  }
  return [...byId.values()];
}

/* ────────────── Booking notes (see cartSnapshot.bookingCartNotes) ────────────── */

export interface NoteItem { title: string; jewelry: string; estimate: number | null; extra: string[] }
export interface ParsedNotes { structured: boolean; consultationOnly: boolean; items: NoteItem[]; total: number | null; clientNotes: string; raw: string }

/** Reads the cart summary the booking page writes; unknown/older notes fall back to raw text. */
export function parseBookingNotes(notes: string | null | undefined): ParsedNotes {
  const raw = (notes ?? '').trim();
  const result: ParsedNotes = { structured: false, consultationOnly: false, items: [], total: null, clientNotes: '', raw };
  const lines = raw.split(/\r?\n/);
  const head = lines[0]?.trim() ?? '';
  const selected = /^Selected items \((\d+)\):$/.exec(head);
  if (!selected && head !== 'No items selected — consultation only.') return result;
  const totalIndex = lines.findIndex(line => /^Total estimate: ₱[\d,.]+$/.test(line.trim()));
  const clientIndex = lines.findIndex((line, index) => index > Math.max(0, totalIndex) && line.startsWith('Client notes: '));
  if (clientIndex >= 0) result.clientNotes = [lines[clientIndex].slice('Client notes: '.length), ...lines.slice(clientIndex + 1)].join('\n').trim();
  result.structured = true;
  if (!selected) { result.consultationOnly = true; return result; }
  if (totalIndex < 0) { result.structured = false; return result; }
  result.total = Number(lines[totalIndex].trim().slice('Total estimate: ₱'.length).replaceAll(',', ''));
  let current: NoteItem | undefined;
  for (const line of lines.slice(1, totalIndex)) {
    const item = /^(\d+)\. (.+)$/.exec(line);
    const detail = /^Piercing\/service: ₱[\d,.]+ · Jewelry: (.+) \(₱[\d,.]+\) · Line estimate: ₱([\d,.]+)$/.exec(line);
    if (item && Number(item[1]) === result.items.length + 1) {
      current = { title: item[2].replace(' · 2×', ''), jewelry: '', estimate: null, extra: [] };
      result.items.push(current);
    } else if (current && detail && current.estimate === null) {
      current.jewelry = detail[1];
      current.estimate = Number(detail[2].replaceAll(',', ''));
    } else if (current && line.trim()) current.extra.push(line.trim());
  }
  if (!result.items.length) result.structured = false;
  return result;
}

export function servicesSummary(parsed: ParsedNotes): string {
  if (parsed.consultationOnly) return 'Consultation only';
  if (!parsed.structured) return parsed.raw ? parsed.raw.split(/\r?\n/)[0] : 'No details';
  const [first, second, ...rest] = parsed.items.map(item => item.title);
  return [first, second].filter(Boolean).join(' · ') + (rest.length ? ` +${rest.length} more` : '');
}

/* ────────────── Schedule awareness ────────────── */

function popupOn(settings: PublicSettings, date: string) {
  return editableEvents(settings).find(e => e.eventActive && e.eventDate <= date && (e.eventEndDate || e.eventDate) >= date);
}

/** Why the studio's current schedule no longer allows this date, or null when open. */
export function closedReason(settings: PublicSettings | null | undefined, date: string): string | null {
  if (!settings) return null;
  const event = popupOn(settings, date);
  if (event) return `Pop-up day${event.eventTitle ? ` · ${event.eventTitle}` : ''}`;
  if (settings.blockedDates?.includes(date)) return 'You blocked this whole date';
  const day = weekdayOf(date);
  if (!(settings.bookingDays ?? DEFAULT_DAYS).includes(day) || !slotsForDay(settings, day).length) return `${formatDate(date, { weekday: 'long' })}s are closed in your weekly schedule`;
  return null;
}

/**
 * Upcoming slot holders whose date or time was closed after they booked.
 * Closing a date never cancels a paid booking, so staff must decide what to do.
 */
export function scheduleConflict(b: AdminBooking, settings: PublicSettings | null | undefined, today: string): string | null {
  if (!settings || !holdsSlot(b) || b.date < today) return null;
  const closed = closedReason(settings, b.date);
  if (closed) return closed;
  if (settings.blockedDateSlots?.[b.date]?.some(time => slotsOverlap(time, b.time))) return 'You blocked this time';
  return null;
}

export type TimelineRow =
  | { kind: 'booking'; start: string; end: string; booking: AdminBooking; conflict: string | null }
  | { kind: 'open' | 'blocked'; start: string; end: string; count: number }
  | { kind: 'break'; start: string; end: string };

export interface DayPlan {
  date: string;
  rows: TimelineRow[];
  bookings: AdminBooking[];
  openCount: number;
  closed: string | null;
}

/**
 * The staff's view of one date: every appointment at its real time, the
 * remaining open slots merged into ranges, date-only blocks and breaks.
 * Bookings at times no longer on the grid are still shown where they are.
 */
export function buildDayPlan(date: string, all: AdminBooking[], settings: PublicSettings | null | undefined, today: string): DayPlan {
  const bookings = all.filter(b => b.date === date && holdsSlot(b)).sort((a, b) => a.time.localeCompare(b.time) || a.createdAt - b.createdAt);
  const closed = closedReason(settings, date);
  const weekly = closed || !settings ? [] : slotsForDay(settings, weekdayOf(date)).filter(validSlotTime);
  const open = closed || !settings ? [] : slotsForDate(settings, date);
  const free = (slot: string) => !bookings.some(b => slotsOverlap(slot, b.time));
  type Row = Exclude<TimelineRow, { kind: 'break' }>;
  const items: Row[] = [
    ...bookings.map(b => ({ kind: 'booking' as const, start: b.time, end: slotEndTime(b.time), booking: b, conflict: scheduleConflict(b, settings, today) })),
    ...open.filter(free).map(slot => ({ kind: 'open' as const, start: slot, end: slotEndTime(slot), count: 1 })),
    ...weekly.filter(slot => !open.includes(slot) && free(slot)).map(slot => ({ kind: 'blocked' as const, start: slot, end: slotEndTime(slot), count: 1 })),
  ].sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || Number(a.kind !== 'booking') - Number(b.kind !== 'booking'));
  const rows: TimelineRow[] = [];
  for (const item of items) {
    const previous = rows.at(-1);
    const gap = previous ? toMinutes(item.start) - toMinutes(previous.end) : 0;
    if (previous && gap >= 30) rows.push({ kind: 'break', start: previous.end, end: item.start });
    const last = rows.at(-1);
    // Consecutive open (or blocked) slots read better as one range.
    if ((last?.kind === 'open' || last?.kind === 'blocked') && last.kind === item.kind && gap < SLOT_INTERVAL_MINUTES) {
      rows[rows.length - 1] = { ...last, end: item.end, count: last.count + 1 };
    } else rows.push(item);
  }
  return { date, rows, bookings, openCount: open.filter(free).length, closed };
}

export interface DayLoad { date: string; booked: number; open: number; closed: boolean; conflict: boolean }
export function dayLoad(date: string, all: AdminBooking[], settings: PublicSettings | null | undefined, today: string): DayLoad {
  const plan = buildDayPlan(date, all, settings, today);
  return { date, booked: plan.bookings.length, open: plan.openCount, closed: Boolean(plan.closed), conflict: plan.rows.some(r => r.kind === 'booking' && r.conflict) };
}

/** A friendly reminder the staff can paste into IG, Messenger or SMS. */
export function reminderMessage(b: AdminBooking, today: string): string {
  const first = b.name.trim().split(/\s+/)[0] || 'there';
  const day = b.date === today ? 'today' : b.date === shiftDate(today, 1) ? 'tomorrow' : 'on';
  const when = `${day === 'on' ? 'on ' : `${day}, `}${formatDate(b.date, { weekday: 'long', month: 'long', day: 'numeric' })} at ${format12Hour(b.time)}`;
  return `Hi ${first}! This is Punkture Studios — a friendly reminder of your appointment ${when} (Philippine time). Your ₱${DEPOSIT_PESOS} deposit is already applied to your final total. Arriving ${LATE_GRACE_MINUTES} minutes or more late uses the deposit as a late fee, and if you need to reschedule, please message us at least 24 hours ahead. See you!`;
}
