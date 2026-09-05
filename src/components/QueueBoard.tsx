import { useState, type KeyboardEvent } from 'react';
import { UserPlus, Search, X } from 'lucide-react';
import { useStore } from '../store';
import { sortWaiting } from '../queue';
import { TicketCard } from './TicketCard';
import { WaitingQueueList } from './WaitingQueueList';
import { HistoryView } from './HistoryView';
import { PublicSettingsView } from './PublicSettingsView';
import { SyncPanel } from './SyncPanel';
import logoImg from '../assets/logo.png';

type Tab = 'active' | 'history' | 'public';

const TAB_META: { id: Tab; label: string }[] = [
  { id: 'active',  label: '🗂 Queue'   },
  { id: 'history', label: '📋 History' },
  { id: 'public',  label: '🌐 Public'  },
];

export function QueueBoard() {
  const tickets        = useStore((s) => s.tickets);
  const addTicket      = useStore((s) => s.addTicket);
  const setActiveTicket = useStore((s) => s.setActiveTicket);
  const moveWaitingTicket = useStore((s) => s.moveWaitingTicket);

  const [name,    setName]    = useState('');
  const [notes,   setNotes]   = useState('');
  const [search,  setSearch]  = useState('');
  const [tab,     setTab]     = useState<Tab>('active');
  const [adding,  setAdding]  = useState(false);

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ticket = await addTicket(trimmed, notes.trim() || undefined);
    setName('');
    setNotes('');
    setAdding(false);
    setActiveTicket(ticket.id);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); }
    if (e.key === 'Escape') { setAdding(false); setName(''); setNotes(''); }
  }

  const q        = search.toLowerCase();
  const filtered = (status: string[]) =>
    tickets.filter((t) => {
      if (!status.includes(t.status)) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        `#${t.ticketNumber}`.includes(q)  ||
        String(t.ticketNumber).includes(q)
      );
    });

  const waiting    = sortWaiting(filtered(['waiting']));
  const canReorder = q.length === 0;
  const called     = filtered(['called']).sort((a, b) => (a.calledAt ?? 0) - (b.calledAt ?? 0));
  const inProgress = filtered(['in_progress']).sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-base)' }}>

      {/* ── Top header ── */}
      <div
        className="px-4 pt-4 pb-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        {/* Logo + wordmark */}
        <div className="flex items-center justify-center mb-3">
          <h1
            className="font-sanguine select-none flex items-center gap-2.5"
            style={{
              fontSize: '19px',
              letterSpacing: '0.12em',
              color: 'var(--color-text)',
            }}
          >
            <img
              src={logoImg}
              alt="PUNKTURE STUDIOS"
              className="w-8 h-8 object-contain drop-shadow"
            />
            PUNKTURE STUDIOS
          </h1>
        </div>

        {/* ── Tab bar ── */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          {TAB_META.map(({ id, label }) => {
            const isActive = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex-1 py-1.5 px-2 rounded-lg text-label-xs transition-all"
                style={
                  isActive
                    ? {
                        background: 'var(--color-brand)',
                        color: '#fff',
                        boxShadow: 'var(--shadow-brand)',
                      }
                    : {
                        background: 'transparent',
                        color: 'var(--color-text-faint)',
                      }
                }
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--color-text)'; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--color-text-faint)'; }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      {tab === 'active' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Add client */}
          <div
            className="px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            {!adding ? (
              <button
                onClick={() => setAdding(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-ui-sm"
                style={{
                  border: '1.5px dashed rgba(255,255,255,0.16)',
                  background: 'transparent',
                  color: 'var(--color-text-faint)',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'var(--color-brand)';
                  el.style.background  = 'var(--color-brand-subtle)';
                  el.style.color       = 'var(--color-brand-text)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'rgba(255,255,255,0.16)';
                  el.style.background  = 'transparent';
                  el.style.color       = 'var(--color-text-faint)';
                }}
              >
                <UserPlus size={15} />
                Add Client to Queue
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  autoFocus
                  placeholder="Name / nickname / group *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="input"
                />
                <input
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="input"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAdd}
                    disabled={!name.trim()}
                    className="flex-1 py-2.5 rounded-xl text-ui font-bold"
                    style={{
                      background: !name.trim() ? 'rgba(255,255,255,0.06)' : 'var(--color-brand)',
                      color: !name.trim() ? 'var(--color-text-faint)' : '#fff',
                      opacity: !name.trim() ? 0.5 : 1,
                    }}
                  >
                    Save to Queue
                  </button>
                  <button
                    onClick={() => { setAdding(false); setName(''); setNotes(''); }}
                    className="p-2.5 rounded-xl"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="px-4 py-2.5 flex-shrink-0">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-text-faint)' }}
              />
              <input
                placeholder="Search name or #number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input"
                style={{ paddingLeft: '32px', paddingRight: search ? '32px' : '12px' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-faint)', background: 'none', border: 'none', padding: 0 }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Queue sections */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">

            {/* Called */}
            {called.length > 0 && (
              <Section label="📣 Called" count={called.length} tokenColor="var(--color-warn-text)">
                {called.map((t) => <TicketCard key={t.id} ticket={t} />)}
              </Section>
            )}

            {/* In Progress */}
            {inProgress.length > 0 && (
              <Section label="⚡ In Progress" count={inProgress.length} tokenColor="var(--color-brand-text)">
                {inProgress.map((t) => <TicketCard key={t.id} ticket={t} />)}
              </Section>
            )}

            {/* Waiting */}
            <Section
              label="🕐 Waiting"
              count={waiting.length}
              tokenColor="var(--color-status-waiting-text)"
              hint={canReorder && waiting.length > 1 ? 'drag to reorder' : undefined}
            >
              {waiting.length === 0 ? (
                <p className="text-center text-body-sm py-6" style={{ color: 'var(--color-text-faint)' }}>
                  No waiting clients
                </p>
              ) : (
                <WaitingQueueList
                  tickets={waiting}
                  disabled={!canReorder}
                  onReorder={(id, toIndex) => moveWaitingTicket(id, toIndex)}
                />
              )}
            </Section>

          </div>
        </div>
      )}

      {tab === 'history' && <HistoryView />}
      {tab === 'public'  && <PublicSettingsView />}

      {/* Cloud sync status (always visible at the bottom) */}
      <SyncPanel />
    </div>
  );
}

/* ── Section header ── */
function Section({
  label,
  count,
  tokenColor,
  hint,
  children,
}: {
  label: string;
  count: number;
  tokenColor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-label-xs" style={{ color: tokenColor }}>{label}</span>
        <span
          className="text-label-xs font-mono"
          style={{ color: 'var(--color-text-faint)' }}
        >
          {count}
        </span>
        {hint && (
          <span
            className="ml-auto text-label-xs font-normal"
            style={{ color: 'var(--color-text-faint)', textTransform: 'none', letterSpacing: '0.02em' }}
          >
            {hint}
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
