import { useState, useEffect, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';

/**
 * Shared layout for every PUBLIC page (live queue, waiver, aftercare, privacy,
 * appointment). Keeps branding, navigation, and footer 100% consistent so the
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isWaiver = page === 'waiver';
  const showBack = page !== 'live' && !isWaiver;
  const showFooterLinks = page !== 'privacy';
  const showLiveAftercare = page === 'live';

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerOpen(false);
    }
    if (drawerOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const navLinks = [
    { label: 'Live queue', href: '/live.html', current: page === 'live' },
    { label: 'Book an appointment', href: '/appointment.html', current: page === 'appointment' },
    { label: 'Aftercare guide', href: '/aftercare.html', current: page === 'aftercare' },
    { label: 'Next pop-up event', href: '/live.html#next-popup' },
    { label: 'Studio waiver', href: '/waiver.html', current: page === 'waiver' },
    { label: 'Privacy & legal', href: '/privacy.html', current: page === 'privacy' },
  ];

  return (
    <div
      className="min-h-dvh w-full"
      style={{
        background:
          'radial-gradient(1000px 500px at 50% -10%, rgba(139,92,246,0.18) 0%, transparent 60%), var(--color-base)',
        color: 'var(--color-text)',
        fontFamily: 'Inter, system-ui, sans-serif',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* ── Sticky Brand header ── */}
      <div
        className="sticky top-0 z-40 w-full"
        style={{
          background: 'rgba(14, 14, 18, 0.80)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className={`mx-auto w-full flex items-center justify-center relative min-h-[52px] ${wide ? 'md:max-w-4xl lg:max-w-5xl px-4 sm:px-6' : 'max-w-md px-5'}`}>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            className="absolute left-5 p-2 rounded-xl flex items-center justify-center transition-colors"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              cursor: 'pointer',
            }}
          >
            <Menu size={20} />
          </button>

          <a href="/live.html" className="flex items-center gap-2.5 no-underline">
            <img
              src="/logo.png"
              alt="PUNKTURE STUDIOS"
              className="w-9 h-9 object-contain drop-shadow select-none"
            />
            <span
              className="font-sanguine select-none"
              style={{ fontSize: 18, letterSpacing: '0.12em', color: 'var(--color-text)' }}
            >
              PUNKTURE STUDIOS
            </span>
          </a>
        </div>
      </div>

      <div
        className={`mx-auto w-full ${wide ? 'md:max-w-4xl lg:max-w-5xl px-4 sm:px-6 py-6 md:py-8' : 'max-w-md px-5 py-7'}`}
        style={{ animation: 'pk-fade-in 0.5s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        {showBack && (
          <a
            href="/live.html"
            className="inline-flex items-center gap-1 text-body-xs font-semibold mb-5 hover:text-white transition-colors"
            style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}
          >
            ← Back to live queue
          </a>
        )}

        {children}

        {/* ── Quick action on live page (Aftercare only, without emoji) ── */}
        {showLiveAftercare && (
          <nav className="mx-auto w-full max-w-md mt-7">
            <a
              href="/aftercare.html"
              className="flex items-center justify-center py-3.5 rounded-2xl text-ui font-bold transition-all"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border-strong)',
                textDecoration: 'none',
              }}
            >
              Aftercare guide
            </a>
          </nav>
        )}

        {/* ── Footer ── */}
        <footer className="mx-auto w-full max-w-md pt-7 pb-2 text-center space-y-1.5">
          {showFooterLinks && (
            <div className="flex items-center justify-center gap-4 text-[11px] font-semibold">
              <a href="/privacy.html" className="hover:text-white transition-colors" style={{ color: 'var(--color-text-faint)', textDecoration: 'none' }}>
                Privacy
              </a>
              <a href="/privacy.html#legal" className="hover:text-white transition-colors" style={{ color: 'var(--color-text-faint)', textDecoration: 'none' }}>
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

      {/* ── Slide-out Navigation Drawer ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex"
          style={{
            background: 'rgba(0, 0, 0, 0.70)',
            backdropFilter: 'blur(6px)',
            animation: 'pk-overlay-fade 0.25s ease-out both',
          }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="w-72 max-w-[85vw] h-full flex flex-col justify-between p-5 sm:p-6"
            style={{
              background: 'var(--color-surface)',
              borderRight: '1px solid var(--color-border-strong)',
              boxShadow: '12px 0 48px rgba(0,0,0,0.65)',
              animation: 'pk-drawer-slide 0.32s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div>
              <div className="flex items-center justify-between pb-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-2.5">
                  <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
                  <span className="font-sanguine font-bold text-[15px]" style={{ letterSpacing: '0.08em' }}>
                    PUNKTURE
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                  }}
                  title="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Navigation links */}
              <nav className="mt-5 space-y-1.5">
                {navLinks.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-ui-sm transition-all"
                    style={{
                      background: item.current ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: item.current ? '#fff' : 'var(--color-text-muted)',
                      textDecoration: 'none',
                    }}
                  >
                    <span>{item.label}</span>
                    {item.current && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-brand-light)' }} />
                    )}
                  </a>
                ))}
              </nav>
            </div>

            {/* Drawer Footer */}
            <div className="pt-5 border-t space-y-2 text-[11px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-faint)' }}>
              <a
                href="https://www.instagram.com/punkture_studios/"
                target="_blank"
                rel="noopener noreferrer"
                className="block font-semibold hover:text-white transition-colors"
                style={{ color: 'var(--color-brand-text)', textDecoration: 'none' }}
              >
                Instagram @punkture_studios ↗
              </a>
              <p>© PUNKTURE STUDIOS</p>
            </div>
          </div>
        </div>
      )}
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
