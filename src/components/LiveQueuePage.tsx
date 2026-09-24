import type { PublicQueueRow as PublicRow, Ticket as QueueTicket } from '../types';
import { calculateQueueWaitTimes } from '../queueEstimates';
import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, collection, query, doc } from 'firebase/firestore';
import { firestore } from '../firebase';
import { Ticket, CalendarHeart } from 'lucide-react';
import { PiercingRitualAnimation } from './PiercingRitualAnimation';
import { PublicShell } from './PublicShell';

/**
 * PUBLIC LIVE QUEUE — customer-facing, real-time, privacy-safe.
 * Reads only the sanitized `publicQueue` collection that the cashier app
 * publishes (ticket number, masked nickname, duration; NEVER raw names/notes/prices).
 */

interface QueueData {
  waiting: PublicRow[];
  called: PublicRow[];
  inProgress: PublicRow[];
}

function friendlyError(err: unknown): string {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
  if (code.includes('permission-denied')) {
    return 'The live queue has not been published yet. Staff needs to connect the cashier app to the cloud first.';
  }
  if (code.includes('not-found')) {
    return 'The live queue database is not ready yet. Please try again later.';
  }
  return 'Cannot load the live queue right now. Check your connection and refresh.';
}

export function LiveQueuePage({ localPreview }: { localPreview?: { rows: PublicRow[] | null; error: string | null } } = {}) {
  const [heartbeat, setHeartbeat] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const isLocal = localPreview !== undefined;
  useEffect(() => {
    if (isLocal) return;
    return onSnapshot(doc(firestore, 'public', 'heartbeat'), snap => {
    const stamp = snap.data()?.publishedAt; setHeartbeat(stamp?.toMillis?.() ?? 0);
  }, () => setHeartbeat(0));
  }, [isLocal]);
  const [cloudRows, setRows] = useState<PublicRow[] | null>(null);
  const [cloudError, setError] = useState<string | null>(null);
  useEffect(() => {
    if (isLocal) return;
    const q = query(collection(firestore, 'publicQueue'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const out: PublicRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as PublicRow;
          if (typeof data.ticketNumber !== 'number') return;
          out.push({ ...data, id: d.id });
        });
        setRows(out);
        setError(null);
      },
      (err) => {
        setError(friendlyError(err));
      }
    );
    return unsub;
  }, [isLocal]);
  const rows = localPreview ? localPreview.rows : cloudRows;
  const error = localPreview ? localPreview.error : cloudError;

  const data: QueueData = useMemo(() => {
    const waiting = (rows ?? [])
      .filter((r) => r.status === 'waiting')
      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
    const called = (rows ?? [])
      .filter((r) => r.status === 'called')
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    const inProgress = (rows ?? [])
      .filter((r) => r.status === 'in_progress')
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    return { waiting, called, inProgress };
  }, [rows]);

  const lastUpdated = rows?.length
    ? Math.max(...rows.map((r) => r.updatedAt ?? 0))
    : undefined;
  const hasLive = (data.waiting.length + data.called.length + data.inProgress.length) > 0;
  const fresh = isLocal || (heartbeat > 0 && now - heartbeat < 90000 && now - heartbeat > -60000);
  const live = hasLive && fresh && !error;
  const nowServing = data.inProgress[0] ?? data.called[0];
  const nextUp = data.waiting[0];
  const showStage = hasLive && !error;
  const timing = useMemo(() => calculateQueueWaitTimes(
    (rows ?? []).map(r => ({ ...r, name: '', createdAt: r.createdAt ?? 0, updatedAt: r.updatedAt ?? 0, queueOrder: r.position ?? 0, startedAt: r.startedAt ?? undefined, calledAt: r.calledAt ?? undefined }) as QueueTicket),
    [], now, new Map((rows ?? []).map(r => [r.id, r.estimatedDurationMinutes ?? 6]))
  ), [rows, now]);

  return (
    <PublicShell page="live" wide>
      {hasLive && (
        <>
          <h1 className="sr-only">Live Queue</h1>
          {/* Status row */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
              style={{
                background: live ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
                color: live ? '#34d399' : 'var(--color-text-faint)',
                border: `1px solid ${live ? 'rgba(16,185,129,0.35)' : 'var(--color-border)'}`,
              }}
            >
              <span className="relative flex h-2 w-2">
                {live && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${live ? 'bg-emerald-400' : 'bg-white/20'}`} />
              </span>
              {live ? 'LIVE' : 'UPDATES PAUSED'}
            </span>
            <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
              {lastUpdated
                ? `Updated ${new Date(lastUpdated).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`
                : 'Waiting for updates…'}
            </span>
          </div>
        </>
      )}

      {hasLive && !fresh && <p role="status" className="mb-4 rounded-xl bg-amber-950 p-3 text-amber-100">Updates are paused. This is the last known queue; please check with staff.</p>}
      <div className={`grid grid-cols-1 ${showStage ? 'sm:grid-cols-2' : 'max-w-2xl mx-auto'} gap-5 sm:gap-8 items-start`}>
        {showStage && (
          <div className="w-full flex justify-center md:sticky md:top-6">
            <PiercingRitualAnimation />
          </div>
        )}

        <div className="w-full space-y-5">
          {error ? (
            <div
              className="rounded-2xl p-6 text-center space-y-2"
              style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(248,113,113,0.25)' }}
            >
              <p className="font-bold text-body" style={{ color: 'var(--color-error-text)' }}>
                Queue unavailable
              </p>
              <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
                {error}
              </p>
            </div>
          ) : rows === null ? (
            <div
              className="rounded-2xl p-8 space-y-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}
            >
              <div
                className="w-12 h-12 mx-auto rounded-full"
                style={{ border: '2px solid transparent', borderTopColor: 'var(--color-brand)', animation: 'pk-spin 0.9s linear infinite' }}
              />
              <p className="text-center text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
                Loading live queue…
              </p>
            </div>
          ) : !hasLive ? (
            <div
              id="no-queue"
              className="rounded-3xl p-8 text-center space-y-4 overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, rgba(139,92,246,0.14), rgba(217,119,6,0.06))',
                border: '1px solid rgba(168,85,247,0.30)',
              }}
            >
              <div style={{ animation: 'pk-logo-float 2.6s ease-in-out infinite' }}>
                <Ticket size={32} style={{ margin: '0 auto', color: 'var(--color-brand-text)' }} />
              </div>
              <div className="space-y-1.5">
                <p className="font-black leading-tight tracking-tight" style={{ fontSize: 26, color: 'var(--color-text)' }}>
                  No active queue right now
                </p>
                <p className="text-body-sm max-w-xs mx-auto" style={{ color: 'var(--color-text-muted)' }}>
                  Want to get pierced? Check out our next pop-up event or secure a private home studio appointment.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch justify-center gap-2.5 pt-1">
                <a
                  href="/popup.html"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-ui-sm transition-transform active:scale-95"
                  style={{ background: 'var(--color-brand)', color: '#fff', boxShadow: 'var(--shadow-brand)', textDecoration: 'none' }}
                >
                  <CalendarHeart size={15} />
                  Next pop-up event
                </a>
                <a
                  href="/appointment.html"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-ui-sm transition-transform active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text)', border: '1px solid var(--color-border)', textDecoration: 'none' }}
                >
                  Book an appointment
                </a>
              </div>
            </div>
          ) : (
            <>
              <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
                <strong className="font-semibold" style={{ color: 'var(--color-text)' }}>Please note:</strong>{' '}Times are estimates in Philippine time and may change depending on session duration. Please proceed to our booth as your turn approaches. Once your name or number is called, come to the booth promptly. If you miss 3 calls, you will be removed from the queue.
              </p>
              {/* Now serving */}
              {nowServing && (
                <div
                  key={nowServing.id}
                  data-moving={live && nowServing.status === 'in_progress'}
                  className="queue-serving relative rounded-3xl px-5 py-4 text-center"
                  style={{
                    background: 'linear-gradient(145deg, rgba(139,92,246,0.22), rgba(139,92,246,0.06))',
                    border: '1px solid rgba(168,85,247,0.45)',
                    boxShadow: '0 0 0 1px rgba(168,85,247,0.12), 0 18px 50px -20px rgba(139,92,246,0.5)',
                  }}
                >
                  <p className="queue-serving-label text-label-xs mb-1" style={{ color: 'var(--color-brand-text)' }}>
                    <span className="queue-session-signal" aria-hidden="true"><i /><i /><i /></span>
                    {nowServing.status === 'in_progress' ? 'NOW SERVING' : 'NOW CALLING'}
                  </p>
                  <p className="queue-serving-number font-black" style={{ fontSize: 'clamp(40px, 11vw, 56px)', fontFamily: 'var(--font-mono)', color: '#fff' }}>
                    #{nowServing.ticketNumber}
                  </p>
                  {nowServing.maskedNickname && <p className="mt-2 font-semibold break-all">{nowServing.maskedNickname}</p>}
                  {live && <div className="queue-session-duration mt-2 text-body-xs">
                    <span>Estimated session: {nowServing.estimatedDurationMinutes ?? 6} min</span>
                    {timing.inProgressEstimate?.ticketId === nowServing.id && timing.inProgressEstimate.elapsedMinutes - timing.inProgressEstimate.totalDuration >= 1 && (
                      <span className="queue-overtime-badge" aria-label={`${Math.floor(timing.inProgressEstimate.elapsedMinutes - timing.inProgressEstimate.totalDuration)} minutes over the estimated session duration`}>
                        +{Math.floor(timing.inProgressEstimate.elapsedMinutes - timing.inProgressEstimate.totalDuration)} min
                      </span>
                    )}
                  </div>}
                  <p className="mt-2 text-body-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {nowServing.status === 'in_progress'
                      ? 'This ticket is at the piercing chair now ✨'
                      : 'Please come to the station! 💜'}
                  </p>
                </div>
              )}

              {/* Queue card */}
              <div className="w-full rounded-3xl p-5 sm:p-6 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                {data.waiting.length > 0 && (
                    <p className="flex items-center gap-1.5 text-label-xs" style={{ color: 'var(--color-text-faint)' }}>
                      <Ticket size={12} />
                      In line · {data.waiting.length} {data.waiting.length === 1 ? 'person' : 'people'}
                    </p>
                )}
                {nextUp && (
                  <div
                    key={nextUp.id}
                    data-moving={live}
                    className="queue-next rounded-2xl px-4 py-3"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
                  >
                    <span className="queue-next-aura" aria-hidden="true" />
                    <div className="queue-next-layout">
                      <span className="queue-next-ticket font-black font-mono">#{nextUp.ticketNumber}</span>
                      <div className="queue-next-copy">
                        <p className="queue-next-eyebrow">Next in line</p>
                        {nextUp.maskedNickname && <p className="queue-next-name">{nextUp.maskedNickname}</p>}
                        <p className="queue-next-estimate">{live ? timing.estimates.get(nextUp.id)?.formattedEstimate : 'Estimate paused'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {data.waiting.length > 1 && (
                  <div className="space-y-2">

                    <div
                      className={`space-y-2 ${data.waiting.length > 7 ? 'max-h-[385px] overflow-y-auto pr-1' : ''}`}
                    >
                      {data.waiting.slice(1).map((w, i) => (
                        <div
                          key={w.id}
                          className="flex items-center gap-3 rounded-2xl px-4 py-3"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--color-border)',
                            animation: `pk-fade-in 0.4s cubic-bezier(0.16,1,0.3,1) ${Math.min(i * 0.06, 0.5)}s both`,
                          }}
                        >
                          <span
                            className="w-7 h-7 flex items-center justify-center rounded-full font-mono font-bold flex-shrink-0"
                            style={{
                              background: w.position === 0 ? 'var(--color-brand)' : 'rgba(255,255,255,0.08)',
                              color: w.position === 0 ? '#fff' : 'var(--color-text-muted)',
                              fontSize: 11,
                            }}
                          >
                            {(w.position ?? i + 1) + 1}
                          </span>
                          <span className="font-black font-mono" style={{ fontSize: 15 }}>
                            #{w.ticketNumber}
                          </span>
                          <div className="min-w-0 flex-1 text-body-xs">
                            {w.maskedNickname && <p className="font-semibold break-all">{w.maskedNickname}</p>}
                            <p style={{ color: 'var(--color-text-muted)' }}>{live ? timing.estimates.get(w.id)?.formattedEstimate : 'Estimate paused'}</p>
                          </div>

                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </>
          )}
        </div>
      </div>
    </PublicShell>
  );
}

