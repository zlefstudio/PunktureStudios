import { useEffect, useState } from 'react';
import { PublicShell, SectionCard } from './PublicShell';

/**
 * Paperless waiver — PRIVACY-FIRST.
 * No name, no signature, no data is collected or stored. The customer reads the
 * health / risks / aftercare info, ticks ONE consent box, and continues to the
 * live queue. Available in English and Tagalog.
 */

import { WAIVER_CONTENT, type WaiverLang } from '../waiverContent';


export function WaiverPage() {
  useEffect(() => {
    // Remove the old permanent skip flag; acknowledgments now last only for this visit.
    try { localStorage.removeItem('pkture_waiver'); localStorage.removeItem('pkture_lang'); } catch { /* Storage may be disabled. */ }
  }, []);
  const [lang, setLang] = useState<WaiverLang>('en');
  const [agreed, setAgreed] = useState(false);

  const t = WAIVER_CONTENT[lang];

  function toggleLang(next: WaiverLang) {
    setLang(next);
  }

  function continueToQueue() {
    if (!agreed) return;
    window.location.replace('/live.html');
  }

  const langBtn = (value: WaiverLang, label: string) => {
    const active = lang === value;
    return (
      <button
        onClick={() => toggleLang(value)}
        className="px-3 py-1 rounded-full text-[11px] font-bold"
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

  return (
    <PublicShell page="waiver">
      {/* Language toggle */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {langBtn('en', 'English')}
        {langBtn('fil', 'Tagalog')}
      </div>

      <h1 className="font-black leading-tight" style={{ fontSize: 24 }}>
        {t.title}
      </h1>
      <p className="text-body-sm mt-1.5 mb-5" style={{ color: 'var(--color-text-muted)' }}>
        {t.intro}
      </p>

      <div className="space-y-4">
        {/* Health Check: Cannot pierce & Disclose */}
        <SectionCard title="Health & Safety Check">
          <div className="space-y-3.5">
            <div>
              <p className="text-body-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-error-text)' }}>
                🚫 {t.cannotPierceTitle}
              </p>
              <ul className="space-y-1.5 pl-1">
                {t.cannotPierceItems.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-body-sm" style={{ color: 'var(--color-text)' }}>
                    <span className="mt-0.5" style={{ color: 'var(--color-error-text)' }}>✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-body-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-warn-text)' }}>
                ⚠️ {t.discloseTitle}
              </p>
              <ul className="space-y-1.5 pl-1">
                {t.discloseItems.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-body-sm" style={{ color: 'var(--color-text)' }}>
                    <span className="mt-0.5" style={{ color: 'var(--color-warn-text)' }}>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>

        {/* Caffeine check */}
        <SectionCard title={t.caffeineTitle}>
          <p className="text-body-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {t.caffeineText}
          </p>
        </SectionCard>

        {/* 50/50 partnership & jewelry */}
        <SectionCard title={t.partnershipTitle}>
          <div className="space-y-2 text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t.partnershipText.map((p, idx) => (
              <p key={idx} className="leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </SectionCard>

        {/* Risks */}
        <SectionCard icon="⚠️" title={t.risksTitle}>
          <p className="text-body-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {t.risks}
          </p>
        </SectionCard>
      </div>

      {/* Single consent checkbox + continue */}
      <label
        className="flex items-start gap-3 mt-6 p-4 rounded-2xl"
        style={{
          background: agreed ? 'rgba(16,185,129,0.10)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${agreed ? 'rgba(16,185,129,0.35)' : 'var(--color-border-strong)'}`,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
          style={{ accentColor: 'var(--color-brand)', width: 16, height: 16, flexShrink: 0 }}
        />
        <span className="text-body-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {t.consent}
        </span>
      </label>

      <button
        onClick={continueToQueue}
        disabled={!agreed}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-ui font-bold mt-4"
        style={{
          background: agreed ? 'var(--color-brand)' : 'rgba(255,255,255,0.06)',
          color: agreed ? '#fff' : 'var(--color-text-faint)',
          border: 'none',
          cursor: agreed ? 'pointer' : 'not-allowed',
          boxShadow: agreed ? 'var(--shadow-brand)' : 'none',
          transition: 'all var(--duration-base) var(--ease-out)',
        }}
      >
        {t.cta} →
      </button>
    </PublicShell>
  );
}

