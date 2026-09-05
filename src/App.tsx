import { useEffect, useState } from 'react';
import { useStore } from './store';
import { startSyncWatcher } from './sync';
import { QueueBoard } from './components/QueueBoard';
import { TicketWorkspace } from './components/TicketWorkspace';
import logoImg from './assets/logo.png';

export function App() {
  const loadAll = useStore((s) => s.loadAll);
  const loaded = useStore((s) => s.loaded);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    loadAll()
      .then(() => startSyncWatcher())
      .catch((e: unknown) => {
        setInitError(e instanceof Error ? e.message : 'Failed to load database');
      });
  }, [loadAll]);

  if (!loaded) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{ background: 'var(--color-base)' }}
      >
        {initError ? (
          <div className="text-center p-8 space-y-2">
            <p
              className="text-heading-sm"
              style={{ color: 'var(--color-error-text)' }}
            >
              Database error
            </p>
            <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
              {initError}
            </p>
          </div>
        ) : (
          <div
            className="flex flex-col items-center gap-7"
            style={{ animation: 'pk-fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {/* Premium branded loader — spinning arc ring + floating logo */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              {/* static base ring */}
              <div
                className="absolute inset-0 rounded-full"
                style={{ border: '1px solid var(--color-border-strong)' }}
              />
              {/* slow dashed outer ring */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  border: '1px dashed rgba(139,92,246,0.18)',
                  animation: 'pk-spin 9s linear infinite reverse',
                }}
              />
              {/* fast glowing arc */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  border: '2px solid transparent',
                  borderTopColor: 'var(--color-brand-light)',
                  borderRightColor: 'rgba(139,92,246,0.45)',
                  borderBottomColor: 'rgba(139,92,246,0.10)',
                  filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.35))',
                  animation: 'pk-spin 1.15s linear infinite',
                }}
              />
              <img
                src={logoImg}
                alt=""
                className="w-12 h-12 object-contain"
                style={{ animation: 'pk-logo-float 2.4s ease-in-out infinite' }}
              />
            </div>

            <div className="flex flex-col items-center gap-2.5">
              <p
                className="font-sanguine select-none"
                style={{ fontSize: '16px', letterSpacing: '0.14em', color: 'var(--color-text)' }}
              >
                PUNKTURE STUDIOS
              </p>
              <p className="text-label-sm" style={{ color: 'var(--color-text-faint)' }}>
                Loading queue…
              </p>
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: 'var(--color-brand-light)',
                      animation: `pk-dot 1.2s ease-in-out ${i * 0.18}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{ background: 'var(--color-base)' }}
    >
      {/* LEFT — Queue Board */}
      <div
        className="w-[420px] min-w-[360px] flex-shrink-0 overflow-y-auto"
        style={{ borderRight: '1px solid var(--color-border)' }}
      >
        <QueueBoard />
      </div>

      {/* RIGHT — Active Ticket Workspace */}
      <div className="flex-1 overflow-y-auto">
        <TicketWorkspace />
      </div>
    </div>
  );
}