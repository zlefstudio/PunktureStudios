export type WaiverLang = 'en' | 'fil';

export interface WaiverCopy {
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

export const WAIVER_CONTENT: Record<WaiverLang, WaiverCopy> = {
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
