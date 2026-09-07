import { useState } from 'react';
import { PublicShell, SectionCard } from './PublicShell';

type Lang = 'en' | 'fil';

interface AftercareCopy {
  title: string;
  intro: string;
  lithaTitle: string;
  lithaText: string;
  routineTitle: string;
  routineItems: string[];
  normalTitle: string;
  normalItems: string[];
  avoidTitle: string;
  avoidItems: string[];
  troubleTitle: string;
  troubleItems: string[];
  troubleContact: string;
  troubleContactSuffix: string;
}

const CONTENT: Record<Lang, AftercareCopy> = {
  en: {
    title: 'Aftercare Guide',
    intro: 'Patience and clean habits are the secret to smooth, problem-free healing. Take care of your piercing and it will take care of you.',
    lithaTitle: 'The LITHA Method (Leave It The Hell Alone)',
    lithaText:
      'The single most effective healing practice is LITHA: Leave It The Hell Alone. Your body is naturally equipped to heal wounds when undisturbed. Keep your hands off, do not pick crusties with your nails, avoid twisting or spinning the jewelry, and avoid sleeping directly on your fresh piercing.',
    routineTitle: 'Daily Cleansing Routine',
    routineItems: [
      'Always wash hands thoroughly with soap and warm water before handling the piercing area.',
      'Spray with sterile saline spray (0.9% sodium chloride) 2× every other day, or as needed to gently rinse away crusties.',
      'After taking a bath or shower, dry the piercing site immediately and thoroughly using clean disposable paper towel or sterile gauze (avoid bath towels which harbor bacteria).',
      'Never twist, spin, or force the jewelry while cleaning.',
    ],
    normalTitle: "What's Normal",
    normalItems: [
      'Releasing clear to pale-yellow fluid (lymph fluid) that dries into crusties. This is a natural part of tissue repair and not an infection.',
      'Irritation bumps, especially if accidentally bumped, snagged on clothes, or slept on. Keep practicing LITHA and clean saline care, and it will settle down.',
      'Minor redness, swelling, and localized tenderness during the initial weeks.',
    ],
    avoidTitle: 'Things to Avoid',
    avoidItems: [
      'Rubbing alcohol, hydrogen peroxide, Betadine, ointments, or harsh oils (these irritate and dry out healing tissue).',
      'Swimming pools, hot tubs, the ocean, or soaking in baths until fully healed.',
      'Rotating or playing with jewelry, which tears the delicate skin healing inside.',
      'Removing or changing jewelry prematurely. Fresh piercings can shrink or close within minutes.',
    ],
    troubleTitle: 'Reach Out to Us If…',
    troubleItems: [
      'Severe throbbing pain, worsening swelling, or feeling feverish.',
      'Thick, foul-smelling green discharge.',
    ],
    troubleContact: 'If an irritation bump persists or your jewelry feels too tight, message us on',
  },
  fil: {
    title: 'Gabay sa Aftercare',
    intro: 'Matiyagang pagaalaga at malinis na mga kamay ang susi sa maganda at maayos na paggaling ng iyong piercing.',
    lithaTitle: 'Ang LITHA Method (Leave It The Hell Alone)',
    lithaText:
      'Ang pinaka-epektibong paraan sa paghihilom ng piercing ay ang LITHA: Leave It The Hell Alone. May sariling kakayahan ang katawan na magpagaling ng sugat kapag hindi ito nagagalaw. Huwag hawakan, huwag tanggalin ang crust gamit ang kuko, huwag paikutin, at iwasang matulugan o maipit ang piercing.',
    routineTitle: 'Tamang Paglilinis',
    routineItems: [
      'Laging maghugas ng kamay gamit ang sabon at malinis na tubig bago hawakan ang paligid ng piercing.',
      'Mag-spray ng sterile saline spray (0.9% sodium chloride) nang 2× every other day, o kapag kailangang banlawan ang naipong dumi.',
      'Kapag naligo, patuyuin agad ang piercing gamit ang malinis na disposable paper towel o sterile gauze (iwasan ang tuwalya na madaling kapitan ng bacteria).',
      'Huwag na huwag pipiliting paikutin o hilahin ang alahas habang naglilinis.',
    ],
    normalTitle: 'Normal na Nararanasan',
    normalItems: [
      'Paglabas ng clear o bahagyang madilaw na fluid (lymph) na nagiging crusties. Normal ito at hindi nana; bahagi ito ng natural na paghilom ng balat.',
      'Pagkakaroon ng bump o bukol, lalo na kapag nasanggi, nasabit sa damit, o natulugan. Huwag mag-panic, panatilihin lang ang LITHA at malinis na saline para kumalma ito.',
      'Bahagyang pamumula, kaunting pamamaga, at kirot sa mga unang linggo.',
    ],
    avoidTitle: 'Mga Dapat Iwasan',
    avoidItems: [
      'Alcohol, hydrogen peroxide, Betadine, ointment, o matatapang na langis (nakakasunog ito ng bagong tissue at nagpapatagal ng paggaling).',
      'Paglangoy sa swimming pool, dagat, ilog, o pagbabad sa bathtub habang naghihilom pa.',
      'Pagiikot o paglalaro sa alahas dahil nasusugatan nito ang loob ng butas.',
      'Pagtanggal o pagpapalit agad ng alahas. Maaaring sumara o sumikip ang butas sa loob lamang ng ilang minuto.',
    ],
    troubleTitle: 'Kailan Kami Dapat Lapitan…',
    troubleItems: [
      'Matinding kirot na kumikirot nang tuloy-tuloy, lumalalang pamamaga, o mainit na pakiramdam.',
      'Makapal at mabahong berdeng nana o pagkakaroon ng lagnat.',
    ],
    troubleContact: 'Kung hindi nawawala ang bukol o sumisikip ang alahas, mag-message sa amin sa',
    troubleContactSuffix: 'o bumisita sa booth. Huwag tatanggalin ang alahas nang mag-isa.',
  },
};

