import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Coffee, ListFilter, MessageSquareText, Search, Wallet } from 'lucide-react';
import type { PublicSettings } from '../../types';
import { format12Hour, slotEndTime } from '../../schedule';
import { BookingDetails } from './BookingDetails';
import {
  STATUS_LABEL, appointmentStart, buildDayPlan, countdown, dayLoad, formatDate, formatDuration, holdsSlot, isHolding,
  manilaMinutes, manilaStamp, manilaToday, mergeBookings, parseBookingNotes, peso, relativeDay, scheduleConflict, servicesSummary,
  shiftDate, toMinutes,
  type AdminBooking, type AdminReport, type TimelineRow,
} from './bookingAgenda';

type BoardTab = 'schedule' | 'records' | 'payments';
type RecordFilter = 'all' | 'confirmed' | 'holding' | 'payment_review' | 'expired' | 'cancelled';
const RECORD_FILTERS: { id: RecordFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'holding', label: 'Paying now' },
  { id: 'payment_review', label: 'Paid late' },
  { id: 'expired', label: 'Expired' },
  { id: 'cancelled', label: 'Cancelled' },
];
const STRIP_DAYS = 14;
const byStart = (a: AdminBooking, b: AdminBooking) => appointmentStart(a) - appointmentStart(b);

const TONE = {
  confirmed: { color: '#34d399', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.32)' },
  holding: { color: '#fbbf24', bg: 'rgba(217,119,6,0.14)', border: 'rgba(217,119,6,0.32)' },
  review: { color: '#fdba74', bg: 'rgba(249,115,22,0.14)', border: 'rgba(249,115,22,0.32)' },
  cancelled: { color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  neutral: { color: 'var(--color-text-muted)', bg: 'rgba(255,255,255,0.05)', border: 'var(--color-border)' },
};
const toneOf = (b: AdminBooking) => b.status === 'confirmed' ? TONE.confirmed
  : isHolding(b) ? TONE.holding
    : b.status === 'payment_review' ? TONE.review
      : b.status === 'cancelled' ? TONE.cancelled : TONE.neutral;

const chipClass = 'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]';
const ghostButton = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-body-xs font-semibold transition-colors hover:bg-white/5';
const muted = { color: 'var(--color-text-muted)' };
// Softer than muted but still readable on the dark surface (the faint token is for disabled text).
const faint = { color: 'rgba(136,146,170,0.72)' };

function StatusChip({ booking, now }: { booking: AdminBooking; now: number }) {
  const tone = toneOf(booking);
  const minutesLeft = Math.max(1, Math.ceil((booking.expiresAt - now) / 60000));
  return <span className={chipClass} style={{ color: tone.color, background: tone.bg, border: `1px solid ${tone.border}` }}>
    {isHolding(booking) ? `Paying now · ${minutesLeft} min left` : STATUS_LABEL[booking.status]}
  </span>;
}

export interface BookingsBoardProps {
  report: AdminReport;
  settings: PublicSettings | null | undefined;
  now: number;
  busy: boolean;
  canLoadMore: boolean;
  onLoadMore: () => void;
  onCancel: (booking: AdminBooking) => void;
  onImportLegacy: () => void;
}

/**
 * Staff view of online bookings: a day-by-day schedule for time management,
 * the full searchable record list, and deposit/payment housekeeping.
 */
export function BookingsBoard({ report, settings, now, busy, canLoadMore, onLoadMore, onCancel, onImportLegacy }: BookingsBoardProps) {
  const today = manilaToday(now);
  const all = useMemo(() => mergeBookings(report, now), [report, now]);
  const [tab, setTab] = useState<BoardTab>('schedule');
  const [selected, setSelected] = useState(today);
  const [stripStart, setStripStart] = useState(today);
  const [expanded, setExpanded] = useState<string | null>(null);

  const conflicts = all.filter(b => scheduleConflict(b, settings, today)).sort(byStart);
  const reviews = all.filter(b => b.status === 'payment_review');
  const emailIssues = report.notifications.filter(n => n.status === 'needs_review' || Boolean(n.last_error));
  const toggle = (id: string) => setExpanded(current => current === id ? null : id);

  function goToDate(date: string) {
    setSelected(date);
    setStripStart(start => date >= start && date < shiftDate(start, STRIP_DAYS) ? start : date);
  }
  function showInSchedule(b: AdminBooking) {
    setTab('schedule');
    goToDate(b.date);
    setExpanded(b.id);
  }

  const tabs: { id: BoardTab; label: string; icon: ReactNode }[] = [
    { id: 'schedule', label: 'Schedule', icon: <CalendarDays size={14} aria-hidden="true" /> },
    { id: 'records', label: 'All bookings', icon: <ListFilter size={14} aria-hidden="true" /> },
    { id: 'payments', label: 'Payments', icon: <Wallet size={14} aria-hidden="true" /> },
  ];

  return <div className="space-y-4">
    {(conflicts.length > 0 || reviews.length > 0 || emailIssues.length > 0) && <div role="region" aria-label="Needs attention" className="rounded-2xl p-3 space-y-1"
      style={{ background: 'var(--color-warn-bg)', border: '1px solid var(--color-warn-ring)' }}>
      <p className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--color-warn-text)' }}>
        <AlertTriangle size={12} aria-hidden="true" /> Needs attention
      </p>
      {conflicts.length > 0 && <AttentionItem onClick={() => showInSchedule(conflicts[0])} action="Review">
        {conflicts.length} booking{conflicts.length === 1 ? ' is' : 's are'} on a date or time you’ve since closed — next: {conflicts[0].name}, {formatDate(conflicts[0].date, { weekday: 'short', month: 'short', day: 'numeric' })} · {format12Hour(conflicts[0].time)}
      </AttentionItem>}
      {reviews.length > 0 && <AttentionItem onClick={() => { setTab('records'); setExpanded(reviews[0].id); }} action="Review">
        {reviews.length} payment{reviews.length === 1 ? '' : 's'} arrived after the hold expired — no slot was reserved
      </AttentionItem>}
      {emailIssues.length > 0 && <AttentionItem onClick={() => setTab('payments')} action="Check">
        {emailIssues.length} confirmation email{emailIssues.length === 1 ? '' : 's'} may not have been delivered
      </AttentionItem>}
    </div>}

    <div role="tablist" aria-label="Booking views" className="grid grid-cols-3 gap-1 p-1 rounded-xl sm:inline-grid"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>
      {tabs.map(t => <button key={t.id} type="button" role="tab" id={`bookings-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`bookings-panel-${t.id}`}
        onClick={() => setTab(t.id)}
        className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-body-xs font-bold transition-colors sm:px-3"
        style={tab === t.id ? { background: 'rgba(255,255,255,0.1)', color: '#fff' } : muted}>
        <span className="hidden sm:inline-flex">{t.icon}</span>{t.label}
      </button>)}
    </div>

    <div role="tabpanel" id={`bookings-panel-${tab}`} aria-labelledby={`bookings-tab-${tab}`}>
      {tab === 'schedule' && <ScheduleView all={all} settings={settings} now={now} today={today} selected={selected} stripStart={stripStart}
        onSelect={goToDate} onShiftWeek={days => { setStripStart(start => shiftDate(start, days)); setSelected(date => shiftDate(date, days)); }}
        onToday={() => { setStripStart(today); setSelected(today); }}
        expanded={expanded} onToggle={toggle} busy={busy} onCancel={onCancel} onOpen={showInSchedule} complete={Boolean(report.upcoming)} />}
      {tab === 'records' && <RecordsView all={all} settings={settings} now={now} today={today} expanded={expanded} onToggle={toggle} busy={busy}
        onCancel={onCancel} onShowInSchedule={showInSchedule} canLoadMore={canLoadMore} onLoadMore={onLoadMore} initialFilter={reviews.some(b => b.id === expanded) ? 'payment_review' : 'all'} />}
      {tab === 'payments' && <PaymentsView report={report} all={all} busy={busy} onImportLegacy={onImportLegacy} />}
    </div>
  </div>;
}

function AttentionItem({ children, action, onClick }: { children: ReactNode; action: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left text-body-xs transition-colors hover:bg-white/5"
    style={{ color: '#fde68a' }}>
    <span className="min-w-0">{children}</span>
    <span className="shrink-0 font-bold underline underline-offset-2">{action}</span>
  </button>;
}

/* ─────────────────────────── Schedule ─────────────────────────── */

function ScheduleView({ all, settings, now, today, selected, stripStart, onSelect, onShiftWeek, onToday, expanded, onToggle, busy, onCancel, onOpen, complete }: {
  all: AdminBooking[]; settings: PublicSettings | null | undefined; now: number; today: string; selected: string; stripStart: string;
  onSelect: (date: string) => void; onShiftWeek: (days: number) => void; onToday: () => void;
  expanded: string | null; onToggle: (id: string) => void; busy: boolean; onCancel: (b: AdminBooking) => void; onOpen: (b: AdminBooking) => void;
  complete: boolean;
}) {
  const days = Array.from({ length: STRIP_DAYS }, (_, i) => shiftDate(stripStart, i));
  const plan = buildDayPlan(selected, all, settings, today);
  const nowMinutes = manilaMinutes(now);
  const confirmed = all.filter(b => b.status === 'confirmed').sort(byStart);
  const inSession = confirmed.find(b => b.date === today && toMinutes(b.time) <= nowMinutes && nowMinutes < toMinutes(b.time) + 45);
  const next = confirmed.find(b => appointmentStart(b) > now);
  const nextAfterSelected = confirmed.find(b => b.date > selected);
  const eyebrow = selected === today ? 'Today' : selected === shiftDate(today, 1) ? 'Tomorrow' : selected === shiftDate(today, -1) ? 'Yesterday' : '';
  const isPast = selected < today;
  const booked = plan.bookings.length;

  // Place a "now" marker between rows (today only); a running appointment is highlighted instead.
  const current = (row: TimelineRow) => selected === today && toMinutes(row.start) <= nowMinutes && nowMinutes < toMinutes(row.end);
  const showNowLine = selected === today && plan.rows.length > 0 && !plan.rows.some(r => r.kind === 'booking' && current(r))
    && nowMinutes >= toMinutes(plan.rows[0].start) && nowMinutes < toMinutes(plan.rows.at(-1)!.end);
  const nowIndex = showNowLine ? plan.rows.findIndex(r => toMinutes(r.end) > nowMinutes) : -1;

  return <div className="space-y-4">
    {(inSession || next) && <div className="grid gap-2 sm:grid-cols-2">
      {inSession && <HeadsUp label="In session" tone="brand" onClick={() => onOpen(inSession)}
        title={inSession.name} detail={`${format12Hour(inSession.time)} – ${format12Hour(slotEndTime(inSession.time))}`} />}
      {next && <HeadsUp label="Up next" tone="neutral" onClick={() => onOpen(next)} title={next.name}
        detail={`${relativeDay(next.date, today)} · ${format12Hour(next.time)} · ${countdown(appointmentStart(next), now)}`} />}
    </div>}

    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-xs font-semibold" style={muted}>
          {formatDate(days[0], { month: 'short', day: 'numeric' })} – {formatDate(days[STRIP_DAYS - 1], { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
        <div className="flex items-center gap-1">
          {selected !== today && <button type="button" onClick={onToday} className={ghostButton} style={{ color: 'var(--color-brand-text)' }}>Today</button>}
          <button type="button" aria-label="Previous week" onClick={() => onShiftWeek(-7)} className={ghostButton} style={muted}><ChevronLeft size={16} aria-hidden="true" /></button>
          <button type="button" aria-label="Next week" onClick={() => onShiftWeek(7)} className={ghostButton} style={muted}><ChevronRight size={16} aria-hidden="true" /></button>
          <input type="date" aria-label="Jump to date" value={selected} onChange={e => e.target.value && onSelect(e.target.value)}
            className="rounded-xl px-2.5 py-1.5 text-body-xs" style={{ border: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.04)', color: 'var(--color-text)', colorScheme: 'dark' }} />
        </div>
      </div>
      <div role="group" aria-label="Choose a day" className="grid grid-flow-col auto-cols-[minmax(3.25rem,1fr)] gap-1.5 overflow-x-auto pb-1 snap-x">
        {days.map(date => {
          const load = dayLoad(date, all, settings, today);
          const active = date === selected;
          const capacity = load.booked + load.open;
          const full = !load.closed && capacity > 0 && load.open === 0;
          const label = `${formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}: ${load.closed && !load.booked ? 'closed' : `${load.booked} booked, ${load.open} open`}${load.conflict ? ', needs attention' : ''}`;
          return <button key={date} type="button" aria-pressed={active} aria-label={label} title={label} onClick={() => onSelect(date)}
            className="relative snap-start flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 transition-colors"
            style={active
              ? { background: 'var(--color-brand)', color: '#fff', border: '1px solid transparent', boxShadow: 'var(--shadow-brand)' }
              : { background: date === today ? 'var(--color-brand-subtle)' : 'rgba(255,255,255,0.03)', border: `1px solid ${date === today ? 'var(--color-brand-ring)' : 'var(--color-border)'}`, color: date < today ? 'var(--color-text-faint)' : 'var(--color-text)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{date === today ? 'Today' : formatDate(date, { weekday: 'short' })}</span>
            <span className="text-lg font-bold leading-tight tabular-nums">{Number(date.slice(8))}</span>
            <span className="text-[10px] font-semibold tabular-nums" style={active ? { color: 'rgba(255,255,255,0.85)' }
              : { color: load.closed ? (load.booked ? 'var(--color-error-text)' : faint.color) : full ? 'var(--color-warn-text)' : load.booked ? 'var(--color-brand-text)' : faint.color }}>
              {load.closed ? 'Closed' : full ? 'Full' : `${load.booked}/${capacity}`}
            </span>
            {load.conflict && <span aria-hidden="true" className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-error-text)' }} />}
          </button>;
        })}
      </div>
    </div>

    <div className="rounded-2xl p-4 sm:p-5 space-y-4" style={{ border: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-brand-text)' }}>{eyebrow}</p>}
          <h3 className="text-lg font-bold text-white leading-tight">{formatDate(selected, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
        </div>
        <p className="text-body-xs tabular-nums" style={muted}>
          {plan.closed && !booked ? 'Closed'
            : `${booked} appointment${booked === 1 ? '' : 's'}${booked ? ` · ${formatDuration(booked * 45)}` : ''}${isPast || plan.closed ? '' : ` · ${plan.openCount} open slot${plan.openCount === 1 ? '' : 's'}`}`}
        </p>
      </div>

      {plan.rows.length === 0 ? <div className="rounded-xl px-4 py-6 text-center space-y-2" style={{ border: '1px dashed var(--color-border-strong)' }}>
        <p className="text-body-sm font-semibold" style={{ color: 'var(--color-text)' }}>{plan.closed ? 'Closed for online booking' : 'No appointments'}</p>
        <p className="text-body-xs" style={muted}>{plan.closed ?? 'Nothing is scheduled on this date.'}</p>
        {nextAfterSelected && <button type="button" onClick={() => onOpen(nextAfterSelected)} className={ghostButton} style={{ color: 'var(--color-brand-text)' }}>
          Next appointment: {formatDate(nextAfterSelected.date, { weekday: 'short', month: 'short', day: 'numeric' })}, {format12Hour(nextAfterSelected.time)} →
        </button>}
      </div> : <ol className="space-y-1.5" aria-label={`Schedule for ${formatDate(selected, { weekday: 'long', month: 'long', day: 'numeric' })}`}>
        {plan.rows.map((row, index) => <TimelineItem key={`${row.kind}-${row.start}-${row.kind === 'booking' ? row.booking.id : ''}`}
          row={row} now={now} today={today} nowMinutes={nowMinutes} isToday={selected === today} showNowBefore={index === nowIndex}
          current={row.kind === 'booking' && current(row)} expanded={expanded} onToggle={onToggle} busy={busy} onCancel={onCancel} />)}
      </ol>}
      {plan.closed && booked > 0 && <p className="text-body-xs" style={{ color: 'var(--color-error-text)' }}>{plan.closed} — these bookings were made before the change and are still valid.</p>}
    </div>
    {!complete && <p className="text-body-xs" style={faint}>Showing appointments from the latest loaded records. Deploy the updated booking Worker so every upcoming appointment always appears here.</p>}
  </div>;
}

function HeadsUp({ label, title, detail, tone, onClick }: { label: string; title: string; detail: string; tone: 'brand' | 'neutral'; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-w-0 items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:brightness-110"
    style={tone === 'brand'
      ? { background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand-ring)' }
      : { background: 'rgba(255,255,255,0.035)', border: '1px solid var(--color-border)' }}>
    <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: tone === 'brand' ? 'var(--color-brand-text)' : 'var(--color-text-muted)' }}>{label}</span>
    <span className="min-w-0">
      <span className="block truncate text-body-sm font-bold text-white">{title}</span>
      <span className="block truncate text-body-xs" style={muted}>{detail}</span>
    </span>
  </button>;
}

function TimelineItem({ row, now, today, nowMinutes, isToday, showNowBefore, current, expanded, onToggle, busy, onCancel }: {
  row: TimelineRow; now: number; today: string; nowMinutes: number; isToday: boolean; showNowBefore: boolean; current: boolean;
  expanded: string | null; onToggle: (id: string) => void; busy: boolean; onCancel: (b: AdminBooking) => void;
}) {
  const past = isToday ? toMinutes(row.end) <= nowMinutes : row.kind === 'booking' && row.booking.date < today;
  const timeColumn = (strong: boolean) => <div className="w-[4.25rem] shrink-0 pt-2.5 text-right tabular-nums">
    <p className={`text-[12px] ${strong ? 'font-bold text-white' : 'font-semibold'}`} style={strong ? undefined : faint}>{format12Hour(row.start)}</p>
    {strong && <p className="text-[10px]" style={faint}>{format12Hour(row.end)}</p>}
  </div>;
  const nowLine = showNowBefore && <div className="flex items-center gap-2 py-0.5" style={{ color: 'var(--color-brand-text)' }}>
    <span className="w-[4.25rem] shrink-0 text-right text-[10px] font-bold uppercase tracking-wider">Now</span>
    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--color-brand-light)' }} />
    <span className="h-px flex-1" style={{ background: 'var(--color-brand-ring)' }} />
  </div>;

  if (row.kind === 'break') return <li>{nowLine}
    <div className="flex items-center gap-3 py-1 text-[11px]" style={faint}>
      <span className="w-[4.25rem] shrink-0" />
      <span className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
      <span className="inline-flex items-center gap-1.5"><Coffee size={12} aria-hidden="true" /> Break · {format12Hour(row.start)} – {format12Hour(row.end)}</span>
      <span className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
    </div>
  </li>;

  if (row.kind !== 'booking') return <li style={{ opacity: past ? 0.45 : 1 }}>{nowLine}
    <div className="flex gap-3">
      {timeColumn(false)}
      <div className="flex flex-1 min-w-0 items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-body-xs"
        style={row.kind === 'open'
          ? { border: '1px dashed var(--color-border-strong)', color: 'var(--color-text-muted)' }
          : { border: '1px solid var(--color-border)', color: faint.color, background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 6px, transparent 6px 12px)' }}>
        <span className="font-semibold">{row.kind === 'open' ? 'Open' : 'Blocked by you'}{row.count > 1 ? ` · ${row.count} slots` : ''}</span>
        <span className="tabular-nums">until {format12Hour(row.end)}</span>
      </div>
    </div>
  </li>;

  const b = row.booking;
  const open = expanded === b.id;
  const parsed = parseBookingNotes(b.notes);
  const accent = row.conflict ? 'var(--color-error-text)' : isHolding(b) ? 'var(--color-warn-text)' : 'var(--color-brand-light)';
  return <li style={{ opacity: past && !open ? 0.6 : 1 }}>{nowLine}
    <div className="flex gap-3">
      {timeColumn(true)}
      <article className="flex-1 min-w-0 rounded-xl transition-colors" aria-label={`${format12Hour(b.time)} ${b.name}`}
        style={{ background: open ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.035)', border: `1px solid ${row.conflict ? 'var(--color-error-ring)' : current ? 'var(--color-brand-ring)' : 'var(--color-border)'}`, boxShadow: `inset 3px 0 0 ${accent}` }}>
        <button type="button" aria-expanded={open} aria-controls={`booking-${b.id}`} onClick={() => onToggle(b.id)}
          className="flex w-full items-start gap-3 rounded-xl px-3.5 py-3 text-left">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h4 className="truncate text-body font-bold text-white">{b.name}</h4>
              {current && <span className={chipClass} style={{ color: '#fff', background: 'var(--color-brand)' }}>Now</span>}
              {b.status !== 'confirmed' && <StatusChip booking={b} now={now} />}
              {row.conflict && <span className={chipClass} style={{ color: 'var(--color-error-text)', background: 'var(--color-error-bg)', border: '1px solid var(--color-error-ring)' }}>
                <AlertTriangle size={10} aria-hidden="true" /> Closed time
              </span>}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-body-xs" style={muted}>
              <span className="truncate">{servicesSummary(parsed)}</span>
              {parsed.clientNotes && <MessageSquareText size={12} className="shrink-0" style={{ color: 'var(--color-brand-text)' }} aria-label="Has client notes" />}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            {parsed.total !== null && <span className="text-body-sm font-semibold tabular-nums" style={{ color: 'var(--color-text)' }}>{peso(parsed.total)}</span>}
            <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} style={faint} />
          </div>
        </button>
        {open && <div id={`booking-${b.id}`} className="px-3.5 pb-3.5">
          <BookingDetails booking={b} now={now} conflict={row.conflict} busy={busy} onCancel={onCancel} />
        </div>}
      </article>
    </div>
  </li>;
}

/* ─────────────────────────── Records ─────────────────────────── */

function RecordsView({ all, settings, now, today, expanded, onToggle, busy, onCancel, onShowInSchedule, canLoadMore, onLoadMore, initialFilter }: {
  all: AdminBooking[]; settings: PublicSettings | null | undefined; now: number; today: string; expanded: string | null;
  onToggle: (id: string) => void; busy: boolean; onCancel: (b: AdminBooking) => void; onShowInSchedule: (b: AdminBooking) => void;
  canLoadMore: boolean; onLoadMore: () => void; initialFilter: RecordFilter;
}) {
  const [filter, setFilter] = useState<RecordFilter>(initialFilter);
  const [search, setSearch] = useState('');
  const matchesFilter = (b: AdminBooking, f: RecordFilter) => f === 'all' || (f === 'holding' ? isHolding(b) : b.status === f);
  const query = search.trim().toLowerCase();
  const rows = all
    .filter(b => matchesFilter(b, filter) && (!query || `${b.name} ${b.email} ${b.contact} ${b.id} ${b.payment_id ?? ''} ${b.date} ${b.notes}`.toLowerCase().includes(query)))
    .sort((a, b) => b.createdAt - a.createdAt);

  return <div className="space-y-3">
    <div className="relative">
      <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={faint} />
      <input type="search" aria-label="Search bookings" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search name, email, contact, piercing, date or payment reference"
        className="w-full rounded-xl py-2.5 pl-9 pr-3 text-body-sm" style={{ border: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.04)', color: 'var(--color-text)' }} />
    </div>
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
      {RECORD_FILTERS.map(f => {
        const count = all.filter(b => matchesFilter(b, f.id)).length;
        const active = filter === f.id;
        return <button key={f.id} type="button" aria-pressed={active} onClick={() => setFilter(f.id)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-body-xs font-semibold transition-colors"
          style={active ? { background: 'var(--color-brand)', color: '#fff' } : { border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
          {f.label}<span className="tabular-nums opacity-70">{count}</span>
        </button>;
      })}
    </div>
    <p className="text-body-xs" style={faint}>{rows.length} of {all.length} loaded · newest bookings first</p>
    <div role="region" aria-label="Booking records" tabIndex={0} className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
      {rows.length === 0 && <p className="rounded-xl px-4 py-6 text-center text-body-xs" style={{ ...muted, border: '1px dashed var(--color-border-strong)' }}>
        {all.length ? 'No bookings match this search or filter.' : 'No online bookings yet.'}
      </p>}
      {rows.map(b => {
        const open = expanded === b.id;
        return <article key={b.id} className="rounded-xl" style={{ background: open ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
          <button type="button" aria-expanded={open} aria-controls={`record-${b.id}`} onClick={() => onToggle(b.id)}
            className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3.5 py-3 text-left">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="truncate text-body-sm font-bold text-white">{b.name}</h4>
                <StatusChip booking={b} now={now} />
              </div>
              <p className="mt-0.5 truncate text-body-xs" style={muted}>{b.email} · {servicesSummary(parseBookingNotes(b.notes))}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-body-xs font-semibold tabular-nums" style={{ color: 'var(--color-text)' }}>{formatDate(b.date, { weekday: 'short', month: 'short', day: 'numeric' })} · {format12Hour(b.time)}</p>
              <p className="text-[11px]" style={faint}>booked {manilaStamp(b.createdAt)}</p>
            </div>
          </button>
          {open && <div id={`record-${b.id}`} className="px-3.5 pb-3.5">
            <BookingDetails booking={b} now={now} conflict={scheduleConflict(b, settings, today)} busy={busy} onCancel={onCancel}
              onShowInSchedule={holdsSlot(b) ? onShowInSchedule : undefined} />
          </div>}
        </article>;
      })}
    </div>
    {canLoadMore && <button type="button" onClick={onLoadMore} className={ghostButton} style={{ color: 'var(--color-brand-text)', border: '1px solid var(--color-border)' }}>Load older bookings</button>}
  </div>;
}

/* ─────────────────────────── Payments ─────────────────────────── */

function PaymentsView({ report, all, busy, onImportLegacy }: { report: AdminReport; all: AdminBooking[]; busy: boolean; onImportLegacy: () => void }) {
  const names = new Map(all.map(b => [b.id, b.name]));
  const tile = (label: string, value: ReactNode, hint?: string) => <div className="rounded-xl px-4 py-3" style={{ border: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.03)' }}>
    <p className="text-body-xs" style={muted}>{label}</p>
    <p className="mt-1 text-xl font-semibold text-white tabular-nums">{value}</p>
    {hint && <p className="mt-0.5 text-[11px]" style={faint}>{hint}</p>}
  </div>;
  return <div className="space-y-4">
    <div className="grid gap-2 sm:grid-cols-3">
      {tile('Verified payments', report.totals.payments)}
      {tile('Deposits collected', peso(report.totals.grossCentavos / 100), 'Gross, before fees and refunds')}
      {tile('Paid late · needs review', report.totals.needsReview || 0)}
    </div>
    <aside className="rounded-xl p-4 space-y-2 text-body-xs leading-relaxed" style={{ ...muted, border: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.02)' }}>
      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Verified payments are separate from your PayMongo Wallet balance.</p>
      <p>A confirmed booking means PayMongo verified the customer’s payment. Wallet credit follows clearing and your payout schedule. Deposits are advances toward the bill, not extra revenue, and this panel does not track payouts, refunds or your wallet balance.</p>
      <p>To trace a deposit, copy the payment reference from a booking and find it in your <a href="https://dashboard.paymongo.com" target="_blank" rel="noreferrer" className="underline">PayMongo dashboard</a> under Payments and Payouts · <a href="https://docs.paymongo.com/docs/money-movement-payouts" target="_blank" rel="noreferrer" className="underline">payout guide</a>.</p>
    </aside>
    <section className="space-y-2" aria-label="Email delivery">
      <h4 className="text-body-sm font-bold text-white">Email delivery</h4>
      {report.notifications.length === 0
        ? <p className="text-body-xs" style={muted}>All confirmation emails were accepted by Gmail.</p>
        : <ul className="space-y-1.5">{report.notifications.map((n, i) => <li key={i} className="rounded-xl px-3 py-2 text-body-xs"
          style={{ border: `1px solid ${n.status === 'needs_review' || n.last_error ? 'var(--color-warn-ring)' : 'var(--color-border)'}`, background: 'rgba(255,255,255,0.02)' }}>
          <p style={{ color: 'var(--color-text)' }}><span className="font-semibold">{names.get(n.booking_id) ?? 'Booking'}</span> · {n.audience === 'admin' ? 'studio copy' : 'customer email'} · {n.kind.replaceAll('_', ' ')}</p>
          <p style={muted}>{n.status === 'needs_review' ? 'Needs review — check the Gmail sent folder before resending' : n.status.replaceAll('_', ' ')}{n.last_error ? ` · ${n.last_error.replaceAll('_', ' ')}` : ''}</p>
        </li>)}</ul>}
    </section>
    <details className="rounded-xl p-4" style={{ border: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.02)' }}>
      <summary className="cursor-pointer text-body-xs font-semibold" style={{ color: 'var(--color-text)' }}>Older reservations · slot safeguards</summary>
      <div className="pt-3 space-y-2">
        <button type="button" disabled={busy} onClick={onImportLegacy} className={ghostButton} style={{ border: '1px solid var(--color-border-strong)', color: 'var(--color-text)', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Updating safeguards…' : 'Import / refresh legacy slot safeguards'}
        </button>
        <p className="text-body-xs" style={muted}>Run after cancelling or deleting an older (pre-payment) reservation. This protects existing slots without marking them paid.</p>
      </div>
    </details>
  </div>;
}
