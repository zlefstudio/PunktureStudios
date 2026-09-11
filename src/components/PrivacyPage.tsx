import { PublicShell, SectionCard } from './PublicShell';

/** Privacy policy (RA 10173) + copyright / legal notice. */
export function PrivacyPage() {
  return (
    <PublicShell page="privacy">
      <h1 className="font-black leading-tight" style={{ fontSize: 24 }}>
        Privacy &amp; Legal
      </h1>
      <p className="text-body-sm mt-1.5 mb-5" style={{ color: 'var(--color-text-muted)' }}>
        Your privacy matters to us. Here is exactly what we do (and do not) collect.
      </p>

      <div className="space-y-4">
        <SectionCard title="What we collect">
          <ul className="space-y-2.5 text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            <li>
              • <b style={{ color: 'var(--color-text)' }}>Live queue:</b> The public board displays ticket numbers only; your full name is never shown. Giving a nickname or phone number at our booth is completely <b style={{ color: 'var(--color-brand-text)' }}>OPTIONAL</b>:
              <div className="mt-1 pl-3 text-body-xs space-y-1">
                <div>• Staying near the booth? Just a ticket number or nickname is plenty.</div>
                <div>• Leaving to walk around or don't want to constantly refresh the live queue webpage? You can optionally leave your phone number so we can text or call you when you're next in line.</div>
              </div>
            </li>
            <li>• <b style={{ color: 'var(--color-text)' }}>Waiver:</b> The acknowledgment is session-only while this page is open. No identity, signature, or health record is stored by the standalone waiver page. Booking records retain the accepted fee policy and creation time as evidence of consent. Each visit asks you to read and acknowledge again.</li>
            <li>• <b style={{ color: 'var(--color-text)' }}>Booking:</b> Name, email, contact, selected date and time, optional notes, fee-policy consent and payment references, used to process your reservation, email confirmation and receipt, and notify studio staff. Payment details are entered on PayMongo; we do not store card numbers.</li>
          </ul>
        </SectionCard>

        <SectionCard title="Why we use it">
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            We process data only to run the queue and confirm bookings. We do not sell your information or use it for advertising. Staff and legacy booking records use Google Firebase. New bookings, payment references and notification delivery records use Cloudflare D1. PayMongo processes payments; The studio's Gmail account sends transactional emails through Google Apps Script. A private Google Sheet stores notification job IDs, content hashes and delivery states to prevent duplicate sends; it does not store email bodies. Access to customer records is restricted to authorized staff or your private booking access link.
          </p>
        </SectionCard>

        <SectionCard title="Retention">
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            Staff can delete legacy booking requests when they are no longer needed. Paid reservation records are retained for reconciliation and receipt support; deletion requests are reviewed by the studio and processed through its administrative data tools. Staff queue records include client names, notes and order details and are retained in local history and cloud backups until staff remove them. Archived history is retained; resetting ticket numbers does not delete it.
            You may ask us to delete your data anytime.
          </p>
        </SectionCard>

        <SectionCard title="Your rights">
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            Under the Data Privacy Act of 2012 (RA 10173), you have the right to access,
            correct, and request deletion of your personal data.
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
