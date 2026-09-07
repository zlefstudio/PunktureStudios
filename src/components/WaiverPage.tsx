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
  cannotPierceTitle: string;
  cannotPierceItems: string[];
  discloseTitle: string;
  discloseItems: string[];
  caffeineTitle: string;
  caffeineText: string;
  partnershipTitle: string;
  partnershipText: string[];
  risksTitle: string;
  risks: string;
  consent: string;
  cta: string;
}

const CONTENT: Record<Lang, WaiverCopy> = {
  en: {
    title: 'Before we pierce',
    intro: 'Read carefully. Your safety and healing are our top priorities, and this takes less than a minute.',
    cannotPierceTitle: 'For your safety, we cannot pierce you today if:',
    cannotPierceItems: [
      'Under the influence of alcohol, recreational drugs, or intoxicants',
      'Currently pregnant or actively breastfeeding',
      'Active skin rash, lesion, open wound, or sunburn on the target area',
      'High fever or feeling acutely sick or unwell',
    ],
    discloseTitle: 'Conditions to discuss (proceeding is at your own risk):',
    discloseItems: [
      'For minors, we are not liable for any disputes or consequences involving their parent or guardian.',
      'Diabetes, heart condition, or compromised immune system',
      'Bleeding/clotting disorder or currently on blood thinners (e.g. aspirin)',
      'History of keloids, hypertrophic scarring, or severe scar tissue',
      'Known allergies to metals (e.g. nickel), latex, or topical antiseptics',
      'Tendency to feel dizzy, faint (vasovagal response), or history of seizures',
    ],
    caffeineTitle: 'Coffee & Caffeine Notice',
    caffeineText:
      'Had coffee, energy drinks, or pre-workout today? Caffeine can elevate heart rate, cause jitters, and heighten pain sensitivity. It does not disqualify you, but we strongly recommend drinking plenty of water and eating a light meal beforehand. Proceeding is at your own discretion.',
    partnershipTitle: 'The 50/50 Rule & Jewelry Choice',
    partnershipText: [
      '50% is our responsibility: Sterilized equipment, sterile single-use disposable needles, strict aseptic technique, and optional implant-grade titanium jewelry.',
      '50% is your responsibility: Diligent daily aftercare (sterile 0.9% saline only, hands off, no twisting, no swimming until healed). If you choose standard stainless steel jewelry instead of hypoallergenic titanium, any individual skin sensitivity or reaction is at your own discretion and care.',
    ],
    risksTitle: 'Risks & Healing',
    risks:
      'Body piercing involves piercing living tissue. Normal healing responses include swelling, localized tenderness, slight bleeding, crusting, releasing fluid (clear lymph fluid), and irritation bumps (especially if bumped, snagged, or slept on). Diligent aftercare significantly helps soothe bumps and prevents infection or migration.',
    consent: 'I have read, understood, and agree to the guidelines and aftercare instructions provided.',
    cta: 'Proceed',
  },
  fil: {
    title: 'Bago tayo mag-pierce',
    intro: 'Basahin nang mabuti. Kaligtasan at tamang paghilom mo ang aming prayoridad, sandali lamang ito.',
    cannotPierceTitle: 'Para sa iyong kaligtasan, hindi kami makakapag-pierce sa iyo ngayon kung:',
    cannotPierceItems: [
      'Nakainom ng alak o nakagamit ng ipinagbabawal na gamot',
      'Kasalukuyang buntis o nagpapasuso',
      'May pantal, bukas na sugat, impeksyon, o sunburn sa lugar na bubutasan',
      'May mataas na lagnat o masama ang pakiramdam',
    ],
    discloseTitle: 'Mga kondisyong dapat sabihin (sariling pagpapasya at risk):',
    discloseItems: [
      'Para sa mga menor de edad, hindi kami mananagot sa anumang hindi pagkakaunawaan o kahihinatnan sa pagitan ng magulang o guardian.',
      'May diabetes, sakit sa puso, o mahinang immune system',
      'Sakit sa pamumuo ng dugo o umiinom ng blood thinners (tulad ng aspirin)',
      'May history ng keloid o madaling magka-peklat',
      'May allergy sa metal (hal. nickel), latex, o mga antiseptic',
      'Madaling mahilo, mahimatay, o may history ng epilepsy o seizures',
    ],
    caffeineTitle: 'Paalala sa Kape at Caffeine',
    caffeineText:
      'Nakapagkape o energy drink ka ba ngayon? Ang caffeine ay maaaring magpabilis ng tibok ng puso, magdulot ng panginginig, o magpataas ng sensitivity sa kirot. Hindi ka namin tatanggihan dahil dito, ngunit mainam na uminom ng maraming tubig at kumain nang magaan bago simulan. Sarili mo nang pagpapasya kung nais mong ituloy.',
    partnershipTitle: 'Ang 50/50 Rule at Pagpili ng Alahas',
    partnershipText: [
      '50% ay pananagutan namin: Sterilized na kagamitan, sterile single-use needles, malinis na aseptic technique, at optional na implant-grade titanium jewelry.',
      '50% ay pananagutan mo: Matiyagang aftercare (sterile 0.9% saline lang, huwag hawakan o paikutin, huwag lumangoy habang naghihilom). Kung pipiliin mo ang standard stainless steel kaysa hypoallergenic titanium, ang posibleng sensitivity o reaksyon ng balat ay sarili mong desisyon at pananagutan.',
    ],
    risksTitle: 'Mga Panganib at Paghilom',
    risks:
      'Ang pagpapaturok ng piercing ay pagbutas sa buhay na tissue. Normal ang pamamaga, kaunting pagdurugo, paglabas ng fluid (clear lymph fluid o crusties), at pagkakaroon ng bump o bukol (lalo na kung nasanggi, naipit sa damit, o natulugan). Ang tamang aftercare ang magpapakalma sa bump at poprotekta sa iyo laban sa impeksyon.',
    consent: 'Nabasa, naintindihan, at sumasang-ayon ako sa mga gabay at tagubilin sa aftercare na ibinigay.',
    cta: 'Magpatuloy',
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
        {/* Health Check: Cannot pierce & Disclose */}
        <SectionCard icon="🩺" title="Health & Safety Check">
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
        <SectionCard icon="☕" title={t.caffeineTitle}>
          <p className="text-body-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {t.caffeineText}
          </p>
        </SectionCard>

        {/* 50/50 partnership & jewelry */}
        <SectionCard icon="🤝" title={t.partnershipTitle}>
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
