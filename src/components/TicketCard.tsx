import type { CSSProperties } from 'react';
import { GripVertical, Clock } from 'lucide-react';
import { useStore } from '../store';
import { useQueueWaitEstimates } from '../timeEstimate';
import {
  formatTime,
  calcTotal,
  ticketItems,
  waitingPosition,
  statusColor,
  statusBorder,
  peso,
} from './utils';
import type { Ticket } from '../types';

interface TicketCardProps {
  ticket: Ticket;
  /**
   * Waiting cards are reorderable — shows the grip affordance and lets the
   * wrapper turn a press into a drag.
   */
  reorderable?: boolean;
  /** True while this exact card is being lifted/dragged. */
  dragging?: boolean;
}

export function TicketCard({ ticket, reorderable = false, dragging = false }: TicketCardProps) {
  const items           = useStore((s) => s.items);
  const tickets         = useStore((s) => s.tickets);
  const setActiveTicket = useStore((s) => s.setActiveTicket);
  const activeTicketId  = useStore((s) => s.activeTicketId);

  const { estimates, inProgressEstimate } = useQueueWaitEstimates();
  const waitEstimate = ticket.status === 'waiting' ? estimates.get(ticket.id) : undefined;
  const activeIpEstimate =
    ticket.status === 'in_progress' && inProgressEstimate?.ticketId === ticket.id
      ? inProgressEstimate
      : undefined;

  const myItems  = ticketItems(items, ticket.id);
  const total    = calcTotal(myItems);
  const isActive = activeTicketId === ticket.id;
  const pos      = ticket.status === 'waiting' ? waitingPosition(tickets, ticket.id) : null;

  const baseStyle: CSSProperties = isActive
    ? {
        background: 'var(--color-brand-bg)',
        border: '1px solid var(--color-brand)',
        boxShadow: '0 0 0 1px var(--color-brand-ring), var(--shadow-brand)',
      }
    : {
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${statusBorder(ticket.status)}`,
      };

  const style: CSSProperties = dragging
    ? {
        ...baseStyle,
        background: isActive ? 'var(--color-brand-bg)' : 'rgba(255,255,255,0.05)',
        borderColor: 'var(--color-brand)',
        boxShadow: '0 0 0 1px var(--color-brand-ring), var(--shadow-lg)',
        cursor: 'grabbing',
        // neutralise the global `button:active` press-scale and add a subtle
        // lift so the held card reads as "picked up"
        transform: 'scale(1.02)',
      }
    : baseStyle;

  return (
    <div
      className={`session-aura relative rounded-xl ${
        ticket.status === 'in_progress' ? 'aura-active' : ''
      } ${activeIpEstimate?.isOvertime ? 'is-overtime' : ''}`}
    >
    <button
      onClick={() => setActiveTicket(ticket.id)}
      className={`group w-full text-left rounded-xl p-3 transition duration-200 ease-out ${
        reorderable && !dragging ? 'cursor-grab' : ''
      }`}
      style={style}
      title={reorderable ? 'Click to open · drag to reorder' : undefined}
      onMouseEnter={(e) => {
        if (!isActive && !dragging) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive && !dragging) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
        }
      }}
    >
      {/* Row 1: position badge + ticket # + name + status + grip */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {pos !== null && (
            <span
              className="flex-shrink-0 w-5 h-5 rounded-full font-bold flex items-center justify-center"
              style={{
                fontSize: '10px',
                background: 'var(--color-status-waiting-bg)',
                color: 'var(--color-status-waiting-text)',
                border: '1px solid rgba(96,165,250,0.25)',
              }}
            >
              {pos}
            </span>
          )}
          <span
            className="flex-shrink-0 font-mono font-semibold"
            style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}
          >
            #{ticket.ticketNumber}
          </span>
          <span
            className="font-semibold truncate"
            style={{ fontSize: '13px', color: 'var(--color-text)' }}
          >
            {ticket.name}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Status badge */}
          <span className="status-badge" style={statusColor(ticket.status)}>
            {ticket.status === 'in_progress' ? 'Active' : ticket.status}
          </span>

          {/* Reorder grip (also the touch drag handle) */}
          {reorderable && (
            <span
              data-reorder-handle
              aria-hidden
              className="flex items-center opacity-60 transition-opacity group-hover:opacity-100"
              style={{ color: 'var(--color-text-faint)', touchAction: 'none' }}
            >
              <GripVertical size={13} />
            </span>
          )}
        </div>
      </div>

      {/* Row 2: timestamp + item summary */}
      <div
        className="flex items-center justify-between mt-1.5"
        style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}
      >
        <span>{formatTime(ticket.createdAt)}</span>
        {myItems.length > 0 && (
          <span style={{ color: 'var(--color-text-muted)' }}>
            {myItems.length} item{myItems.length !== 1 ? 's' : ''} · {peso(total)}
          </span>
        )}
      </div>

      {/* Row 3: Live Estimated Wait Time / Active Session */}
      {ticket.status === 'waiting' && waitEstimate && (
        <div
          className={`flex items-center justify-between gap-1.5 mt-2 px-2 py-1 rounded-lg time-text-transition ${
            waitEstimate.waitMinutes === 0 ? 'next-pill-glow' : ''
          }`}
          style={{
            background:
              waitEstimate.waitMinutes === 0
                ? 'rgba(16,185,129,0.10)'
                : 'rgba(255,255,255,0.04)',
            border:
              waitEstimate.waitMinutes === 0
                ? '1px solid rgba(16,185,129,0.28)'
                : '1px solid rgba(255,255,255,0.07)',
            fontSize: '11px',
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {waitEstimate.waitMinutes === 0 ? (
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="sonar-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            ) : (
              <Clock
                size={12}
                className="clock-live-tick text-blue-400 flex-shrink-0"
              />
            )}
            <span
              className="font-medium tracking-tight truncate time-text-transition"
              style={{
                color:
                  waitEstimate.waitMinutes === 0
                    ? '#34d399'
                    : 'var(--color-text-muted)',
              }}
            >
              {waitEstimate.formattedEstimate}
              {waitEstimate.waitMinutes === 0 ? ' · Next' : ''}
            </span>
          </div>
          <span
            className="flex-shrink-0 font-mono"
            style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}
          >
            ~{waitEstimate.ownDuration}m
          </span>
        </div>
      )}

      {/* Row 3: Live session status (In Progress) */}
      {ticket.status === 'in_progress' && (
        <div
          className="flex items-center justify-between gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg time-text-transition"
          style={{
            background: activeIpEstimate?.isOvertime
              ? 'rgba(239,68,68,0.10)'
              : 'rgba(139,92,246,0.10)',
            border: activeIpEstimate?.isOvertime
              ? '1px solid rgba(239,68,68,0.28)'
              : '1px solid rgba(139,92,246,0.22)',
            fontSize: '11px',
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span
                className="sonar-ring absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: activeIpEstimate?.isOvertime ? '#ef4444' : '#a855f7' }}
              />
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ background: activeIpEstimate?.isOvertime ? '#ef4444' : '#c084fc' }}
              />
            </span>
            <span
              className="font-medium tracking-tight truncate time-text-transition"
              style={{ color: activeIpEstimate?.isOvertime ? '#f87171' : '#c084fc' }}
            >
              {activeIpEstimate
                ? activeIpEstimate.isOvertime
                  ? `Overtime (+${activeIpEstimate.elapsedMinutes - activeIpEstimate.totalDuration}m)`
                  : `~${activeIpEstimate.remainingMinutes}m left`
                : 'Session in progress'}
            </span>
          </div>
          <span
            className="flex-shrink-0 font-mono"
            style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}
          >
            {activeIpEstimate
              ? `${activeIpEstimate.elapsedMinutes}m / ~${activeIpEstimate.totalDuration}m`
              : ticket.startedAt
                ? formatTime(ticket.startedAt)
                : ''}
          </span>
        </div>
      )}

      {/* Notes */}
      {ticket.notes && (
        <p className="mt-1 truncate" style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
          {ticket.notes}
        </p>
      )}
    </button>
    {ticket.status === 'in_progress' && <span aria-hidden className="aura-ring" />}
    </div>
  );
}

