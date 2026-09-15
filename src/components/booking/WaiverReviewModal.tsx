import { RESERVATION_POLICY } from '../../bookingApi';
import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, X } from 'lucide-react';
import { WAIVER_CONTENT, type WaiverLang } from '../../waiverContent';

interface WaiverReviewModalProps {
  agreed: boolean;
  onAgreedChange: (v: boolean) => void;
  privacyAgreed: boolean;
  onPrivacyAgreedChange: (v: boolean) => void;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: () => void;
}

/**
 * Step-3 consent gate for the booking flow. Renders the SAME copy shown on
 * /waiver.html (via the shared WAIVER_CONTENT module) inside a modal — it is
 * intentionally NOT the live waiver page component.
 */
export function WaiverReviewModal({
  agreed,
  onAgreedChange,
  privacyAgreed,
  onPrivacyAgreedChange,
  busy = false,
  error = null,
  onClose,
  onSubmit,
}: WaiverReviewModalProps) {
  const [lang, setLang] = useState<WaiverLang>('en');
  const t = WAIVER_CONTENT[lang];

  // Pin the page while the full-screen waiver is open, then restore it — the panel
  // scrolls internally, so the page must not scroll behind it.
  useLayoutEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, width: body.style.width };
    Object.assign(body.style, { overflow: 'hidden', position: 'fixed', top: `${-scrollY}px`, width: '100%' });
    return () => {
      Object.assign(body.style, prev);
      window.scrollTo(0, scrollY);
    };
  }, []);

  const langBtn = (value: WaiverLang, label: string) => {
    const active = lang === value;
    return (
      <button
        type="button"
        onClick={() => setLang(value)}
        className="px-2.5 py-1 rounded-full text-[10px] font-bold"
        style={{
          background: active ? 'var(--color-brand)' : 'rgba(255,255,255,0.06)',
          color: active ? '#fff' : 'var(--color-text-muted)',
          border: active ? 'none' : '1px solid var(--color-border)',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );
  };

  // Rendered through a portal to <body>: PublicShell's content wrapper ends a
  // `pk-fade-in` animation on `transform: translateY(0)`, which becomes the
  // containing block for position:fixed descendants. Inline, the modal would be
  // "fixed" to the content column and its pay button would land off-screen.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4"
      style={{ background: 'rgba(0, 0, 0, 0.86)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="waiver-modal relative w-full flex flex-col rounded-none sm:rounded-3xl sm:max-w-2xl lg:max-w-3xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Before We Pierce — Studio Waiver"
      >
        {/* Header — title + close only; the language switch lives inside the body */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-800 gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck size={22} className="text-violet-400 flex-shrink-0" />
            <h3 className="font-bold text-body text-white truncate">Before We Pierce — Studio Waiver</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-zinc-400 hover:text-white ml-1 flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Waiver body — scrolls inside the panel */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4">

        {/* Language switch — moved down from the header */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-faint)' }}>Language · Wika</span>
          <div className="flex items-center gap-1.5">
            {langBtn('en', 'EN')}
            {langBtn('fil', 'FIL')}
          </div>
        </div>

        {/* Intro */}
        <p className="text-body-xs text-zinc-300 leading-relaxed">{t.intro}</p>

        {/* Health & Safety Check */}
        <div className="space-y-2">
          <p className="text-body-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-error-text)' }}>
            {t.cannotPierceTitle}
          </p>
          <ul className="space-y-1.5 pl-1">
            {t.cannotPierceItems.map((item) => (
              <li key={item} className="flex items-start gap-2 text-body-xs" style={{ color: 'var(--color-text)' }}>
                <span className="mt-0.5" style={{ color: 'var(--color-error-text)' }}>✕</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-body-xs font-bold uppercase tracking-wider pt-1" style={{ color: 'var(--color-warn-text)' }}>
            {t.discloseTitle}
          </p>
          <ul className="space-y-1.5 pl-1">
            {t.discloseItems.map((item) => (
              <li key={item} className="flex items-start gap-2 text-body-xs" style={{ color: 'var(--color-text)' }}>
                <span className="mt-0.5" style={{ color: 'var(--color-warn-text)' }}>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Coffee & Caffeine */}
        <div className="pt-1">
          <p className="text-body-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-warn-text)' }}>
            {t.caffeineTitle}
          </p>
          <p className="text-body-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {t.caffeineText}
          </p>
        </div>

        {/* 50/50 Rule & Jewelry Choice */}
        <div>
          <p className="text-body-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-warn-text)' }}>
            {t.partnershipTitle}
          </p>
          <div className="space-y-2 text-body-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t.partnershipText.map((p, i) => (
              <p key={i} className="leading-relaxed">{p}</p>
            ))}
          </div>
        </div>

        {/* Risks & Healing */}
        <div>
          <p className="text-body-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-warn-text)' }}>
            {t.risksTitle}
          </p>
          <p className="text-body-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {t.risks}
          </p>
        </div>

        <p className="text-body-xs border border-violet-500 rounded-xl p-3">{RESERVATION_POLICY} By continuing, you accept this deposit policy and the studio waiver above.</p>
        </div>

        {/* Footer — consent and the pay button stay on screen, above the mobile safe area */}
        <div
          className="flex-shrink-0 px-4 sm:px-6 pt-3.5 space-y-3 border-t border-zinc-800"
          style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))' }}
        >
        {/* Consent checkbox */}
        <label
          className="flex items-start gap-3 p-3.5 rounded-2xl cursor-pointer"
          style={{
            background: agreed ? 'rgba(16,185,129,0.10)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${agreed ? 'rgba(16,185,129,0.35)' : 'var(--color-border-strong)'}`,
          }}
        >
          <input
            type="checkbox"
            id="waiver-modal-agree"
            checked={agreed}
            onChange={(e) => onAgreedChange(e.target.checked)}
            className="mt-0.5"
            style={{ accentColor: 'var(--color-brand)', width: 16, height: 16, flexShrink: 0 }}
          />
          <span className="text-body-xs font-semibold" style={{ color: 'var(--color-text)' }}>
            {t.consent}
          </span>
        </label>

        {/* Privacy & Legal consent */}
        <label
          className="flex items-start gap-3 p-3.5 rounded-2xl cursor-pointer"
          style={{
            background: privacyAgreed ? 'rgba(16,185,129,0.10)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${privacyAgreed ? 'rgba(16,185,129,0.35)' : 'var(--color-border-strong)'}`,
          }}
        >
          <input
            type="checkbox"
            id="waiver-modal-privacy"
            checked={privacyAgreed}
            onChange={(e) => onPrivacyAgreedChange(e.target.checked)}
            className="mt-0.5"
            style={{ accentColor: 'var(--color-brand)', width: 16, height: 16, flexShrink: 0 }}
          />
          <span className="text-body-xs font-semibold" style={{ color: 'var(--color-text)' }}>
            {t.privacyConsent}{' '}
            <a
              href="https://punkture-studios.web.app/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline underline-offset-2"
              style={{ color: 'var(--color-brand-text)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {t.privacyView}
            </a>
          </span>
        </label>

        {error && <p className="text-body-xs font-semibold text-red-400">{error}</p>}

        <button
          type="button"
          disabled={!agreed || !privacyAgreed || busy}
          onClick={onSubmit}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-ui-sm text-white transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--color-brand)', boxShadow: 'var(--shadow-brand)', border: 'none' }}
        >
          {busy ? 'Preparing payment…' : 'Agree & Continue to PHP 100.00 Payment'}
        </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

