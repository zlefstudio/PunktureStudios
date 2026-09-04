import { useState } from 'react';
import { XCircle, Play } from 'lucide-react';
import { useStore } from '../store';
import type { Ticket } from '../types';
import { statusColor, statusLabel } from './utils';

interface Props {
  ticket: Ticket;
}

export function WorkspaceHeader({ ticket }: Props) {
  const startPiercing      = useStore((s) => s.startPiercing);
  const cancelTicket       = useStore((s) => s.cancelTicket);
  const updateTicketNotes  = useStore((s) => s.updateTicketNotes);

  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [notesEditing,  setNotesEditing]  = useState(false);
  const [notesVal,      setNotesVal]      = useState(ticket.notes ?? '');

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
    <div
      className="flex-shrink-0 px-5 pt-5 pb-4"
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Ticket number + name + status badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="font-mono font-semibold"
              style={{ fontSize: '12px', color: 'var(--color-text-faint)' }}
            >
              #{ticket.ticketNumber}
            </span>
            <span
              className="status-badge"
              style={statusColor(status)}
            >
              {statusLabel(status)}
            </span>
          </div>
          <h2
            className="font-black truncate"
            style={{ fontSize: '22px', color: 'var(--color-text)', lineHeight: 1.15 }}
          >
            {ticket.name}
          </h2>
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
            }}
            placeholder="Notes…"
            className="input"
          />
        ) : (
          <button
            onClick={() => !isDone && setNotesEditing(true)}
            className="w-full text-left rounded-lg px-3 py-2 text-body-sm transition-all"
            style={{
              cursor: isDone ? 'default' : 'text',
              background: isDone ? 'transparent' : 'rgba(255,255,255,0.04)',
              color: ticket.notes ? 'var(--color-text-muted)' : 'var(--color-text-faint)',
              border: '1px solid transparent',
            }}
            onMouseEnter={(e) => {
              if (!isDone) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
            }}
            onMouseLeave={(e) => {
              if (!isDone) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
            }}
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
              icon={<Play size={13} />}
              label="Start Piercing"
              variant="brand"
              onClick={() => startPiercing(ticket.id)}
            />
          )}

          {cancelConfirm ? (
            <>
              <span
                className="self-center text-body-xs font-semibold"
                style={{ color: 'var(--color-error-text)' }}
              >
                Cancel ticket?
              </span>
              <ActionBtn
                icon={<XCircle size={13} />}
                label="Yes, Cancel"
                variant="error"
                onClick={handleCancel}
              />
              <ActionBtn
                label="No"
                variant="ghost"
                onClick={() => setCancelConfirm(false)}
              />
            </>
          ) : (
            <ActionBtn
              icon={<XCircle size={13} />}
              label="Cancel"
              variant="cancel"
              onClick={() => setCancelConfirm(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Internal action button ── */
type BtnVariant = 'brand' | 'error' | 'ghost' | 'cancel';

function ActionBtn({
  icon,
  label,
  variant,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  variant: BtnVariant;
  onClick: () => void;
}) {
  const styles: Record<BtnVariant, React.CSSProperties> = {
    brand: {
      background: 'var(--color-brand)',
      color: '#fff',
      border: 'none',
    },
    error: {
      background: 'var(--color-error)',
      color: '#fff',
      border: 'none',
    },
    ghost: {
      background: 'rgba(255,255,255,0.07)',
      color: 'var(--color-text-muted)',
      border: '1px solid var(--color-border)',
    },
    cancel: {
      background: 'rgba(255,255,255,0.05)',
      color: 'var(--color-error-text)',
      border: '1px solid rgba(185,28,28,0.25)',
    },
  };

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-ui-sm font-semibold"
      style={styles[variant]}
    >
      {icon}
      {label}
    </button>
  );
}
