import { PublicShell, SectionCard } from './PublicShell';

/** Privacy policy (RA 10173) + copyright / legal notice. */
export function PrivacyPage() {
  return (
    <PublicShell page="privacy">
      <h1 className="font-black leading-tight" style={{ fontSize: 24 }}>
        Privacy &amp; Legal
      </h1>
      <p className="text-body-sm mt-1.5 mb-5" style={{ color: 'var(--color-text-muted)' }}>
        Your privacy matters to us. Here is exactly what we do — and don't — collect.
      </p>

      <div className="space-y-4">
        <SectionCard icon="🔒" title="What we collect">
          <ul className="space-y-1.5 text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            <li>• <b style={{ color: 'var(--color-text)' }}>Live queue:</b> ticket numbers only — never names.</li>
            <li>• <b style={{ color: 'var(--color-text)' }}>Waiver:</b> the acknowledgment is used only while this page is open. No identity, signature or acknowledgment record is saved. Each visit asks you to read and acknowledge again.</li>
            <li>• <b style={{ color: 'var(--color-text)' }}>Booking:</b> name, contact, preferred date and time, and optional notes, used to manage your appointment.</li>
          </ul>
        </SectionCard>

        <SectionCard icon="🎯" title="Why we use it">
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            We process data only to run the queue and confirm bookings. We do not sell your information or use it for advertising. Booking and staff records are stored using Google Firebase; access is restricted to authorized staff.
          </p>
        </SectionCard>

        <SectionCard icon="🗄️" title="Retention">
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            Staff can delete booking requests when they are no longer needed. Staff queue records include client names, notes and order details and are retained in local history and cloud backups until staff remove them. Archived history is retained; resetting ticket numbers does not delete it.
            You may ask us to delete your data anytime.
          </p>
        </SectionCard>

        <SectionCard icon="🛡️" title="Your rights">
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            Under the Data Privacy Act of 2012 (RA 10173), you have the right to access,
            correct, and request deletion of your personal data.
          </p>
        </SectionCard>

        <SectionCard icon="📮" title="Contact">
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            Questions about privacy? Reach out to us at the studio and we'll be glad to help.
          </p>
        </SectionCard>

        {/* ── Legal / copyright ── */}
        <section
          id="legal"
          className="rounded-2xl p-5 space-y-2.5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)' }}
        >
          <h2 className="text-label-xs" style={{ color: 'var(--color-warn-text)' }}>
            ⚖️ Copyright &amp; legal notice
          </h2>
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            © PUNKTURE STUDIOS. All rights reserved. The brand name, logo, text, graphics,
            design, and all content on this website are the property of PUNKTURE STUDIOS.
          </p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            Unauthorized copying, reproduction, distribution, or modification of any part of
            this website — in whole or in part — is strictly prohibited without prior written
            consent. All other trademarks and logos are the property of their respective owners.
          </p>
        </section>
      </div>
    </PublicShell>
  );
}
