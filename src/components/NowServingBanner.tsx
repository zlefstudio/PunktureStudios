import { useStore } from '../store';

export function NowServingBanner() {
  const tickets = useStore((s) => s.tickets);
  const called  = tickets
    .filter((t) => t.status === 'called' || t.status === 'in_progress')
    .sort((a, b) => (a.calledAt ?? a.createdAt) - (b.calledAt ?? b.createdAt));

  if (called.length === 0) return null;

  return (
    <div
      className="mx-4 mt-3 mb-1 rounded-2xl flex-shrink-0 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(217,119,6,0.18) 0%, rgba(120,53,15,0.12) 100%)',
        border: '1px solid rgba(217,119,6,0.30)',
      }}
    >
      {/* Accent stripe */}
      <div
        className="h-[3px] w-full"
        style={{ background: 'linear-gradient(90deg, var(--color-warn), transparent)' }}
      />

      <div className="px-3.5 py-3">
        <p className="text-label-xs mb-2" style={{ color: 'var(--color-warn-text)' }}>
          🔔 Now Serving
        </p>
        <div className="flex flex-col gap-1">
          {called.map((t) => (
            <div key={t.id} className="flex items-baseline gap-2">
              <span
                className="font-black leading-tight"
                style={{ fontSize: '18px', color: 'var(--color-warn-text)', fontFamily: 'var(--font-mono)' }}
              >
                #{t.ticketNumber}
              </span>
              <span
                className="font-semibold leading-tight truncate"
                style={{ fontSize: '15px', color: 'var(--color-text)' }}
              >
                {t.name}
              </span>
              {t.status === 'in_progress' && (
                <span
                  className="ml-auto text-label-xs"
                  style={{ color: 'var(--color-brand-text)' }}
                >
                  In Progress
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
