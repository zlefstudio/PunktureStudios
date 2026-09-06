import { PublicShell, SectionCard } from './PublicShell';

/** Aftercare tips — clean, scannable, premium. */
export function AftercarePage() {
  return (
    <PublicShell page="aftercare">
      <h1 className="font-black leading-tight" style={{ fontSize: 24 }}>
        Aftercare
      </h1>
      <p className="text-body-sm mt-1.5 mb-5" style={{ color: 'var(--color-text-muted)' }}>
        Keep it clean, keep it dry, hands off. Healing takes time.
      </p>

      <div className="space-y-4">
        <SectionCard icon="🧼" title="Daily routine">
          <ul className="space-y-1.5 text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            <li>• Wash your hands before touching the piercing.</li>
            <li>• Spray with sterile saline (0.9% sodium chloride only) 2× a day.</li>
            <li>• Dry gently with clean disposable gauze — not a towel.</li>
            <li>• Never twist, spin, or rotate the jewelry.</li>
          </ul>
        </SectionCard>

        <SectionCard icon="🌱" title="What's normal">
          <ul className="space-y-1.5 text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            <li>• Some bleeding, swelling, or tenderness at first.</li>
            <li>• Itching and whitish-yellow crust while healing.</li>
            <li>• The outside heals before the inside — be patient.</li>
          </ul>
        </SectionCard>

        <SectionCard icon="🚫" title="Avoid">
          <ul className="space-y-1.5 text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            <li>• Dirty towels and touching with unwashed hands.</li>
            <li>• Pools, hot tubs, and baths until fully healed.</li>
            <li>• Alcohol, hydrogen peroxide, and ointments.</li>
            <li>• Leaving the jewelry out — piercings close fast.</li>
          </ul>
        </SectionCard>

        <SectionCard icon="⏳" title="Healing time">
          <ul className="space-y-1.5 text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            <li className="flex justify-between gap-3">
              <span>Ear lobe</span>
              <span className="font-mono" style={{ color: 'var(--color-brand-text)' }}>6–8 wks</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Ear cartilage</span>
              <span className="font-mono" style={{ color: 'var(--color-brand-text)' }}>6–12 mo</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Oral</span>
              <span className="font-mono" style={{ color: 'var(--color-brand-text)' }}>4–8 wks</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Navel</span>
              <span className="font-mono" style={{ color: 'var(--color-brand-text)' }}>6–12 mo</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Nipple</span>
              <span className="font-mono" style={{ color: 'var(--color-brand-text)' }}>6–12 mo</span>
            </li>
          </ul>
        </SectionCard>

        <SectionCard icon="⚠️" title="Come back if…">
          <ul className="space-y-1.5 text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            <li>• Severe swelling, redness, or pain that gets worse.</li>
            <li>• Thick green or yellow discharge, or a fever.</li>
            <li>• You suspect an infection — keep the jewelry in and see us.</li>
          </ul>
        </SectionCard>
      </div>
    </PublicShell>
  );
}
