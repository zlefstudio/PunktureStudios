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

export function TicketCard({ ticket }: { ticket: Ticket }) {
  const items          = useStore((s) => s.items);
  const tickets        = useStore((s) => s.tickets);
  const setActiveTicket = useStore((s) => s.setActiveTicket);
  const activeTicketId  = useStore((s) => s.activeTicketId);

  const myItems = ticketItems(items, ticket.id);
  const total   = calcTotal(myItems);
  const isActive = activeTicketId === ticket.id;
  const pos     = ticket.status === 'waiting' ? waitingPosition(tickets, ticket.id) : null;

  return (
    <button
      onClick={() => setActiveTicket(ticket.id)}
      className="w-full text-left rounded-xl p-3 transition-all"
      style={
        isActive
          ? {
              background: 'var(--color-brand-bg)',
              border: '1px solid var(--color-brand)',
              boxShadow: '0 0 0 1px var(--color-brand-ring), var(--shadow-brand)',
            }
          : {
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${statusBorder(ticket.status)}`,
            }
      }
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
      }}
    >
      {/* Row 1: position badge + ticket # + name + status */}
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

        {/* Status badge */}
        <span
          className="status-badge flex-shrink-0"
          style={statusColor(ticket.status)}
        >
          {ticket.status === 'in_progress' ? 'Active' : ticket.status}
        </span>
      </div>

      {/* Row 2: timestamp + item summary */}
      <div className="flex items-center justify-between mt-1.5" style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
        <span>{formatTime(ticket.createdAt)}</span>
        {myItems.length > 0 && (
          <span style={{ color: 'var(--color-text-muted)' }}>
            {myItems.length} item{myItems.length !== 1 ? 's' : ''} · {peso(total)}
          </span>
        )}
      </div>

      {/* Notes */}
      {ticket.notes && (
        <p
          className="mt-1 truncate"
          style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}
        >
          {ticket.notes}
        </p>
      )}
    </button>
  );
}
