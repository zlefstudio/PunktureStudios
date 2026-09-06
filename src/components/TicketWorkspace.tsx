import { useState } from 'react';
import { useStore } from '../store';
import { WorkspaceHeader } from './WorkspaceHeader';
import { AddPiercingPanel } from './AddPiercingPanel';
import { ItemsList } from './ItemsList';
import { BreakdownModal } from './BreakdownModal';
import { calcTotal, ticketItems, peso } from './utils';
import logoImg from '../assets/logo.png';
import { CheckCircle2 } from 'lucide-react';

export function TicketWorkspace() {
  const activeTicketId = useStore((s) => s.activeTicketId);
  const tickets        = useStore((s) => s.tickets);
  const items          = useStore((s) => s.items);
  const finishTicket   = useStore((s) => s.finishTicket);

  const [showBreakdown, setShowBreakdown] = useState(false);

  const ticket = tickets.find((t) => t.id === activeTicketId);

  if (!ticket) {
    return (
      <div
        className="flex flex-col h-full items-center justify-center text-center p-8"
        style={{ background: 'var(--color-base)' }}
      >
        <img
          src={logoImg}
          alt="PUNKTURE STUDIOS"
          className="w-20 h-20 mb-5 object-contain select-none"
          style={{
            opacity: 0.2,
            filter: 'grayscale(1)',
            transition: 'opacity 300ms, filter 300ms',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLImageElement).style.opacity = '0.4';
            (e.currentTarget as HTMLImageElement).style.filter  = 'grayscale(0)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLImageElement).style.opacity = '0.2';
            (e.currentTarget as HTMLImageElement).style.filter  = 'grayscale(1)';
          }}
        />
        <p className="text-heading-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
          No ticket selected
        </p>
        <p className="text-body-sm" style={{ color: 'var(--color-text-faint)' }}>
          Pick a ticket from the queue to start.
        </p>
      </div>
    );
  }

  const myItems  = ticketItems(items, ticket.id);
  const total    = calcTotal(myItems);
  const isDone   = ticket.status === 'finished' || ticket.status === 'cancelled';
  const canFinish = myItems.length > 0;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-base)' }}>
      {/* Header */}
      <WorkspaceHeader key={ticket.id} ticket={ticket} />

      {/* Main scrollable area */}
      <div className="flex-1 overflow-y-auto">
        {!isDone && (
          <div style={{ borderBottom: '1px solid var(--color-border)' }}>
            <AddPiercingPanel ticket={ticket} />
          </div>
        )}
        <div className="px-5 py-4">
          <ItemsList ticket={ticket} items={myItems} readOnly={isDone} />
        </div>
      </div>

      {/* Footer: total + review button */}
      {!isDone && (
        <div
          className="flex-shrink-0 px-5 py-4 flex items-center justify-between gap-4"
          style={{
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <div>
            <p className="text-label-xs mb-0.5" style={{ color: 'var(--color-text-faint)' }}>
              Total
            </p>
            <p
              className="font-black"
              style={{
                fontSize: '26px',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1,
              }}
            >
              {peso(total)}
            </p>
          </div>

          <button
            onClick={() => { if (canFinish) setShowBreakdown(true); }}
            disabled={!canFinish}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-ui"
            title={!canFinish ? 'Add at least one piercing to finish' : undefined}
            style={
              canFinish
                ? {
                    background: 'var(--color-success)',
                    color: '#fff',
                    border: 'none',
                    boxShadow: 'var(--shadow-success)',
                  }
                : {
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--color-text-faint)',
                    border: '1px solid var(--color-border)',
                    cursor: 'not-allowed',
                  }
            }
          >
            {canFinish ? (
              <>
                <CheckCircle2 size={16} />
                Review Order
              </>
            ) : (
              'Add items to finish'
            )}
          </button>
        </div>
      )}

      {/* Breakdown modal */}
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
