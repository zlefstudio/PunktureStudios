import { useEffect, useState, type CSSProperties } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../../firebase';
import { bookingApi } from '../../bookingApi';
import type { PaymentBooking } from '../../types';
import { CreditCard, RefreshCw } from 'lucide-react';
type AdminBooking = PaymentBooking & { name: string; email: string; contact: string; notes: string; last_error: string | null };
type Report = { bookings: AdminBooking[]; notifications: { booking_id: string; audience: string; kind: string; status: string; last_error: string | null }[]; totals: { payments: number; grossCentavos: number; needsReview: number } };

// Shared recipes so this panel matches every other Settings section.
const cardStyle: CSSProperties = { borderRadius: '20px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' };
const tileStyle: CSSProperties = { borderRadius: '14px', border: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.03)', padding: '12px 14px' };
const controlStyle: CSSProperties = { borderRadius: '12px', border: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.04)', color: 'var(--color-text)', padding: '10px 12px', fontSize: '13px' };
const chipStyle: CSSProperties = { fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: '999px' };
const STATUS_TONE: Record<string, { bg: string; color: string; border: string }> = {
  confirmed: { bg: 'rgba(16,185,129,0.16)', color: '#34d399', border: 'rgba(16,185,129,0.35)' },
  pending: { bg: 'rgba(217,119,6,0.16)', color: '#fbbf24', border: 'rgba(217,119,6,0.35)' },
  payment_review: { bg: 'rgba(249,115,22,0.16)', color: '#fdba74', border: 'rgba(249,115,22,0.35)' },
  cancelled: { bg: 'rgba(239,68,68,0.16)', color: '#f87171', border: 'rgba(239,68,68,0.35)' },
};
const NEUTRAL_TONE = { bg: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)', border: 'var(--color-border)' };
const STATUS_FILTERS = ['all', 'confirmed', 'pending', 'creating', 'payment_review', 'expired', 'cancelled'] as const;
export function PaidBookingsView() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(30);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setData(null); }), []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      try {
        const report = await bookingApi<Report>(`/admin/bookings?limit=${limit}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
        if (active) { setData(report); setError(''); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Cannot load bookings.'); }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => { active = false; clearInterval(timer); };
  }, [user, limit, refresh]);
  async function importLegacy() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const result = await bookingApi<{ imported: number }>('/admin/import-legacy', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      setNotice(`Legacy slot safeguards refreshed: ${result.imported} future requests held.`);
      setRefresh(n => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Migration failed.'); }
    finally { setBusy(false); }
  }
  async function cancel(id: string) {
    if (!user || busy || !window.confirm('Cancel this confirmed booking and release its slot? Refunds must be handled separately in PayMongo. The customer and admin will be emailed.')) return;
    setBusy(true);
    try {
      await bookingApi(`/admin/bookings/${id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      setRefresh(n => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Cancellation failed.'); }
    finally { setBusy(false); }
  }
  const visible = data?.bookings.filter(b => (status === 'all' || b.status === status) && `${b.name} ${b.email} ${b.id} ${b.date}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <section id="paid-bookings" style={cardStyle} className="scroll-mt-6 p-5 sm:p-6 space-y-5">
    <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.18)', color: 'var(--color-brand-light)' }}><CreditCard size={18} /></div>
        <div>
          <h2 className="font-bold text-body text-white">Bookings &amp; deposits</h2>
          <p className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>Verify the payment reference, deduct ₱100 from the final bill, then collect only the balance.</p>
        </div>
      </div>
      {user && <button type="button" onClick={() => setRefresh(n => n + 1)} className="inline-flex items-center gap-2" style={{ ...controlStyle, cursor: 'pointer' }}><RefreshCw size={13} /> Refresh</button>}
    </header>
    {!user && <p className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>Sign in as staff to view bookings.</p>}
    {user && <details className="rounded-2xl p-4" style={{ border: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.02)' }}>
      <summary className="cursor-pointer text-body-xs font-semibold" style={{ color: 'var(--color-text)' }}>Existing reservations · slot safeguards</summary>
      <div className="pt-3 space-y-2">
        <button type="button" disabled={busy} onClick={() => void importLegacy()} style={{ ...controlStyle, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Updating safeguards…' : 'Import / refresh legacy slot safeguards'}</button>
        <p className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>Run before enabling payments and after cancelling or deleting an older reservation. This protects existing slots without marking them paid.</p>
      </div>
    </details>}
    {notice && <p role="status" className="rounded-xl p-3 text-body-xs" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>{notice}</p>}
    {user && !data && !error && <p role="status" className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>Loading bookings and payment totals…</p>}
    {error && <p role="alert" className="text-body-xs" style={{ color: 'var(--color-error-text)' }}>{error}</p>}
    {data && <>
      <div className="grid gap-3 sm:grid-cols-3">{[['Verified payments', data.totals.payments], ['Deposits collected · gross', `PHP ${(data.totals.grossCentavos / 100).toFixed(2)}`], ['Payment reviews', data.totals.needsReview || 0]].map(([label, value]) => (
        <div key={String(label)} style={tileStyle}>
          <p className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
          <p className="text-xl font-semibold text-white mt-1">{value}</p>
        </div>
      ))}</div>
      <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Gross collections include payments still under review, before refunds and gateway fees. Deposits are advances toward the bill, not extra service revenue.</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input aria-label="Search loaded bookings" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, date, or booking ID" className="min-w-0 flex-1" style={controlStyle} />
        <select aria-label="Filter booking status" value={status} onChange={e => setStatus(e.target.value)} style={controlStyle}>
          {STATUS_FILTERS.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replaceAll('_', ' ')}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Showing {visible.length} of {data.bookings.length} loaded bookings · filters apply to loaded records, totals cover all payments</p>
        {data.bookings.length >= limit && limit < 500 && <button type="button" className="text-body-xs font-semibold underline" style={{ color: 'var(--color-brand-light)' }} onClick={() => setLimit(n => Math.min(500, n + 30))}>Load 30 more</button>}
      </div>

      {data.notifications.length > 0 && <details className="rounded-2xl p-4" style={{ border: '1px solid rgba(217,119,6,0.35)', background: 'rgba(217,119,6,0.08)' }}>
        <summary className="cursor-pointer text-body-xs font-semibold" style={{ color: '#fbbf24' }}>Email delivery queue / issues ({data.notifications.length}, newest 100)</summary>
        <div className="pt-2 space-y-1">
          {data.notifications.map((n,i) => <p className="text-[11px] break-all font-mono" style={{ color: 'var(--color-text-muted)' }} key={i}>{n.booking_id} · {n.audience} · {n.kind} · {n.status} · {n.last_error || 'waiting'}</p>)}
        </div>
      </details>}

      {/* Bounded scroll area: up to 500 records stay inside this box instead of stretching the page. */}
      <div role="region" aria-label="Booking records" tabIndex={0} className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {data.bookings.length === 0 && <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>No payment bookings yet.</p>}
        {data.bookings.length > 0 && visible.length === 0 && <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>No loaded bookings match these filters.</p>}
        {visible.map(b => {
          const tone = STATUS_TONE[b.status] ?? NEUTRAL_TONE;
          return <article key={b.id} className="rounded-2xl p-4 space-y-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-bold text-body-sm text-white truncate">{b.name}</h3>
                <span style={{ ...chipStyle, background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}>{b.status.replaceAll('_', ' ')}</span>
              </div>
              <p className="text-body-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{b.date} · {b.time} (Manila)</p>
            </div>
            <div className="grid gap-1 sm:grid-cols-2 text-body-xs" style={{ color: 'var(--color-text-muted)' }}>
              <p className="truncate">Email: {b.email}</p>
              <p className="truncate">Contact: {b.contact}</p>
              <p className="break-all font-mono text-[11px]">Booking {b.id}</p>
              <p className="break-all font-mono text-[11px]">Payment {b.payment_id || 'not verified'}</p>
            </div>
            {b.notes && <p className="text-body-xs" style={{ color: 'var(--color-text)' }}>{b.notes}</p>}
            {b.last_error && <p className="text-body-xs" style={{ color: '#fbbf24' }}>⚠ {b.last_error}</p>}
            {b.status === 'payment_review' && <p className="text-body-xs" style={{ color: '#fdba74' }}>No slot confirmed. Contact the customer; refund or reschedule manually in PayMongo.</p>}
            <details className="text-body-xs">
              <summary className="cursor-pointer" style={{ color: 'var(--color-text-faint)' }}>Accepted deposit policy</summary>
              <p className="pt-1" style={{ color: 'var(--color-text-muted)' }}>{b.policy}</p>
            </details>
            {b.status === 'confirmed' && <button className="text-body-xs font-semibold underline" style={{ color: '#f87171' }} type="button" disabled={busy} onClick={() => void cancel(b.id)}>Cancel booking / release slot</button>}
          </article>;
        })}
      </div>
    </>}
  </section>;
}
