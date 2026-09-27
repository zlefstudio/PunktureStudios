import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CalendarDays, Check, Copy, MessageSquareText, XCircle } from 'lucide-react';
import { format12Hour } from '../../schedule';
import {
  DEPOSIT_PESOS, LATE_GRACE_MINUTES, addMinutes, appointmentStart, isHolding, manilaStamp, manilaToday, parseBookingNotes, peso, reminderMessage,
  type AdminBooking,
} from './bookingAgenda';

/** Clipboard with a short "Copied" acknowledgement per field. */
function useCopy() {
  const [copied, setCopied] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch { setCopied(`failed:${key}`); }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(''), 1600);
  }
  return { copied, copy };
}

const labelClass = 'text-[10px] font-bold uppercase tracking-[0.08em]';
const faint = { color: 'rgba(136,146,170,0.72)' };
const boxStyle = { border: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.025)' };

function Notice({ tone, children }: { tone: 'warn' | 'error' | 'muted'; children: ReactNode }) {
  const colors = tone === 'error'
    ? { background: 'var(--color-error-bg)', border: '1px solid var(--color-error-ring)', color: '#fecaca' }
    : tone === 'warn'
      ? { background: 'var(--color-warn-bg)', border: '1px solid var(--color-warn-ring)', color: '#fde68a' }
      : { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' };
  return <p className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-body-xs leading-relaxed" style={colors}>
    <AlertTriangle size={14} className="shrink-0 mt-px" aria-hidden="true" /><span>{children}</span>
  </p>;
}

export function BookingDetails({ booking, now, conflict, busy, onCancel, onShowInSchedule }: {
  booking: AdminBooking;
  now: number;
  conflict: string | null;
  busy: boolean;
  onCancel: (booking: AdminBooking) => void;
  onShowInSchedule?: (booking: AdminBooking) => void;
}) {
  const parsed = parseBookingNotes(booking.notes);
  const { copied, copy } = useCopy();
  const start = appointmentStart(booking);
  const notEnded = start + 45 * 60000 > now;
  const paid = Boolean(booking.payment_id);
  const today = manilaToday(now);

  // Plain render helpers (not nested components) so buttons keep focus across re-renders.
  const copyButton = (id: string, text: string, label: string) => (
    <button type="button" onClick={() => void copy(id, text)} aria-label={label}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-white/5"
      style={{ color: copied === id ? 'var(--color-success-text)' : 'var(--color-text-muted)' }}>
      {copied === id ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
      {copied === id ? 'Copied' : copied === `failed:${id}` ? 'Copy failed' : 'Copy'}
    </button>
  );
  const field = (label: string, children: ReactNode) => (
    <div className="min-w-0">
      <p className={labelClass} style={faint}>{label}</p>
      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 text-body-sm" style={{ color: 'var(--color-text)' }}>{children}</div>
    </div>
  );

  return <div className="space-y-3 pt-3 mt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
    {isHolding(booking) && <Notice tone="muted">The customer is on the payment page. This hold ends at {manilaStamp(booking.expiresAt)} if they don’t pay.</Notice>}
    {booking.status === 'payment_review' && <Notice tone="warn">Paid after the 15-minute hold expired, so no slot was reserved. Contact the customer to agree a new time, or refund in PayMongo.</Notice>}
    {booking.status === 'cancelled' && <Notice tone="muted">Cancelled — the slot was released. Handle any refund in PayMongo.</Notice>}
    {conflict && <Notice tone="error">{conflict}. The booking is still valid — contact the customer to move it, or reopen the time in Schedule.</Notice>}
    {booking.last_error && <Notice tone="warn">Payment note from the system: {booking.last_error.replaceAll('_', ' ')}</Notice>}

    <div className="grid gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <section className="rounded-xl p-3" style={boxStyle} aria-label="Services">
          <p className={labelClass} style={faint}>Services</p>
          {parsed.consultationOnly && <p className="mt-1 text-body-sm" style={{ color: 'var(--color-text)' }}>Consultation only — nothing selected in the cart.</p>}
          {!parsed.structured && <p className="mt-1 text-body-sm whitespace-pre-wrap break-words" style={{ color: 'var(--color-text)' }}>{parsed.raw || 'No details provided.'}</p>}
          {parsed.items.length > 0 && <ul className="mt-1.5 space-y-2">
            {parsed.items.map((item, index) => <li key={index} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-body-sm font-semibold" style={{ color: 'var(--color-text)' }}>{item.title}</p>
                <p className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>{item.jewelry}</p>
                {item.extra.map((line, i) => <p key={i} className="text-body-xs break-words" style={faint}>{line}</p>)}
              </div>
              {item.estimate !== null && <p className="shrink-0 text-body-sm tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{peso(item.estimate)}</p>}
            </li>)}
          </ul>}
          {parsed.total !== null && <dl className="mt-3 pt-2.5 space-y-1 border-t text-body-xs tabular-nums" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex justify-between gap-3" style={{ color: 'var(--color-text-muted)' }}><dt>Cart estimate</dt><dd>{peso(parsed.total)}</dd></div>
            {paid && <div className="flex justify-between gap-3" style={{ color: 'var(--color-text-muted)' }}><dt>Deposit paid online</dt><dd>−{peso(DEPOSIT_PESOS)}</dd></div>}
            {paid && <div className="flex justify-between gap-3 text-body-sm font-bold" style={{ color: 'var(--color-text)' }}><dt>Balance to collect</dt><dd>≈ {peso(Math.max(0, parsed.total - DEPOSIT_PESOS))}</dd></div>}
            <p className="pt-1" style={faint}>From the customer’s cart — confirm pieces and price at the studio.</p>
          </dl>}
        </section>
        {parsed.clientNotes && <section className="rounded-xl p-3 flex gap-2.5" style={{ ...boxStyle, background: 'var(--color-brand-subtle)', borderColor: 'var(--color-brand-ring)' }} aria-label="Client notes">
          <MessageSquareText size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--color-brand-text)' }} aria-hidden="true" />
          <div className="min-w-0">
            <p className={labelClass} style={{ color: 'var(--color-brand-text)' }}>Client notes</p>
            <p className="mt-0.5 text-body-sm whitespace-pre-wrap break-words" style={{ color: 'var(--color-text)' }}>{parsed.clientNotes}</p>
          </div>
        </section>}
      </div>

      <div className="rounded-xl p-3 grid gap-3 sm:grid-cols-2 md:grid-cols-1 content-start" style={boxStyle}>
        {field('Email', <>
          <a href={`mailto:${booking.email}`} className="truncate underline decoration-white/20 underline-offset-2 hover:decoration-white/60">{booking.email}</a>
          {copyButton('email', booking.email, `Copy email of ${booking.name}`)}
        </>)}
        {field('Contact', <>
          <span className="break-all">{booking.contact || '—'}</span>
          {booking.contact && copyButton('contact', booking.contact, `Copy contact of ${booking.name}`)}
        </>)}
        {field('Payment reference', booking.payment_id ? <>
          <span className="font-mono text-[12px] break-all">{booking.payment_id}</span>
          {copyButton('payment', booking.payment_id, 'Copy payment reference')}
        </> : <span style={{ color: 'var(--color-text-muted)' }}>Not paid</span>)}
        <div className="grid grid-cols-2 gap-3">
          {field('Paid', <span className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>{paid ? manilaStamp(booking.paidAt) : 'Not paid'}</span>)}
          {field('Booked', <span className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>{manilaStamp(booking.createdAt)}</span>)}
        </div>
        {booking.status === 'confirmed' && notEnded && field('Late fee applies from', <span className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>
          {format12Hour(addMinutes(booking.time, LATE_GRACE_MINUTES))} · {LATE_GRACE_MINUTES} min after the start
        </span>)}
        {field('Booking ID', <>
          <span className="font-mono text-[11px] break-all" style={{ color: 'var(--color-text-muted)' }}>{booking.id}</span>
          {copyButton('id', booking.id, 'Copy booking ID')}
        </>)}
      </div>
    </div>

    {booking.policy && <details className="text-body-xs">
      <summary className="cursor-pointer" style={faint}>Deposit policy the customer accepted</summary>
      <p className="pt-1" style={{ color: 'var(--color-text-muted)' }}>{booking.policy}</p>
    </details>}

    <div className="flex flex-wrap items-center gap-2">
      {booking.status === 'confirmed' && notEnded && <button type="button" onClick={() => void copy('reminder', reminderMessage(booking, today))}
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-body-xs font-semibold transition-colors hover:bg-white/5"
        style={{ border: '1px solid var(--color-border-strong)', color: copied === 'reminder' ? 'var(--color-success-text)' : 'var(--color-text)' }}>
        {copied === 'reminder' ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
        {copied === 'reminder' ? 'Reminder copied' : copied === 'failed:reminder' ? 'Copy failed' : 'Copy reminder message'}
      </button>}
      {onShowInSchedule && <button type="button" onClick={() => onShowInSchedule(booking)}
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-body-xs font-semibold transition-colors hover:bg-white/5"
        style={{ border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }}>
        <CalendarDays size={13} aria-hidden="true" /> Show in schedule
      </button>}
      {booking.status === 'confirmed' && notEnded && <button type="button" disabled={busy} onClick={() => onCancel(booking)}
        className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-body-xs font-semibold transition-colors hover:bg-red-500/10 disabled:opacity-50"
        style={{ color: 'var(--color-error-text)' }}>
        <XCircle size={13} aria-hidden="true" /> Cancel booking
      </button>}
    </div>
  </div>;
}