/** Aftercare tips — clean, scannable, premium. */
export function AftercarePage() {
  const [lang, setLang] = useState<Lang>('en');
  const t = CONTENT[lang];

  const langBtn = (value: Lang, label: string) => {
    const active = lang === value;
    return (
      <button
        onClick={() => setLang(value)}
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
    <PublicShell page="aftercare">
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
        {/* LITHA method */}
        <SectionCard title={t.lithaTitle}>
          <p className="text-body-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {t.lithaText}
          </p>
        </SectionCard>

        {/* Daily routine */}
        <SectionCard title={t.routineTitle}>
          <ul className="space-y-2 text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t.routineItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-0.5" style={{ color: 'var(--color-brand-text)' }}>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* What's normal */}
        <SectionCard title={t.normalTitle}>
          <ul className="space-y-2 text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t.normalItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-0.5" style={{ color: 'var(--color-success-text)' }}>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* Avoid */}
        <SectionCard icon="🚫" title={t.avoidTitle}>
          <ul className="space-y-2 text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t.avoidItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-0.5" style={{ color: 'var(--color-error-text)' }}>✕</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* Come back if */}
        <SectionCard icon="⚠️" title={t.troubleTitle}>
          <ul className="space-y-2 text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t.troubleItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-0.5" style={{ color: 'var(--color-warn-text)' }}>•</span>
                <span>{item}</span>
              </li>
            ))}
            {/* Contact bullet with Instagram link */}
            <li className="flex items-start gap-2">
              <span className="mt-0.5" style={{ color: 'var(--color-warn-text)' }}>•</span>
              <span>
                {t.troubleContact}{' '}
                <a
                  href="https://www.instagram.com/punkture_studios/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline underline-offset-4 transition-colors"
                  style={{
                    color: 'var(--color-brand-text)',
                    textDecorationColor: 'var(--color-brand)',
                  }}
                >
                  @punkture_studios ↗
                </a>
                {' '}{t.troubleContactSuffix}
              </span>
            </li>
          </ul>
        </SectionCard>
      </div>
    </PublicShell>
  );
}
