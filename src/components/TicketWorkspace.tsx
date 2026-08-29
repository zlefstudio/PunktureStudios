import { useState } from 'react';
import { useStore } from '../store';
import { WorkspaceHeader } from './WorkspaceHeader';
import { AddPiercingPanel } from './AddPiercingPanel';
import { ItemsList } from './ItemsList';
import { BreakdownModal } from './BreakdownModal';
import { calcTotal, ticketItems, peso } from './utils';
import logoImg from '../assets/logo.png';

export function TicketWorkspace() {
  const activeTicketId = useStore((s) => s.activeTicketId);
  const tickets = useStore((s) => s.tickets);
  const items = useStore((s) => s.items);
  const finishTicket = useStore((s) => s.finishTicket);

  const [showBreakdown, setShowBreakdown] = useState(false);

  const ticket = tickets.find((t) => t.id === activeTicketId);

  if (!ticket) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-8 text-slate-600">
        <img
          src={logoImg}
          alt="PUNKTURE STUDIOS"
          className="w-20 h-20 mb-4 opacity-25 object-contain grayscale hover:grayscale-0 hover:opacity-40 transition-all duration-300 select-none"
        />
        <p className="text-lg font-semibold text-slate-500">No ticket selected</p>
        <p className="text-sm mt-1">Pick a ticket from the queue to start.</p>
      </div>
    );
  }

  const myItems = ticketItems(items, ticket.id);
  const total = calcTotal(myItems);
  const isDone = ticket.status === 'finished' || ticket.status === 'cancelled';
  const canFinish = myItems.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <WorkspaceHeader ticket={ticket} />

      {/* Main scrollable area */}
      <div className="flex-1 overflow-y-auto">
        {/* Add piercing panel — available even for waiting/finished read view */}
        {!isDone && (
          <div className="border-b border-white/8">
            <AddPiercingPanel ticket={ticket} />
          </div>
        )}

        {/* Items list */}
        <div className="px-5 py-4">
          <ItemsList ticket={ticket} items={myItems} readOnly={isDone} />
        </div>
      </div>

      {/* Footer: total + finish button */}
      {!isDone && (
        <div className="flex-shrink-0 border-t border-white/8 px-5 py-4 flex items-center justify-between gap-4 bg-[#0d0f14]">
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Total</p>
            <p className="text-2xl font-black text-white">{peso(total)}</p>
          </div>
          <button
            onClick={() => {
              if (canFinish) setShowBreakdown(true);
            }}
            disabled={!canFinish}
            title={!canFinish ? 'Add at least one piercing to finish' : undefined}
            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${
              canFinish
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40'
                : 'bg-white/8 text-slate-600 cursor-not-allowed'
            }`}
          >
            {canFinish ? '✓ Review Order' : 'Add items to finish'}
          </button>
        </div>
      )}

      {/* Finish breakdown modal */}
      {showBreakdown && (
        <BreakdownModal
          ticket={ticket}
          items={myItems}
          total={total}
          onClose={() => setShowBreakdown(false)}
          onConfirm={async () => {
            await finishTicket(ticket.id);
            setShowBreakdown(false);
          }}
        />
      )}
    </div>
  );
}
