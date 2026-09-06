import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, collection, query, doc } from 'firebase/firestore';
import { firestore } from '../firebase';
import { Ticket, CalendarHeart } from 'lucide-react';
import type { PublicSettings } from '../types';
import { PiercingRitualAnimation } from './PiercingRitualAnimation';

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
  const [rows, setRows] = useState<PublicRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publicSettings, setPublicSettings] = useState<PublicSettings | null>(null);

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

  // "Next pop-up" info edited by staff in the 🌐 Public tab.
  useEffect(() => {
    const unsub = onSnapshot(
      doc(firestore, 'public', 'public'),
      (snap) => {
        if (snap.exists()) setPublicSettings(snap.data() as PublicSettings);
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
  const nowServing = data.inProgress[0] ?? data.called[0];
  const nextUp = data.waiting[0];
  const ps = publicSettings;
  const hasEvent =
    ps !== null &&
    ps.eventActive === true &&
    typeof ps.eventDate === 'string' &&
    ps.eventDate.length > 0;
  const eventDateLabel = hasEvent && publicSettings?.eventDate
    ? new Date(publicSettings.eventDate + 'T00:00:00').toLocaleDateString('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';
  const mapUrl = publicSettings?.eventMapUrl?.trim();
  const showStage = hasEvent || hasLive;

  return (
    <div
      className="min-h-dvh w-full overflow-x-hidden"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(139,92,246,0.20) 0%, transparent 60%), radial-gradient(900px 500px at 90% 110%, rgba(217,119,6,0.12) 0%, transparent 55%), var(--color-base)',
        color: 'var(--color-text)',
        fontFamily: 'Inter, system-ui, sans-serif',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div
        className="mx-auto w-full max-w-md md:max-w-4xl lg:max-w-5xl px-4 sm:px-6 py-6 md:py-8 space-y-6"
        style={{ animation: 'pk-fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both' }}
      >
        {/* ── Brand header ── */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="PUNKTURE STUDIOS"
              className="w-9 h-9 object-contain drop-shadow select-none"
            />
            <p
              className="font-sanguine select-none leading-none"
              style={{ fontSize: 17, letterSpacing: '0.12em', color: 'var(--color-text)' }}
            >
              PUNKTURE STUDIOS
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
            style={{ background: hasLive ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)', color: hasLive ? '#34d399' : 'var(--color-text-faint)', border: `1px solid ${hasLive ? 'rgba(16,185,129,0.35)' : 'var(--color-border)'}` }}
          >
            <span className="relative flex h-2 w-2">
              {hasLive && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${hasLive ? 'bg-emerald-400' : 'bg-white/20'}`}
              />
            </span>
            {hasLive ? 'LIVE' : 'OFFLINE'}
          </span>
        </header>

        {/* ── Main Layout: Mobile stacked (stage on top), Desktop 2-column (stage beside queue) ── */}
        <div className={`grid grid-cols-1 ${showStage ? 'md:grid-cols-2' : ''} gap-6 md:gap-8 items-start`}>
          {/* Stage: Top on mobile, left on desktop */}
          {showStage && (
            <div className="w-full flex justify-center md:sticky md:top-6">
              <PiercingRitualAnimation />
            </div>
          )}

          {/* Queue Body: Below stage on mobile, right column on desktop */}
          <div className="w-full space-y-6">
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
              <div className="rounded-2xl p-8 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
                <div className="w-12 h-12 mx-auto rounded-full" style={{ border: '2px solid transparent', borderTopColor: 'var(--color-brand)', animation: 'pk-spin 0.9s linear infinite' }} />
                <p className="text-center text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Loading live queue…
                </p>
              </div>
            ) : !hasLive ? (
              hasEvent ? (
                <div
                  className="rounded-3xl p-7 text-center space-y-3 overflow-hidden"
                  style={{
                    background: 'linear-gradient(145deg, rgba(139,92,246,0.16), rgba(217,119,6,0.08))',
                    border: '1px solid rgba(168,85,247,0.35)',
                  }}
                >
                  <div className="text-3xl" style={{ animation: 'pk-logo-float 2.6s ease-in-out infinite' }}>
                    <CalendarHeart size={30} style={{ margin: '0 auto', color: 'var(--color-brand-text)' }} />
                  </div>
                  <p className="text-label-xs" style={{ color: 'var(--color-warn-text)' }}>
                    NEXT POP-UP · SAVE THE DATE
                  </p>
                  <p className="font-black leading-tight" style={{ fontSize: 22 }}>
                    {eventDateLabel}
                  </p>
                  {publicSettings?.eventLocation && (
                    <p className="font-semibold text-body" style={{ color: 'var(--color-text)' }}>
                      📍 {publicSettings.eventLocation}
                    </p>
                  )}
                  {mapUrl && (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-2xl font-bold"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-border-strong)',
                        textDecoration: 'none',
                      }}
                    >
                      📍 Open in Maps
                    </a>
                  )}
                  <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
                    No live queue yet — but you can book a home studio appointment! ✨
                  </p>
                  <a
                    href="/appointment.html"
                    className="inline-block px-6 py-3 rounded-2xl font-black mt-1"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-warn), #d97706)',
                      color: '#fff',
                      boxShadow: 'var(--shadow-brand)',
                    }}
                  >
                    📅 Book a home studio appointment
                  </a>
                </div>
              ) : (
                <div className="rounded-2xl p-8 text-center space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
                  <div className="text-3xl" style={{ animation: 'pk-logo-float 2.6s ease-in-out infinite' }}>✨</div>
                  <p className="font-black" style={{ fontSize: 17 }}>No live queue right now</p>
                  <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
                    We're between pop-ups — stay tuned for the next schedule. 👀
                  </p>
                  {mapUrl && (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-2xl font-bold"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-border-strong)',
                        textDecoration: 'none',
                      }}
                    >
                      📍 View location
                    </a>
                  )}
                  <a
                    href="/appointment.html"
                    className="inline-block px-5 py-2.5 rounded-2xl font-bold mt-1"
                    style={{ background: 'var(--color-brand)', color: '#fff' }}
                  >
                    Book a home studio appointment
                  </a>
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
                    <p className="font-black leading-none" style={{ fontSize: 64, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                      #{nowServing.ticketNumber}
                    </p>
                    <p className="mt-2 text-body-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {nowServing.status === 'in_progress'
                        ? 'This ticket is at the piercing chair now ✨'
                        : 'Please come to the station! 💜'}
                    </p>
                  </div>
                )}

                {/* Next up */}
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

                {/* Waiting list */}
                {data.waiting.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 text-label-xs" style={{ color: 'var(--color-text-faint)' }}>
                      <Ticket size={12} />
                      In line · {data.waiting.length} {data.waiting.length === 1 ? 'person' : 'people'}
                    </p>
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
                          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(217,119,6,0.15)', color: 'var(--color-warn-text)', border: '1px solid rgba(217,119,6,0.3)' }}>
                            NEXT
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="pt-2 pb-1 text-center space-y-1">
          <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
            {lastUpdated
              ? `Updated ${new Date(lastUpdated).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })} · live`
              : 'Waiting for live updates…'}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--color-text-faint)', opacity: 0.6 }}>
            PUNKTURE STUDIOS · privacy-safe (no names shown)
          </p>
        </footer>
      </div>
    </div>
  );
}

