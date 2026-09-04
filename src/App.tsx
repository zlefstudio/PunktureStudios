import { useEffect, useState } from 'react';
import { useStore } from './store';
import { QueueBoard } from './components/QueueBoard';
import { TicketWorkspace } from './components/TicketWorkspace';

export function App() {
  const loadAll = useStore((s) => s.loadAll);
  const loaded = useStore((s) => s.loaded);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    loadAll().catch((e: unknown) => {
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
          <div className="flex flex-col items-center gap-3">
            {/* Branded spinner */}
            <div
              className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{
                borderColor: 'var(--color-border-strong)',
                borderTopColor: 'var(--color-brand-light)',
              }}
            />
            <p className="text-label-sm" style={{ color: 'var(--color-text-faint)' }}>
              Loading…
            </p>
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