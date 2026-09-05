import type { Ticket, PiercingItem } from '../types';
import { calcTotal, ticketItems, peso, formatJewelryName } from './utils';

/**
 * Earnings dashboard (History tab) — Top placements + Last-7-days trend.
 * Computed from the local database; respects the History date/month/all filter.
 */

export type EarningsScope = 'date' | 'month' | 'all';

interface Props {
  tickets: Ticket[];
  items: PiercingItem[];
  scope: EarningsScope;
  /** YYYY-MM-DD — used when scope === 'date'. */
  selectedDate: string;
}

interface Stat {
  revenue: number;
  units: number;
  count: number;
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function itemDisplayName(item: PiercingItem): string {
  if (item.placementName === 'Jewelry') {
    return formatJewelryName(item.upgradeLabel) || 'Jewelry';
  }
  return item.placementName;
}

const emptyStat = (): Stat => ({ revenue: 0, units: 0, count: 0 });

export function EarningsDashboard({ tickets, items, scope, selectedDate }: Props) {
  const todayStr = toDateString(new Date());
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  function inScope(t: Ticket): boolean {
    const time = t.finishedAt ?? t.cancelledAt ?? t.createdAt;
    if (scope === 'date') return toDateString(new Date(time)) === selectedDate;
    if (scope === 'month') {
      const d = new Date(time);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }
    return true;
  }

  const finished = tickets.filter((t) => t.status === 'finished' && inScope(t));

  // ---- Top placements (respects the current filter) ----
  const byPlacement = new Map<string, Stat>();
  for (const t of finished) {
    for (const item of ticketItems(items, t.id)) {
      const name = itemDisplayName(item);
      const rev = (item.basePrice + item.upgradePrice) * item.quantity;
      const entry = byPlacement.get(name) ?? emptyStat();
      entry.revenue += rev;
      entry.units += item.quantity;
      entry.count += 1;
      byPlacement.set(name, entry);
    }
  }
  const placementRows = [...byPlacement.entries()]
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // ---- Last 7 days trend (all finished orders, independent of the filter) ----
  const allFinished = tickets.filter((t) => t.status === 'finished');
  const trend: { date: string; label: string; revenue: number }[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    trend.push({
      date: toDateString(d),
      label: d.toLocaleDateString('en-PH', { weekday: 'short' }),
      revenue: 0,
    });
  }
  const trendByDate = new Map<string, number>();
  for (const t of allFinished) {
    const day = toDateString(new Date(t.finishedAt ?? t.createdAt));
    const sum = trendByDate.get(day) ?? 0;
    trendByDate.set(day, sum + calcTotal(ticketItems(items, t.id)));
  }
  for (const day of trend) {
    day.revenue = trendByDate.get(day.date) ?? 0;
  }
  const maxTrend = Math.max(...trend.map((d) => d.revenue), 1);

  const panel: React.CSSProperties = {
    borderRadius: '14px',
    border: '1px solid var(--color-border-strong)',
    background: 'var(--color-surface)',
  };


  return (
    <div className="space-y-3 min-w-0">
      {/* ── Top placements ── */}
      <div style={panel} className="p-4 min-w-0">
        <p className="text-label-xs mb-3" style={{ color: 'var(--color-text-faint)' }}>
          Top placements
        </p>
        {placementRows.length === 0 ? (
          <p className="text-body-sm" style={{ color: 'var(--color-text-faint)' }}>
            No finished orders in this period.
          </p>
        ) : (
          <div className="space-y-2.5">
            {placementRows.map(({ name, revenue: rev, units: u, count }, idx) => (
              <div key={name} className="flex items-center gap-2 min-w-0">
                <span
                  className="font-mono flex-shrink-0"
                  style={{ fontSize: '10px', color: 'var(--color-text-faint)', width: '14px' }}
                >
                  {idx + 1}
                </span>
                <span
                  className="flex-1 truncate text-body-xs font-medium"
                  style={{ color: 'var(--color-text)', minWidth: '0' }}
                >
                  {name}
                </span>
                <span
                  className="flex-shrink-0 text-body-xs"
                  style={{ color: 'var(--color-text-faint)' }}
                >
                  ×{count} · {u} pcs
                </span>
                <span
                  className="flex-shrink-0 font-mono font-semibold"
                  style={{ fontSize: '12px', color: 'var(--color-success-text)' }}
                >
                  {peso(rev)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Last 7 days ── */}
      <div style={panel} className="p-4 min-w-0">
        <p className="text-label-xs mb-3" style={{ color: 'var(--color-text-faint)' }}>
          Last 7 days
        </p>
        <div className="flex items-end justify-between gap-1.5 min-w-0" style={{ height: '84px' }}>
          {trend.map((d) => {
            const isToday = d.date === todayStr;
            const has = d.revenue > 0;
            const h = has ? Math.max(6, Math.round((d.revenue / maxTrend) * 60)) : 4;
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center justify-end min-w-0"
                style={{ gap: '4px', height: '100%' }}
              >
                <span
                  className="font-mono font-semibold whitespace-nowrap"
                  title={has ? peso(d.revenue) : undefined}
                  style={{
                    fontSize: '8px',
                    lineHeight: '1',
                    color: has ? 'var(--color-success-text)' : 'transparent',
                  }}
                >
                  {has ? d.revenue : '·'}
                </span>
                <div
                  className="w-full rounded-t"
                  title={has ? peso(d.revenue) : undefined}
                  style={{
                    height: `${h}px`,
                    background: has
                      ? isToday
                        ? 'var(--color-success)'
                        : 'var(--color-brand)'
                      : 'rgba(255,255,255,0.06)',
                    opacity: has && !isToday ? 0.85 : 1,
                  }}
                />
                <span
                  className="whitespace-nowrap text-body-xs"
                  style={{
                    color: isToday ? 'var(--color-success-text)' : 'var(--color-text-faint)',
                    fontWeight: isToday ? 700 : 400,
                  }}
                >
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

