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
      <div className="flex h-full items-center justify-center bg-[#0d0f14]">
        {initError ? (
          <div className="text-red-400 text-center p-8">
            <p className="text-xl font-bold mb-2">Database error</p>
            <p className="text-sm opacity-70">{initError}</p>
          </div>
        ) : (
          <div className="text-slate-400 text-lg animate-pulse">Loading…</div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#0d0f14]">
      {/* LEFT — Queue Board */}
      <div className="w-[420px] min-w-[360px] flex-shrink-0 border-r border-white/8 overflow-y-auto">
        <QueueBoard />
      </div>

      {/* RIGHT — Active Ticket Workspace */}
      <div className="flex-1 overflow-y-auto">
        <TicketWorkspace />
      </div>
    </div>
  );
}