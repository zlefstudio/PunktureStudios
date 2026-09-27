import { PublicShell, SectionCard } from './PublicShell';

/** Privacy policy (RA 10173) + copyright / legal notice. */
export function PrivacyPage() {
  return (
    <PublicShell page="privacy">
      <div className="text-center mb-5">
        <h1 className="font-black leading-tight" style={{ fontSize: 24 }}>
          Privacy &amp; Legal
        </h1>
        <p className="text-body-sm mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
          Your privacy matters to us. Here is exactly what we do (and do not) collect.
        </p>
      </div>

      <div className="space-y-4">
        <SectionCard title="What we collect">
          <ul className="space-y-3 text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            <li>
              <b style={{ color: 'var(--color-text)' }}>Pop-up queue.</b> We ask for a nickname so we can call you when it's your turn, and so we can still find you if you forget your ticket number. On the public live queue, only your ticket number and a hidden version of your nickname (like <span style={{ color: 'var(--color-text)' }}>M**a</span>) are shown.
              <span className="block mt-1">Want to walk around instead of waiting at the booth? You can give us your Instagram (or another social media account) and we'll message you when you're next.</span>
            </li>
            <li>
              <b style={{ color: 'var(--color-text)' }}>Online booking.</b> Your name, email, the social media account we can message you on, your chosen date and time, the piercings in your cart, any notes, and your agreement to the deposit policy.
            </li>
            <li>
              <b style={{ color: 'var(--color-text)' }}>Payment.</b> You pay the deposit on PayMongo's secure page. We only receive a payment reference and the amount. We never see or store your card, e-wallet or bank details.
            </li>
            <li>
              <b style={{ color: 'var(--color-text)' }}>Waiver.</b> The waiver page does not save your name, signature or health answers. For bookings, we only keep a record that you agreed and when.
            </li>
          </ul>
        </SectionCard>

        <SectionCard title="How we use it">
          <ul className="space-y-2 text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            <li>• To run the queue, confirm your booking, send your confirmation and receipt, and message you about your appointment.</li>
            <li>• Confirmed appointments go on the studio's private Google Calendar so we can plan the day. You are not invited to it, and cancelled bookings are removed.</li>
            <li>• Only studio staff can see your details. Your booking status page is private to your own link.</li>
            <li>• We never sell your information or use it for ads.</li>
          </ul>
        </SectionCard>

        <SectionCard title="Services we use">
          <p className="text-body-sm mb-2.5" style={{ color: 'var(--color-text-muted)' }}>
            These trusted services help run the system. Tap to read how each one handles data:
          </p>
          <ul className="space-y-2 text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            {[
              { name: 'PayMongo', role: 'secure deposit payments (QR Ph, GCash, Maya and bank apps)', href: 'https://www.paymongo.com/privacy' },
              { name: 'Google (Gmail, Calendar, Firebase)', role: 'confirmation emails, the studio calendar, and the live queue', href: 'https://policies.google.com/privacy' },
              { name: 'Cloudflare', role: 'stores booking and payment records safely', href: 'https://www.cloudflare.com/privacypolicy/' },
            ].map(service => (
              <li key={service.name}>
                •{' '}
                <a href={service.href} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4" style={{ color: 'var(--color-brand-text)', textDecorationColor: 'var(--color-brand)' }}>
                  {service.name} ↗
                </a>{' '}
                — {service.role}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="How long we keep it">
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            Paid booking records are kept so we can check payments and help with receipts or refunds. Queue history is kept in the studio's records until we clear it. You can ask us to delete your data anytime, and we'll let you know if anything must be kept for payment records.
          </p>
        </SectionCard>

        <SectionCard title="Your rights">
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            Under the Data Privacy Act of 2012 (RA 10173), you can ask to see, correct or delete your personal data. Learn more at the{' '}
            <a href="https://privacy.gov.ph/" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4" style={{ color: 'var(--color-brand-text)', textDecorationColor: 'var(--color-brand)' }}>
              National Privacy Commission ↗
            </a>.
          </p>
        </SectionCard>

        <SectionCard title="Contact">
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            Questions about privacy? Reach out to us on Instagram:{' '}
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
          </p>
        </SectionCard>

        {/* ── Legal / copyright ── */}
        <section
          id="legal"
          className="rounded-2xl p-5 space-y-2.5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)' }}
        >
          <h2 className="text-label-xs" style={{ color: 'var(--color-warn-text)' }}>
            Copyright &amp; legal notice
          </h2>
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            © PUNKTURE STUDIOS. All rights reserved. The brand name, logo, text, graphics,
            design, and all content on this website are the property of PUNKTURE STUDIOS.
          </p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            Unauthorized copying, reproduction, distribution, or modification of any part of
            this website, in whole or in part, is strictly prohibited without prior written
            consent. All other trademarks and logos are the property of their respective owners.
          </p>
        </section>
      </div>
    </PublicShell>
  );
}
