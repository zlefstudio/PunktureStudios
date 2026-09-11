import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../../firebase';
import { bookingApi } from '../../bookingApi';
import type { PaymentBooking } from '../../types';
type AdminBooking = PaymentBooking & { name: string; email: string; contact: string; notes: string; last_error: string | null };
type Report = { bookings: AdminBooking[]; notifications: { booking_id: string; audience: string; kind: string; status: string; last_error: string | null }[]; totals: { payments: number; grossCentavos: number; needsReview: number } };
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
  return <section id="paid-bookings" className="scroll-mt-6 rounded-3xl border border-zinc-700 p-5 sm:p-6 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-violet-300 mb-1">BOOKING OPERATIONS</p><h2 className="text-xl font-bold">Bookings &amp; deposits</h2></div>{user && <button type="button" onClick={() => setRefresh(n => n + 1)} className="rounded-xl border border-zinc-600 px-4 py-2 text-sm">Refresh bookings</button>}</div>
    <p className="text-sm text-zinc-400">For deposit bookings, verify the payment reference and deduct ₱100 from the final bill. Collect only the remaining balance.</p>
    {!user && <p>Sign in as staff to view bookings.</p>}
    {user && <details className="rounded-xl border border-zinc-700 p-4"><summary className="cursor-pointer text-sm font-semibold">Existing reservations · slot safeguards</summary><div className="pt-3 space-y-3"><button type="button" disabled={busy} className="underline" onClick={() => void importLegacy()}>{busy ? 'Updating safeguards…' : 'Import / refresh legacy slot safeguards'}</button><p className="text-sm text-zinc-400">Import before enabling payments and after cancelling or deleting an older reservation. This protects existing slots without marking them paid.</p></div></details>}
    {notice && <p role="status" className="rounded-xl bg-emerald-950/50 p-3 text-emerald-200">{notice}</p>}
    {user && !data && !error && <p role="status" className="text-zinc-400">Loading bookings and payment totals…</p>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {data && <>
      <div className="grid gap-3 sm:grid-cols-3">{[['Verified payments', data.totals.payments], ['Deposits collected · gross', `PHP ${(data.totals.grossCentavos / 100).toFixed(2)}`], ['Payment reviews', data.totals.needsReview || 0]].map(([label,value]) => <div key={label} className="rounded-2xl bg-zinc-900 p-4"><p className="text-sm text-zinc-400">{label}</p><p className="text-2xl font-semibold mt-2">{value}</p></div>)}</div>
      <p className="text-sm text-zinc-400">Gross collections include payments under review, before refunds and gateway fees. Deposits are advance payments toward the bill, not extra service revenue.</p>
      <div className="flex flex-col sm:flex-row gap-3"><input aria-label="Search loaded bookings" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, date, or booking ID" className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm" /><select aria-label="Filter booking status" value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm">{['all','confirmed','pending','creating','payment_review','expired','cancelled'].map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replaceAll('_',' ')}</option>)}</select></div>
      <p className="text-sm text-zinc-400">Showing {visible.length} of {data.bookings.length} loaded bookings. Search and filters apply to loaded records; totals cover all payments.</p>
      {data.notifications.length > 0 && <details className="border border-amber-700 p-3 rounded-xl"><summary>Email delivery queue / issues ({data.notifications.length}, newest 100)</summary>
        {data.notifications.map((n,i) => <p className="text-xs break-all mt-2" key={i}>{n.booking_id} · {n.audience} · {n.kind} · {n.status} · {n.last_error || 'Waiting for delivery'}</p>)}
      </details>}
      {data.bookings.length === 0 && <p>No payment bookings yet.</p>}
      {data.bookings.length > 0 && visible.length === 0 && <p>No loaded bookings match these filters.</p>}
      {visible.map(b => <article key={b.id} className="rounded-xl bg-zinc-900 p-4 space-y-2">
        <h3 className="font-bold">{b.name} · {b.status}</h3>
        <p>{b.date} {b.time} (Manila) · {b.email} · {b.contact}</p>
        <p className="text-xs break-all">Booking: {b.id} · Payment: {b.payment_id || 'Not verified'}</p>
        <p className="text-sm">{b.notes}</p>
        <p className="text-sm">{b.policy}</p>
        {b.last_error && <p className="text-amber-300">{b.last_error}</p>}
        {b.status === 'payment_review' && <p className="text-amber-300">No slot confirmed. Contact customer; refund or arrange another schedule manually. Record refunds in PayMongo.</p>}
        {b.status === 'confirmed' && <button className="underline" type="button" disabled={busy} onClick={() => void cancel(b.id)}>Cancel booking / release slot</button>}
      </article>)}
      {data.bookings.length >= limit && limit < 500 && <button type="button" className="underline" onClick={() => setLimit(n => Math.min(500,n+30))}>Load more bookings</button>}
    </>}
  </section>;
}
