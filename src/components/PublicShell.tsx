import type { ReactNode } from 'react';

/**
 * Shared layout for every PUBLIC page (live queue, waiver, aftercare, privacy,
 * appointment). Keeps branding, quick actions and footer 100% consistent so the
 * customer experience feels like one premium, minimalist product.
 */

export type PublicPage = 'live' | 'appointment' | 'aftercare' | 'privacy' | 'waiver';

interface PublicShellProps {
  children: ReactNode;
  /** Which page this is — controls the back link, quick actions and footer links. */
  page?: PublicPage;
  /** Use a wider container (for the live queue's stage + queue layout). */
  wide?: boolean;
}

export function PublicShell({
  children,
  page = 'live',
  wide = false,
}: PublicShellProps) {
  const isWaiver = page === 'waiver';
  const showBack = page !== 'live' && !isWaiver;
  const showBook = page !== 'appointment';
  const showPopup = page !== 'live';
  const showAftercare = page !== 'aftercare';
  const showFooterLinks = page !== 'privacy';
  return (
    <div
      className="min-h-dvh w-full overflow-x-hidden"
      style={{
        background:
          'radial-gradient(1000px 500px at 50% -10%, rgba(139,92,246,0.18) 0%, transparent 60%), var(--color-base)',
        color: 'var(--color-text)',
        fontFamily: 'Inter, system-ui, sans-serif',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        className={`mx-auto w-full ${wide ? 'md:max-w-4xl lg:max-w-5xl px-4 sm:px-6 py-6 md:py-8' : 'max-w-md px-5 py-7'}`}
        style={{ animation: 'pk-fade-in 0.5s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        {/* ── Brand header ── */}
        <header className="flex items-center justify-center gap-2.5 mb-6">
          <img
            src="/logo.png"
            alt="PUNKTURE STUDIOS"
            className="w-10 h-10 object-contain drop-shadow select-none"
          />
          <span
            className="font-sanguine select-none"
            style={{ fontSize: 19, letterSpacing: '0.12em', color: 'var(--color-text)' }}
          >
            PUNKTURE STUDIOS
          </span>
        </header>

        {showBack && (
          <a
            href="/live.html"
            className="inline-flex items-center gap-1 text-body-xs font-semibold mb-5"
            style={{ color: 'var(--color-text-faint)', textDecoration: 'none' }}
          >
            ← Back to live queue
          </a>
        )}

        {children}

        {/* ── Quick actions ── */}
        {!isWaiver && (showBook || showPopup || showAftercare) && (
          <nav className="mx-auto w-full max-w-md mt-7 space-y-2.5">
            {showBook && (
              <a
                href="/appointment.html"
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl text-ui font-bold"
                style={{
                  background: 'var(--color-brand)',
                  color: '#fff',
                  boxShadow: 'var(--shadow-brand)',
                  textDecoration: 'none',
                }}
              >
                💍 Book an appointment
              </a>
            )}
            {(showPopup || showAftercare) && (
              <div className={`grid ${showPopup && showAftercare ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5`}>
                {showPopup && (
                  <a
                    href="/live.html#next-popup"
                    className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-ui-sm font-bold"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border-strong)',
                      textDecoration: 'none',
                    }}
                  >
                    📍 Next pop-up
                  </a>
                )}
                {showAftercare && (
                  <a
                    href="/aftercare.html"
                    className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-ui-sm font-bold"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border-strong)',
                      textDecoration: 'none',
                    }}
                  >
                    🩹 Aftercare
                  </a>
                )}
              </div>
            )}
          </nav>
        )}

        {/* ── Footer ── */}
        <footer className="mx-auto w-full max-w-md pt-7 pb-2 text-center space-y-1.5">
          {showFooterLinks && (
            <div className="flex items-center justify-center gap-4 text-[11px] font-semibold">
              <a href="/privacy.html" style={{ color: 'var(--color-text-faint)', textDecoration: 'none' }}>
                Privacy
              </a>
              <a href="/privacy.html#legal" style={{ color: 'var(--color-text-faint)', textDecoration: 'none' }}>
                Legal
              </a>
            </div>
          )}
          <p className="text-[10px]" style={{ color: 'var(--color-text-faint)' }}>
            © PUNKTURE STUDIOS. All rights reserved.
          </p>
          <p className="text-[10px]" style={{ color: 'var(--color-text-faint)', opacity: 0.6 }}>
            Made by ZLEF
          </p>
        </footer>
      </div>
    </div>
  );
}

/** Reusable info card used by the waiver / aftercare / privacy pages. */
export function SectionCard({
  icon,
  title,
  children,
}: {
  icon?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-2xl p-5 space-y-2.5"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <h2
        className="flex items-center gap-2 text-label-xs"
        style={{ color: 'var(--color-brand-text)' }}
      >
        {icon && <span aria-hidden>{icon}</span>}
        {title}
      </h2>
      {children}
    </section>
  );
}
