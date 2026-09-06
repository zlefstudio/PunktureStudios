import { useEffect, useState } from 'react';
import { PublicShell, SectionCard } from './PublicShell';

/**
 * Paperless waiver — PRIVACY-FIRST.
 * No name, no signature, no data is collected or stored. The customer reads the
 * health / risks / aftercare info, ticks ONE consent box, and continues to the
 * live queue. Available in English and Tagalog.
 */

type Lang = 'en' | 'fil';

interface WaiverCopy {
  title: string;
  intro: string;
  healthTitle: string;
  healthIntro: string;
  healthItems: string[];
  risksTitle: string;
  risks: string;
  aftercareTitle: string;
  aftercare: string;
  consent: string;
  cta: string;
}

const CONTENT: Record<Lang, WaiverCopy> = {
  en: {
    title: 'Before we pierce',
    intro: 'Read carefully — your safety is our priority. This only takes a minute.',
    healthTitle: 'Health check',
    healthIntro: 'Tell your piercer if any of these apply to you:',
    healthItems: [
      'Pregnancy or breastfeeding',
      'Heart condition',
      'Diabetes',
      'Bleeding or clotting disorder',
      'Allergy to metal, latex, or antiseptics',
      'Keloid or severe scarring',
      'Epilepsy or seizures',
      'Weakened immune system',
      'Blood thinners (e.g. aspirin)',
      'Recent illness or vaccination',
      'Under the influence of alcohol or drugs',
    ],
    risksTitle: 'Risks',
    risks:
      'Piercing carries minor risks including bleeding, swelling, infection, allergic reaction, and scarring (including keloids). Correct aftercare greatly reduces these risks.',
    aftercareTitle: 'Aftercare',
    aftercare:
      'I will keep the piercing clean with sterile saline (2× daily), avoid touching or twisting the jewelry, and avoid swimming until fully healed. Open the aftercare guide using the Aftercare link on the live queue page.',
    consent: 'I have read and understood everything above, and I agree to proceed.',
    cta: 'Continue to live queue',
  },
  fil: {
    title: 'Bago tayo mag-pierce',
    intro: 'Basahin nang mabuti — inuuna namin ang kaligtasan mo. Sandali lang ito.',
    healthTitle: 'Health check',
    healthIntro: 'Sabihin sa piercer kung alinman sa mga ito ay naaangkop sa iyo:',
    healthItems: [
      'Buntis o nagpapasuso',
      'Sakit sa puso',
      'Diabetes',
      'Sakit sa pagdurugo o pamumuo ng dugo',
      'Allergy sa metal, latex, o antiseptic',
      'Keloid o matinding peklat',
      'Epilepsy o seizure',
      'Mahinang immune system',
      'Pampanipis ng dugo (tulad ng aspirin)',
      'Bagong sakit o bakuna',
      'Nakainom ng alak o nakadrugs',
    ],
    risksTitle: 'Mga panganib',
    risks:
      'May kaunting panganib ang pag-pierce kabilang ang pagdurugo, pamamaga, impeksyon, allergic reaction, at peklat (kasama ang keloid). Nakatutulong ang tamang aftercare para maiwasan ang mga ito.',
    aftercareTitle: 'Aftercare',
    aftercare:
      'Pananatilihin kong malinis ang piercing gamit ang sterile saline (2× araw-araw), iiwasan kong hawakan o paikutin ang alahas, at iiwasan kong lumangoy hanggang tuluyang gumaling. Buksan ang Aftercare link sa live queue page para sa buong gabay.',
    consent: 'Nabasa at naunawaan ko ang lahat sa itaas, at sumasang-ayon akong magpatuloy.',
    cta: 'Tuloy sa live queue',
  },
};

export function WaiverPage() {
  useEffect(() => {
    // Remove the old permanent skip flag; acknowledgments now last only for this visit.
    try { localStorage.removeItem('pkture_waiver'); localStorage.removeItem('pkture_lang'); } catch { /* Storage may be disabled. */ }
  }, []);
  const [lang, setLang] = useState<Lang>('en');
  const [agreed, setAgreed] = useState(false);



  const t = CONTENT[lang];

  function toggleLang(next: Lang) {
    setLang(next);
  }

  function continueToQueue() {
    if (!agreed) return;
    window.location.replace('/live.html');
  }

  const langBtn = (value: Lang, label: string) => {
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
        <SectionCard icon="🩺" title={t.healthTitle}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t.healthIntro}
          </p>
          <ul className="space-y-1.5">
            {t.healthItems.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-body-sm"
                style={{ color: 'var(--color-text)' }}
              >
                <span className="mt-0.5" style={{ color: 'var(--color-brand-text)' }}>
                  •
                </span>
                {item}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard icon="⚠️" title={t.risksTitle}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t.risks}
          </p>
        </SectionCard>

        <SectionCard icon="🩹" title={t.aftercareTitle}>
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t.aftercare}
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
