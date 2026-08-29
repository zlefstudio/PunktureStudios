import { useState } from 'react';
import { XCircle, Play } from 'lucide-react';
import { useStore } from '../store';
import type { Ticket } from '../types';
import { statusColor, statusLabel } from './utils';

interface Props {
  ticket: Ticket;
}

export function WorkspaceHeader({ ticket }: Props) {
  const startPiercing = useStore((s) => s.startPiercing);
  const cancelTicket = useStore((s) => s.cancelTicket);
  const updateTicketNotes = useStore((s) => s.updateTicketNotes);

  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesVal, setNotesVal] = useState(ticket.notes ?? '');

  async function handleCancel() {
    await cancelTicket(ticket.id);
    setCancelConfirm(false);
  }

  async function handleNotesBlur() {
    setNotesEditing(false);
    await updateTicketNotes(ticket.id, notesVal);
  }

  const { status } = ticket;
  const isDone = status === 'finished' || status === 'cancelled';

  return (
    <div className="flex-shrink-0 border-b border-white/8 px-5 pt-5 pb-4 bg-[#111318]">
      {/* Ticket number + name + status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-slate-500 font-mono text-sm">#{ticket.ticketNumber}</span>
            <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase ${statusColor(status)}`}>
              {statusLabel(status)}
            </span>
          </div>
          <h2 className="text-xl font-black text-white truncate">{ticket.name}</h2>
        </div>


      </div>

      {/* Notes */}
      <div className="mb-3">
        {notesEditing ? (
          <input
            autoFocus
            value={notesVal}
            onChange={(e) => setNotesVal(e.target.value)}
            onBlur={handleNotesBlur}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
            placeholder="Notes…"
            className="w-full bg-white/6 border border-violet-500/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => !isDone && setNotesEditing(true)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              isDone
                ? 'cursor-default'
                : 'bg-white/4 hover:bg-white/8'
            } ${ticket.notes ? 'text-slate-400' : 'text-slate-600'}`}
          >
            {ticket.notes || (isDone ? '—' : 'Tap to add notes…')}
          </button>
        )}
      </div>

      {/* Action buttons */}
      {!isDone && (
        <div className="flex flex-wrap gap-2">
          {status !== 'in_progress' && (
            <ActionBtn
              icon={<Play size={14} />}
              label="Start Piercing"
              color="bg-violet-600 hover:bg-violet-500"
              onClick={() => startPiercing(ticket.id)}
            />
          )}

          {/* Cancel — always available for non-done */}
          {cancelConfirm ? (
            <>
              <span className="self-center text-xs text-red-400">Cancel ticket?</span>
              <ActionBtn
                icon={<XCircle size={14} />}
                label="Yes, Cancel"
                color="bg-red-700 hover:bg-red-600"
                onClick={handleCancel}
              />
              <ActionBtn
                label="No"
                color="bg-white/8 hover:bg-white/15 text-slate-300"
                onClick={() => setCancelConfirm(false)}
              />
            </>
          ) : (
            <ActionBtn
              icon={<XCircle size={14} />}
              label="Cancel"
              color="bg-white/6 hover:bg-red-950/50 text-red-400 hover:text-red-300"
              onClick={() => setCancelConfirm(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  color,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${color}`}
    >
      {icon}
      {label}
    </button>
  );
}
