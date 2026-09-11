import { eventDateRange, nextEventSettings } from '../popupEvents';
import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, collection, query, doc } from 'firebase/firestore';
import { firestore } from '../firebase';
import { Ticket, CalendarHeart } from 'lucide-react';
import type { PublicSettings } from '../types';
import { PiercingRitualAnimation } from './PiercingRitualAnimation';
import { PublicShell } from './PublicShell';
import { safeHttpUrl } from '../validation';

/**
 * PUBLIC LIVE QUEUE — customer-facing, real-time, privacy-safe.
 * Reads only the sanitized `publicQueue` collection that the cashier app
 * publishes (ticket number + status; NEVER names/notes/prices).
 */

type LiveStatus = 'waiting' | 'called' | 'in_progress';

interface PublicRow {
  ticketNumber: number;
  status: LiveStatus;
  position: number | null;
  seq: number | null;
  createdAt?: number;
  calledAt?: number | null;
  startedAt?: number | null;
  updatedAt?: number;
}

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

export function LiveQueuePage() {
  const [heartbeat, setHeartbeat] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => onSnapshot(doc(firestore, 'public', 'heartbeat'), snap => {
    const stamp = snap.data()?.publishedAt; setHeartbeat(stamp?.toMillis?.() ?? 0);
  }, () => setHeartbeat(0)), []);
  const [rows, setRows] = useState<PublicRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawSettings, setPublicSettings] = useState<PublicSettings | null>(null);
  const publicSettings = nextEventSettings(rawSettings);

  useEffect(() => {
    const q = query(collection(firestore, 'publicQueue'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const out: PublicRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as PublicRow;
          if (typeof data.ticketNumber !== 'number') return;
          out.push(data);
        });
        setRows(out);
        setError(null);
      },
      (err) => {
        setError(friendlyError(err));
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(firestore, 'public', 'public'),
      (snap) => {
        setPublicSettings(snap.exists() ? snap.data() as PublicSettings : null);
      },
      () => {
        setPublicSettings(null);
      }
    );
    return unsub;
  }, []);

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
  const fresh = heartbeat > 0 && now - heartbeat < 90000 && now - heartbeat > -60000;
  const live = hasLive && fresh && !error;
  const nowServing = data.inProgress[0] ?? data.called[0];
  const nextUp = data.waiting[0];
  const ps = publicSettings;
  const hasEvent =
    ps !== null &&
    ps.eventActive === true &&
    typeof ps.eventDate === 'string' &&
    ps.eventDate.length > 0 && (ps.eventEndDate || ps.eventDate) >= new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const eventDateLabel = hasEvent ? eventDateRange(publicSettings) : "";
  const mapUrl = safeHttpUrl(publicSettings?.eventMapUrl);
  const studioMapUrl = safeHttpUrl(publicSettings?.studioMapUrl);
  const eventTitle = publicSettings?.eventTitle?.trim() || 'Next pop-up event coming soon';
  const eventHours = publicSettings?.eventHours?.trim();
  const showStage = hasEvent || hasLive;

  return (
    <PublicShell page="live" wide>
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
          {live ? 'LIVE' : hasLive ? 'UPDATES PAUSED' : fresh ? 'QUEUE EMPTY' : 'OFFLINE'}
        </span>
        <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
          {lastUpdated
            ? `Updated ${new Date(lastUpdated).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`
            : 'Waiting for updates…'}
        </span>
      </div>

      {hasLive && !fresh && <p role="status" className="mb-4 rounded-xl bg-amber-950 p-3 text-amber-100">Updates are paused. This is the last known queue; please check with staff.</p>}
      <div className={`grid grid-cols-1 ${showStage ? 'sm:grid-cols-2' : ''} gap-5 sm:gap-8 items-start`}>
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
            hasEvent ? (
              <div
                id="next-popup"
                className="rounded-3xl p-8 text-center space-y-3 overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, rgba(139,92,246,0.16), rgba(217,119,6,0.08))',
                  border: '1px solid rgba(168,85,247,0.35)',
                }}
              >
                <div className="text-3xl" style={{ animation: 'pk-logo-float 2.6s ease-in-out infinite' }}>
                  <CalendarHeart size={30} style={{ margin: '0 auto', color: 'var(--color-brand-text)' }} />
                </div>
                <p className="text-label-xs" style={{ color: 'var(--color-warn-text)' }}>
                  SAVE THE DATE
                </p>
                <p className="font-black leading-tight tracking-tight" style={{ fontSize: 28, color: 'var(--color-text)' }}>
                  {eventTitle}
                </p>
                <p className="font-black" style={{ fontSize: 20 }}>
                  {eventDateLabel}
                </p>
                {publicSettings?.eventLocation && (
                  <p className="font-semibold text-body" style={{ color: 'var(--color-text)' }}>
                    📍 {publicSettings.eventLocation}
                  </p>
                )}
                {eventHours && (
                  <p className="text-body-sm font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    🕒 {eventHours}
                  </p>
                )}
                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-2xl font-bold"
                    style={{ background: 'var(--color-brand)', color: '#fff', boxShadow: 'var(--shadow-brand)', textDecoration: 'none' }}
                  >
                    Open in Maps
                  </a>
                )}
              </div>
            ) : (
              <div
                id="next-popup"
                className="rounded-3xl p-8 text-center space-y-3 overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, rgba(139,92,246,0.16), rgba(217,119,6,0.06))',
                  border: '1px solid rgba(168,85,247,0.30)',
                }}
              >
                <div className="text-3xl" style={{ animation: 'pk-logo-float 2.6s ease-in-out infinite' }}>✨</div>
                <p className="text-label-xs" style={{ color: 'var(--color-warn-text)' }}>
                  SAVE THE DATE
                </p>
                <p className="font-black leading-tight tracking-tight" style={{ fontSize: 28, color: 'var(--color-text)' }}>
                  {eventTitle}
                </p>
                {publicSettings?.studioAddress && (
                  <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
                    📍 {publicSettings.studioAddress}
                  </p>
                )}
                {(studioMapUrl || mapUrl) && (
                  <a
                    href={studioMapUrl || mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-2xl font-bold"
                    style={{ background: 'var(--color-brand)', color: '#fff', boxShadow: 'var(--shadow-brand)', textDecoration: 'none' }}
                  >
                    View location
                  </a>
                )}
                <div className="flex flex-col sm:flex-row items-stretch justify-center gap-2 pt-1">
                  <a
                    href="/appointment.html"
                    className="inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-2xl font-bold"
                    style={{ background: 'var(--color-brand)', color: '#fff', boxShadow: 'var(--shadow-brand)', textDecoration: 'none' }}
                  >
                    Book an appointment
                  </a>
                  <a
                    href="/popup.html"
                    className="inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-2xl font-bold"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text)', border: '1px solid var(--color-border)', textDecoration: 'none' }}
                  >
                    Next pop-up event
                  </a>
                </div>
              </div>
            )
          ) : (
            <>
              {/* Now serving */}
              {nowServing && (
                <div
                  className="relative overflow-hidden rounded-3xl p-6 text-center"
                  style={{
                    background: 'linear-gradient(145deg, rgba(139,92,246,0.22), rgba(139,92,246,0.06))',
                    border: '1px solid rgba(168,85,247,0.45)',
                    boxShadow: '0 0 0 1px rgba(168,85,247,0.12), 0 18px 50px -20px rgba(139,92,246,0.5)',
                  }}
                >
                  <p className="text-label-xs mb-1" style={{ color: 'var(--color-brand-text)' }}>
                    {nowServing.status === 'in_progress' ? '⚡ NOW SERVING' : '📣 NOW CALLING'}
                  </p>
                  <p className="font-black leading-none" style={{ fontSize: 'clamp(44px, 14vw, 72px)', fontFamily: 'var(--font-mono)', color: '#fff' }}>
                    #{nowServing.ticketNumber}
                  </p>
                  <p className="mt-2 text-body-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {nowServing.status === 'in_progress'
                      ? 'This ticket is at the piercing chair now ✨'
                      : 'Please come to the station! 💜'}
                  </p>
                </div>
              )}

              {/* Queue card */}
              <div className="w-full rounded-3xl p-5 sm:p-6 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                {nextUp && (
                  <div
                    className="flex items-center justify-between rounded-2xl px-5 py-4"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
                  >
                    <span className="text-body-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                      Next in line
                    </span>
                    <span className="font-black font-mono" style={{ fontSize: 22, color: '#a78bfa' }}>
                      #{nextUp.ticketNumber}
                    </span>
                  </div>
                )}

                {data.waiting.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 text-label-xs" style={{ color: 'var(--color-text-faint)' }}>
                      <Ticket size={12} />
                      In line · {data.waiting.length} {data.waiting.length === 1 ? 'person' : 'people'}
                    </p>
                    <div
                      className={`space-y-2 ${data.waiting.length > 7 ? 'max-h-[385px] overflow-y-auto pr-1' : ''}`}
                    >
                      {data.waiting.map((w, i) => (
                        <div
                          key={`${w.ticketNumber}-${w.position}`}
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
                            {(w.position ?? i) + 1}
                          </span>
                          <span className="font-black font-mono" style={{ fontSize: 15 }}>
                            #{w.ticketNumber}
                          </span>
                          {w.position === 0 && !nowServing && (
                            <span
                              className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(217,119,6,0.15)', color: 'var(--color-warn-text)', border: '1px solid rgba(217,119,6,0.3)' }}
                            >
                              NEXT
                            </span>
                          )}
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

