import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../firebase';
import type { PublicSettings } from '../types';
import { PublicShell } from './PublicShell';
import {
  Radio,
  Calendar,
  Sparkles,
  ShieldCheck,
  FileText,
  ArrowRight,
  MapPin,
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

export function HomePage() {
  const [publicSettings, setPublicSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(firestore, 'public', 'public'),
      (snap) => {
        setPublicSettings(snap.exists() ? (snap.data() as PublicSettings) : null);
      },
      () => setPublicSettings(null)
    );
    return unsub;
  }, []);

  const hasEvent =
    publicSettings !== null &&
    publicSettings.eventActive === true &&
    typeof publicSettings.eventDate === 'string' &&
    publicSettings.eventDate.length > 0;

  const eventDateLabel =
    hasEvent && publicSettings?.eventDate
      ? new Date(publicSettings.eventDate + 'T00:00:00').toLocaleDateString('en-PH', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : null;

  return (
    <PublicShell page="home">
      <div className="space-y-6 sm:space-y-8">
        {/* ── Hero Section ── */}
        <div
          className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-center space-y-4"
          style={{
            background:
              'radial-gradient(120% 120% at 50% 10%, rgba(139,92,246,0.22) 0%, rgba(17,21,32,0.85) 75%)',
            border: '1px solid rgba(168,85,247,0.30)',
            boxShadow: '0 20px 50px -20px rgba(139,92,246,0.35)',
          }}
        >
          {/* Glowing Top Pill */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase"
            style={{
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(168,85,247,0.35)',
              color: 'var(--color-brand-text)',
            }}
          >
            <Sparkles size={13} className="animate-pulse" />
            Sterile · Minimalist · Body Piercing
          </div>

          {/* Logo & Headline */}
          <div className="space-y-2">
            <h1
              className="font-sanguine leading-none select-none tracking-wider text-3xl sm:text-4xl md:text-5xl"
              style={{
                color: 'var(--color-text)',
                textShadow: '0 4px 20px rgba(139,92,246,0.4)',
              }}
            >
              PUNKTURE STUDIOS
            </h1>
            <p
              className="text-body-sm sm:text-body max-w-sm sm:max-w-md mx-auto"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Your modern piercing companion. Live pop-up queue, home studio bookings, and verified aftercare guides.
            </p>
          </div>

          {/* Quick CTA row */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="/live.html"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-ui-sm transition-transform active:scale-95"
              style={{
                background: 'var(--color-brand)',
                color: '#fff',
                boxShadow: 'var(--shadow-brand)',
                textDecoration: 'none',
              }}
            >
              <Radio size={16} />
              Live queue
            </a>
            <a
              href="/appointment.html"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-ui-sm transition-transform active:scale-95"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border-strong)',
                textDecoration: 'none',
              }}
            >
              <Calendar size={16} />
              Book appointment
            </a>
          </div>
        </div>

        {/* ── Active Pop-Up Callout Banner (if scheduled) ── */}
        {hasEvent && (
          <a
            href="/popup.html"
            className="block no-underline rounded-2xl p-4 sm:p-5 transition-all hover:border-violet-500/50"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(217,119,6,0.12))',
              border: '1px solid rgba(168,85,247,0.40)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(139,92,246,0.25)', color: 'var(--color-brand-text)' }}
                >
                  <MapPin size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                      style={{ background: 'rgba(217,119,6,0.2)', color: 'var(--color-warn-text)' }}
                    >
                      Next Pop-up
                    </span>
                    {eventDateLabel && (
                      <span className="text-body-xs font-mono font-bold" style={{ color: '#fff' }}>
                        {eventDateLabel}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-body truncate mt-0.5" style={{ color: 'var(--color-text)' }}>
                    {publicSettings?.eventTitle || 'Pop-up Event'}
                  </p>
                  {publicSettings?.eventLocation && (
                    <p className="text-body-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                      📍 {publicSettings.eventLocation}
                    </p>
                  )}
                </div>
              </div>
              <ArrowRight size={18} className="flex-shrink-0" style={{ color: 'var(--color-brand-text)' }} />
            </div>
          </a>
        )}

        {/* ── Quick Action Cards ── */}
        <div className="grid grid-cols-1 gap-3.5 sm:gap-4">
          {/* Card 1: Live Queue */}
          <a
            href="/live.html"
            className="group block rounded-2xl p-5 no-underline transition-all hover:translate-y-[-1px]"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-violet-600/30"
                  style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--color-brand-text)' }}
                >
                  <Radio size={20} />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-body" style={{ color: 'var(--color-text)' }}>
                      Live Queue
                    </h2>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}
                    >
                      Real-time
                    </span>
                  </div>
                  <p className="text-body-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    Check your place in line at our active pop-up events and see who is on deck.
                  </p>
                </div>
              </div>
              <ArrowRight
                size={18}
                className="flex-shrink-0 transition-transform group-hover:translate-x-1"
                style={{ color: 'var(--color-text-faint)', marginTop: 4 }}
              />
            </div>
          </a>

          {/* Card 2: Book Appointment */}
          <a
            href="/appointment.html"
            className="group block rounded-2xl p-5 no-underline transition-all hover:translate-y-[-1px]"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-violet-600/30"
                  style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--color-brand-text)' }}
                >
                  <Calendar size={20} />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-body" style={{ color: 'var(--color-text)' }}>
                      Book an Appointment
                    </h2>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--color-brand-text)', border: '1px solid rgba(168,85,247,0.3)' }}
                    >
                      Home Studio
                    </span>
                  </div>
                  <p className="text-body-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    Schedule a private, dedicated piercing session or styling consultation at our studio.
                  </p>
                </div>
              </div>
              <ArrowRight
                size={18}
                className="flex-shrink-0 transition-transform group-hover:translate-x-1"
                style={{ color: 'var(--color-text-faint)', marginTop: 4 }}
              />
            </div>
          </a>

          {/* Card 3: Next Pop-Up Event */}
          <a
            href="/popup.html"
            className="group block rounded-2xl p-5 no-underline transition-all hover:translate-y-[-1px]"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-violet-600/30"
                  style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--color-brand-text)' }}
                >
                  <Sparkles size={20} />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-body" style={{ color: 'var(--color-text)' }}>
                      Next Pop-up Event
                    </h2>
                  </div>
                  <p className="text-body-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    See upcoming event locations, dates, venue hours, and Google Maps directions.
                  </p>
                </div>
              </div>
              <ArrowRight
                size={18}
                className="flex-shrink-0 transition-transform group-hover:translate-x-1"
                style={{ color: 'var(--color-text-faint)', marginTop: 4 }}
              />
            </div>
          </a>

          {/* Card 4: Aftercare Guide */}
          <a
            href="/aftercare.html"
            className="group block rounded-2xl p-5 no-underline transition-all hover:translate-y-[-1px]"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-violet-600/30"
                  style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--color-brand-text)' }}
                >
                  <ShieldCheck size={20} />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-body" style={{ color: 'var(--color-text)' }}>
                      Aftercare Guide
                    </h2>
                  </div>
                  <p className="text-body-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    The LITHA method, saline spray frequency, the 50/50 rule, and normal healing signs.
                  </p>
                </div>
              </div>
              <ArrowRight
                size={18}
                className="flex-shrink-0 transition-transform group-hover:translate-x-1"
                style={{ color: 'var(--color-text-faint)', marginTop: 4 }}
              />
            </div>
          </a>

          {/* Card 5: Before We Pierce (Waiver) */}
          <a
            href="/waiver.html"
            className="group block rounded-2xl p-5 no-underline transition-all hover:translate-y-[-1px]"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-violet-600/30"
                  style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--color-brand-text)' }}
                >
                  <FileText size={20} />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-body" style={{ color: 'var(--color-text)' }}>
                      Before We Pierce
                    </h2>
                  </div>
                  <p className="text-body-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    Consent guidelines, health checks, titanium jewelry info, and age requirements.
                  </p>
                </div>
              </div>
              <ArrowRight
                size={18}
                className="flex-shrink-0 transition-transform group-hover:translate-x-1"
                style={{ color: 'var(--color-text-faint)', marginTop: 4 }}
              />
            </div>
          </a>
        </div>

        {/* ── Social / Instagram Banner ── */}
        <div
          className="rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left"
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(139,92,246,0.08))',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="space-y-1">
            <p className="font-bold text-body-sm" style={{ color: 'var(--color-text)' }}>
              Follow our work & piercing portfolio
            </p>
            <p className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>
              Pop-up schedules, healed client photos, and piercing care updates.
            </p>
          </div>
          <a
            href="https://www.instagram.com/punkture_studios/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-ui-sm transition-transform active:scale-95 flex-shrink-0"
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: 'var(--color-brand-text)',
              border: '1px solid rgba(168,85,247,0.3)',
              textDecoration: 'none',
            }}
          >
            <InstagramIcon size={16} />
            @punkture_studios ↗
          </a>
        </div>
      </div>
    </PublicShell>
  );
}
