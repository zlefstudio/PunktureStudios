import { useState } from 'react';
import { XCircle, Play, Clock, RotateCcw } from 'lucide-react';
import { useStore } from '../store';
import { useQueueWaitEstimates, getTicketDuration } from '../timeEstimate';
import type { Ticket } from '../types';
import { statusColor, statusLabel, ticketItems } from './utils';

interface Props {
  ticket: Ticket;
}

export function WorkspaceHeader({ ticket }: Props) {
  const startPiercing      = useStore((s) => s.startPiercing);
  const cancelSession      = useStore((s) => s.cancelSession);
  const cancelTicket       = useStore((s) => s.cancelTicket);
  const updateTicketNotes  = useStore((s) => s.updateTicketNotes);
  const items              = useStore((s) => s.items);

  const { estimates, inProgressEstimate } = useQueueWaitEstimates();
  const waitEstimate = ticket.status === 'waiting' ? estimates.get(ticket.id) : undefined;
  const myItems = ticketItems(items, ticket.id);
  const ownDuration = getTicketDuration(myItems);

  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [sessionConfirm, setSessionConfirm] = useState(false);
  const [notesEditing,  setNotesEditing]  = useState(false);
  const [notesVal,      setNotesVal]      = useState(ticket.notes ?? '');

  async function handleCancel() {
    await cancelTicket(ticket.id);
    setCancelConfirm(false);
  }

  async function handleCancelSession() {
    await cancelSession(ticket.id);
    setSessionConfirm(false);
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
          <div className="flex items-center gap-2 mb-1 flex-wrap">
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

            {/* Live Time Estimate Badge */}
            {status === 'waiting' && waitEstimate && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium time-text-transition ${
                  waitEstimate.waitMinutes === 0 ? 'next-pill-glow' : ''
                }`}
                style={{
                  fontSize: '11px',
                  background:
                    waitEstimate.waitMinutes === 0
                      ? 'rgba(16,185,129,0.12)'
                      : 'rgba(59,130,246,0.12)',
                  color:
                    waitEstimate.waitMinutes === 0 ? '#34d399' : '#93c5fd',
                  border:
                    waitEstimate.waitMinutes === 0
                      ? '1px solid rgba(16,185,129,0.28)'
                      : '1px solid rgba(59,130,246,0.25)',
                }}
              >
                {waitEstimate.waitMinutes === 0 ? (
                  <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                    <span className="sonar-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                ) : (
                  <Clock size={11} className="clock-live-tick text-blue-400" />
                )}
                {waitEstimate.formattedEstimate}
                {waitEstimate.waitMinutes === 0 ? ' · Next up' : ''} (~{ownDuration}m session)
              </span>
            )}

            {status === 'in_progress' && inProgressEstimate && inProgressEstimate.ticketId === ticket.id && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium time-pill-glow time-text-transition"
                style={{
                  fontSize: '11px',
                  background: inProgressEstimate.isOvertime
                    ? 'rgba(239,68,68,0.12)'
                    : 'rgba(139,92,246,0.12)',
                  color: inProgressEstimate.isOvertime ? '#f87171' : '#c084fc',
                  border: inProgressEstimate.isOvertime
                    ? '1px solid rgba(239,68,68,0.30)'
                    : '1px solid rgba(139,92,246,0.25)',
                }}
              >
                <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                  <span
                    className="sonar-ring absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ background: inProgressEstimate.isOvertime ? '#ef4444' : '#a855f7' }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-1.5 w-1.5"
                    style={{ background: inProgressEstimate.isOvertime ? '#ef4444' : '#c084fc' }}
                  />
                </span>
                {inProgressEstimate.isOvertime
                  ? `Overtime (${inProgressEstimate.elapsedMinutes}m elapsed / ~${inProgressEstimate.totalDuration}m est)`
                  : `~${inProgressEstimate.remainingMinutes}m left (${inProgressEstimate.elapsedMinutes}m in / ~${inProgressEstimate.totalDuration}m est)`}
              </span>
            )}
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
        <div className="flex flex-wrap items-center gap-2">
          {/* Start a session (waiting / called tickets) */}
          {status !== 'in_progress' && (
            <ActionBtn
              icon={<Play size={13} />}
              label="Start Piercing"
              variant="brand"
              onClick={() => startPiercing(ticket.id)}
            />
          )}

          {/* Cancel Session = put the client back in the waiting queue */}
          {status === 'in_progress' && !cancelConfirm && (
            sessionConfirm ? (
              <>
                <span
                  className="self-center text-body-xs font-semibold"
                  style={{ color: 'var(--color-warn-text)' }}
                >
                  Send back to queue?
                </span>
                <ActionBtn
                  icon={<RotateCcw size={13} />}
                  label="Yes, Back to Queue"
                  variant="cancel"
                  onClick={handleCancelSession}
                />
                <ActionBtn
                  label="No"
                  variant="ghost"
                  onClick={() => setSessionConfirm(false)}
                />
              </>
            ) : (
              <ActionBtn
                icon={<RotateCcw size={13} />}
                label="Cancel Session"
                variant="cancel"
                title="Cancel this session and put the client back in the waiting queue"
                onClick={() => setSessionConfirm(true)}
              />
            )
          )}

          {/* Cancel Ticket = remove it for good */}
          {!sessionConfirm && (
            cancelConfirm ? (
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
                label="Cancel Ticket"
                variant="error"
                title="Cancel this ticket (client won't be pierced)"
                onClick={() => setCancelConfirm(true)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

/* ── Internal action button ── */
type BtnVariant = 'brand' | 'error' | 'ghost' | 'cancel' | 'warn';

function ActionBtn({
  icon,
  label,
  variant,
  title,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  variant: BtnVariant;
  title?: string;
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
      background: 'rgba(220,38,38,0.14)',
      color: 'var(--color-error-text)',
      border: '1px solid rgba(248,113,113,0.45)',
    },
    warn: {
      background: 'var(--color-warn)',
      color: '#fff',
      border: 'none',
    },
  };

  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-ui-sm font-semibold"
      style={styles[variant]}
    >
      {icon}
      {label}
    </button>
  );
}
