import { useEffect, useState, type CSSProperties } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../../firebase';
import { bookingApi } from '../../bookingApi';
import { format12Hour } from '../../schedule';
import { whilePageVisible } from '../../visibleSubscription';
import type { PublicSettings } from '../../types';
import { CalendarCheck, RefreshCw } from 'lucide-react';
import { BookingsBoard } from './BookingsBoard';
import { formatDate, manilaToday, shiftDate, type AdminBooking, type AdminReport } from './bookingAgenda';

// Shared recipe so this panel matches every other Settings section.
const cardStyle: CSSProperties = { borderRadius: '20px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' };
const REFRESH_MS = 30000;
/** Days of past appointments kept on the schedule for looking back. */
const HISTORY_DAYS = 7;

/**
 * Loads the staff booking report from the Worker (staff Firebase ID token) and
 * refreshes it while the page is visible. Presentation lives in BookingsBoard.
 * `settings` is the saved studio schedule, used to show open slots and closures.
 */
export function PaidBookingsView({ settings = null }: { settings?: PublicSettings | null }) {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<AdminReport | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(30);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setData(null); }), []);
  // Keeps "now" markers, countdowns and hold timers current between loads.
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), REFRESH_MS); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const from = shiftDate(manilaToday(), -HISTORY_DAYS);
        const report = await bookingApi<AdminReport>(`/admin/bookings?limit=${limit}&from=${from}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
        if (active) { setData(report); setError(''); setLoadedAt(Date.now()); setNow(Date.now()); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Cannot load bookings.'); }
      finally { if (active) setLoading(false); }
    };
    // Polling pauses while the tab stays hidden, saving Worker and D1 reads.
    const stop = whilePageVisible(() => {
      void load();
      const timer = setInterval(() => void load(), REFRESH_MS);
      return () => clearInterval(timer);
    });
    return () => { active = false; stop(); };
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
  async function cancel(b: AdminBooking) {
    const when = `${formatDate(b.date, { weekday: 'short', month: 'short', day: 'numeric' })} at ${format12Hour(b.time)}`;
    if (!user || busy || !window.confirm(`Cancel ${b.name}'s booking on ${when}?\n\nThe slot is released and the customer and studio are emailed. Refunds must be handled separately in PayMongo.`)) return;
    setBusy(true);
    try {
      await bookingApi(`/admin/bookings/${b.id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      setNotice(`${b.name}'s ${when} booking was cancelled and the slot released.`);
      setRefresh(n => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Cancellation failed.'); }
    finally { setBusy(false); }
  }

  const age = now - loadedAt;
  const updated = !loadedAt ? '' : age < 60000 ? 'Updated just now' : `Updated ${Math.round(age / 60000)} min ago`;
  return <section id="paid-bookings" style={cardStyle} className="scroll-mt-6 p-5 sm:p-6 space-y-5">
    <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.18)', color: 'var(--color-brand-light)' }}><CalendarCheck size={18} /></div>
        <div>
          <h2 className="font-bold text-body text-white">Bookings &amp; deposits</h2>
          <p className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>Who’s coming and when. Deduct the ₱100 deposit from the final bill and collect only the balance.</p>
        </div>
      </div>
      {user && <div className="flex items-center gap-2">
        {updated && <span className="text-[11px]" style={{ color: 'var(--color-text-faint)' }} aria-live="polite">{updated}</span>}
        <button type="button" onClick={() => setRefresh(n => n + 1)} disabled={loading} aria-label="Refresh bookings"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-body-xs font-semibold transition-colors hover:bg-white/5"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
          <RefreshCw size={13} aria-hidden="true" className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>}
    </header>
    {!user && <p className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>Sign in as staff (bottom sync bar) to see bookings.</p>}
    {notice && <p role="status" className="rounded-xl p-3 text-body-xs" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>{notice}</p>}
    {user && !data && !error && <p role="status" className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>Loading bookings…</p>}
    {error && <p role="alert" className="rounded-xl p-3 text-body-xs" style={{ color: 'var(--color-error-text)', background: 'var(--color-error-bg)', border: '1px solid var(--color-error-ring)' }}>
      {data ? `Couldn’t refresh: ${error} Showing bookings from ${new Date(loadedAt).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })}.` : error}
    </p>}
    {data && <BookingsBoard report={data} settings={settings} now={now} busy={busy}
      canLoadMore={data.bookings.length >= limit && limit < 500} onLoadMore={() => setLimit(n => Math.min(500, n + 30))}
      onCancel={b => void cancel(b)} onImportLegacy={() => void importLegacy()} />}
  </section>;
}
