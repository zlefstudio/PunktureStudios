import { useStore } from '../store';

export function NowServingBanner() {
  const tickets = useStore((s) => s.tickets);
  const called = tickets
    .filter((t) => t.status === 'called' || t.status === 'in_progress')
    .sort((a, b) => (a.calledAt ?? a.createdAt) - (b.calledAt ?? b.createdAt));

  if (called.length === 0) return null;

  return (
    <div className="mx-4 mt-3 mb-1 rounded-xl bg-gradient-to-r from-amber-950/70 to-amber-900/40 border border-amber-700/40 p-3 flex-shrink-0">
      <p className="text-amber-400 text-[10px] font-bold uppercase tracking-widest mb-1.5">
        🔔 Now Serving
      </p>
      <div className="flex flex-col gap-1">
        {called.map((t) => (
          <div key={t.id} className="flex items-baseline gap-2">
            <span className="text-amber-300 font-black text-lg leading-tight">
              #{t.ticketNumber}
            </span>
            <span className="text-white font-semibold text-base leading-tight truncate">
              {t.name}
            </span>
            {t.status === 'in_progress' && (
              <span className="ml-auto text-violet-400 text-[10px] font-bold uppercase">In Progress</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
