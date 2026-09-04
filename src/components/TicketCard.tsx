import type { CSSProperties } from 'react';
import { GripVertical } from 'lucide-react';
import { useStore } from '../store';
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
    <button
      onClick={() => setActiveTicket(ticket.id)}
      className={`group w-full text-left rounded-xl p-3 transition-colors ${
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

      {/* Notes */}
      {ticket.notes && (
        <p className="mt-1 truncate" style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
          {ticket.notes}
        </p>
      )}
    </button>
  );
}

