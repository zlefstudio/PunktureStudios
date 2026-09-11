import { eventDateRange, nextEventSettings, upcomingEvents } from '../popupEvents';
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../firebase';
import type { PublicSettings } from '../types';
import { PublicShell } from './PublicShell';
import {
  CalendarHeart,
  MapPin,
  Clock,
  Navigation,
  Radio,
  Calendar,
  Sparkles,
  Home,
} from 'lucide-react';

function InstagramIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function safeHttpUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

export function PopupEventPage() {
  const [rawSettings, setPublicSettings] = useState<PublicSettings | null>(null);
  const publicSettings = nextEventSettings(rawSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(firestore, 'public', 'public'),
      (snap) => {
        setPublicSettings(snap.exists() ? (snap.data() as PublicSettings) : null);
        setLoading(false);
      },
      () => {
        setPublicSettings(null);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const ps = publicSettings;
  const nowStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const hasEvent =
    ps !== null &&
    ps.eventActive === true &&
    typeof ps.eventDate === 'string' &&
    ps.eventDate.length > 0 &&
    (ps.eventEndDate || ps.eventDate) >= nowStr;

  const eventDateLabel = hasEvent ? eventDateRange(publicSettings) : "";

  const mapUrl = safeHttpUrl(ps?.eventMapUrl);
  const studioMapUrl = safeHttpUrl(ps?.studioMapUrl);
  const eventTitle = ps?.eventTitle?.trim() || 'Next Pop-Up Event';
  const eventHours = ps?.eventHours?.trim();

  return (
    <PublicShell page="popup">
      <div className="space-y-6">
        {upcomingEvents(rawSettings).length > 1 && <section className="rounded-3xl border border-zinc-700 p-5 space-y-4"><h2 className="text-xl font-bold">Upcoming pop-ups</h2><div className="grid gap-3 sm:grid-cols-2">{upcomingEvents(rawSettings).map(event => <article key={event.id} className="rounded-2xl bg-white/5 p-4 space-y-2"><p className="text-sm text-violet-300">{eventDateRange(event)}</p><h3 className="text-lg font-bold">{event.eventTitle}</h3><p>{event.eventLocation}</p>{event.eventHours && <p className="text-sm text-zinc-400">{event.eventHours}</p>}{safeHttpUrl(event.eventMapUrl) && <a href={safeHttpUrl(event.eventMapUrl)!} target="_blank" rel="noopener noreferrer" className="text-violet-300 underline">View venue map</a>}</article>)}</div></section>}

        {/* Page Header */}
        <div className="text-center space-y-1.5">
          <h1
            className="font-black text-3xl sm:text-4xl tracking-tight"
            style={{ color: 'var(--color-text)' }}
          >
            POP-UP EVENT
          </h1>
          <p className="text-body-xs sm:text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            Catch us in person at community markets, bazaars, and guest pop-ups.
          </p>
        </div>

        {loading ? (
          <div
            className="rounded-3xl p-10 space-y-3 text-center"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div
              className="w-10 h-10 mx-auto rounded-full"
              style={{
                border: '2px solid transparent',
                borderTopColor: 'var(--color-brand)',
                animation: 'pk-spin 0.9s linear infinite',
              }}
            />
            <p className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>
              Checking event schedule…
            </p>
          </div>
        ) : hasEvent ? (
          /* ── Upcoming Pop-Up Card ── */
          <div className="space-y-4">
            <div
              className="rounded-3xl p-6 sm:p-8 text-center space-y-4 overflow-hidden relative"
              style={{
                background:
                  'radial-gradient(120% 120% at 50% 0%, rgba(139,92,246,0.25) 0%, rgba(17,21,32,0.92) 80%)',
                border: '1px solid rgba(168,85,247,0.45)',
                boxShadow: '0 20px 60px -20px rgba(139,92,246,0.4)',
              }}
            >
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase"
                style={{
                  background: 'rgba(217,119,6,0.18)',
                  border: '1px solid rgba(217,119,6,0.4)',
                  color: 'var(--color-warn-text)',
                }}
              >
                <CalendarHeart size={13} />
                CONFIRMED DATE
              </div>

              <div className="space-y-1">
                <h2
                  className="font-black leading-tight text-2xl sm:text-3xl md:text-4xl"
                  style={{ color: 'var(--color-text)', letterSpacing: '-0.02em' }}
                >
                  {eventTitle}
                </h2>
                <p className="font-extrabold text-lg sm:text-xl text-white">
                  {eventDateLabel}
                </p>
              </div>

              {/* Event details block */}
              <div
                className="rounded-2xl p-4 sm:p-5 text-left space-y-3 mx-auto max-w-sm"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {ps?.eventLocation && (
                  <div className="flex items-start gap-3">
                    <MapPin size={18} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-brand-text)' }} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-faint)' }}>
                        Location
                      </p>
                      <p className="font-bold text-body-sm sm:text-body text-white">
                        {ps.eventLocation}
                      </p>
                    </div>
                  </div>
                )}

                {eventHours && (
                  <div className="flex items-start gap-3">
                    <Clock size={18} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-brand-text)' }} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-faint)' }}>
                        Hours
                      </p>
                      <p className="font-mono text-body-sm sm:text-body font-semibold text-white">
                        {eventHours}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-ui-sm transition-transform active:scale-95"
                    style={{
                      background: 'var(--color-brand)',
                      color: '#fff',
                      boxShadow: 'var(--shadow-brand)',
                      textDecoration: 'none',
                    }}
                  >
                    <Navigation size={16} />
                    Open in Maps
                  </a>
                )}
                <a
                  href="/live.html"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-ui-sm transition-transform active:scale-95"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border-strong)',
                    textDecoration: 'none',
                  }}
                >
                  <Radio size={16} />
                  View Live Queue
                </a>
              </div>
            </div>

            {/* Event note */}
            <div
              className="rounded-2xl p-4 text-center space-y-1"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-body-xs font-semibold text-white">
                💡 Joining the queue at the event?
              </p>
              <p className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>
                Get your ticket at our booth, then track your wait time in real-time from your phone!
              </p>
            </div>
          </div>
        ) : (
          /* ── No Active Pop-Up (Home Studio state) ── */
          <div className="space-y-4">
            <div
              className="rounded-3xl p-6 sm:p-8 text-center space-y-4"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div
                className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center"
                style={{
                  background: 'rgba(139,92,246,0.12)',
                  color: 'var(--color-brand-text)',
                  border: '1px solid rgba(168,85,247,0.25)',
                }}
              >
                <Sparkles size={28} />
              </div>

              <div className="space-y-1">
                <h2 className="font-bold text-body sm:text-lg text-white">
                  No Pop-Up Scheduled Right Now
                </h2>
                <p className="text-body-xs sm:text-body-sm max-w-sm mx-auto" style={{ color: 'var(--color-text-muted)' }}>
                  We don't have an active pop-up market date at this moment. But our private home studio is open for appointments!
                </p>
              </div>

              {ps?.studioAddress && (
                <div
                  className="rounded-2xl p-4 text-left mx-auto max-w-sm space-y-1.5"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div className="flex items-center gap-2 text-label-xs" style={{ color: 'var(--color-brand-text)' }}>
                    <Home size={14} />
                    <span>Home Studio Location</span>
                  </div>
                  <p className="text-body-xs text-white">
                    📍 {ps.studioAddress}
                  </p>
                  {(studioMapUrl || mapUrl) && (
                    <a
                      href={studioMapUrl || mapUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-body-xs font-semibold underline underline-offset-4 mt-1"
                      style={{ color: 'var(--color-brand-text)' }}
                    >
                      <Navigation size={12} />
                      View location in Maps ↗
                    </a>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <a
                  href="/appointment.html"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-ui-sm transition-transform active:scale-95"
                  style={{
                    background: 'var(--color-brand)',
                    color: '#fff',
                    boxShadow: 'var(--shadow-brand)',
                    textDecoration: 'none',
                  }}
                >
                  <Calendar size={16} />
                  Book home studio appointment
                </a>
              </div>
            </div>

            {/* Follow Instagram for announcements */}
            <div
              className="rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3"
              style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(139,92,246,0.08))',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="space-y-0.5">
                <p className="font-bold text-body-xs text-white">
                  Want to know our next pop-up drop?
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  We announce event dates first on Instagram stories.
                </p>
              </div>
              <a
                href="https://www.instagram.com/punkture_studios/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-body-xs font-bold transition-all flex-shrink-0"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: 'var(--color-brand-text)',
                  border: '1px solid rgba(168,85,247,0.3)',
                  textDecoration: 'none',
                }}
              >
                <InstagramIcon size={14} />
                Follow ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
