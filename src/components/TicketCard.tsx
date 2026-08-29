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
  const items = useStore((s) => s.items);
  const tickets = useStore((s) => s.tickets);
  const setActiveTicket = useStore((s) => s.setActiveTicket);
  const activeTicketId = useStore((s) => s.activeTicketId);

  const myItems = ticketItems(items, ticket.id);
  const total = calcTotal(myItems);
  const isActive = activeTicketId === ticket.id;
  const pos = ticket.status === 'waiting' ? waitingPosition(tickets, ticket.id) : null;

  return (
    <button
      onClick={() => setActiveTicket(ticket.id)}
      className={`w-full text-left rounded-xl border p-3 transition-all ${
        isActive
          ? 'bg-violet-950/60 border-violet-500/60 ring-1 ring-violet-500/30'
          : `bg-white/4 hover:bg-white/8 ${statusBorder(ticket.status)}`
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {pos !== null && (
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-900/60 text-blue-300 text-xs font-bold flex items-center justify-center">
              {pos}
            </span>
          )}
          <span className="text-slate-400 text-sm font-mono font-semibold flex-shrink-0">
            #{ticket.ticketNumber}
          </span>
          <span className="font-semibold text-white truncate text-sm">{ticket.name}</span>
        </div>
        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${statusColor(ticket.status)}`}>
          {ticket.status === 'in_progress' ? 'Active' : ticket.status}
        </span>
      </div>

      <div className="flex items-center justify-between mt-1.5 text-xs text-slate-500">
        <span>{formatTime(ticket.createdAt)}</span>
        <div className="flex items-center gap-2">
          {myItems.length > 0 && (
            <span className="text-slate-400 font-medium">
              {myItems.length} item{myItems.length !== 1 ? 's' : ''} · {peso(total)}
            </span>
          )}
        </div>
      </div>

      {ticket.notes && (
        <p className="mt-1 text-xs text-slate-500 truncate">{ticket.notes}</p>
      )}
    </button>
  );
}
