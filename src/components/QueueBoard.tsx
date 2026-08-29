import { useState, type KeyboardEvent } from 'react';
import { UserPlus, Search, X } from 'lucide-react';
import { useStore } from '../store';
import { TicketCard } from './TicketCard';
import { NowServingBanner } from './NowServingBanner';
import { HistoryView } from './HistoryView';
import { BackupView } from './BackupView';
import logoImg from '../assets/logo.png';

type Tab = 'active' | 'history' | 'backup';

export function QueueBoard() {
  const tickets = useStore((s) => s.tickets);
  const addTicket = useStore((s) => s.addTicket);
  const setActiveTicket = useStore((s) => s.setActiveTicket);

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('active');
  const [adding, setAdding] = useState(false);

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === 'Escape') {
      setAdding(false);
      setName('');
      setNotes('');
    }
  }

  const q = search.toLowerCase();
  const filtered = (status: string[]) =>
    tickets.filter((t) => {
      if (!status.includes(t.status)) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        `#${t.ticketNumber}`.includes(q) ||
        String(t.ticketNumber).includes(q)
      );
    });

  const waiting = filtered(['waiting']).sort((a, b) => a.createdAt - b.createdAt);
  const called = filtered(['called']).sort((a, b) => (a.calledAt ?? 0) - (b.calledAt ?? 0));
  const inProgress = filtered(['in_progress']).sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));

  return (
    <div className="flex flex-col h-full">
      {/* Top header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center justify-center mb-3">
          <h1 className="text-xl text-white tracking-wider flex items-center gap-2.5 font-sanguine select-none">
            <img src={logoImg} alt="PUNKTURE STUDIOS" className="w-8 h-8 object-contain drop-shadow" />
            PUNKTURE STUDIOS
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
          {(['active', 'history', 'backup'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold capitalize transition-colors ${
                tab === t
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t === 'backup' ? '💾 Backup' : t === 'history' ? '📋 History' : '🗂 Queue'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'active' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Now Serving */}
          <NowServingBanner />

          {/* Add client */}
          <div className="px-4 py-3 border-b border-white/8 flex-shrink-0">
            {!adding ? (
              <button
                onClick={() => setAdding(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-white/20 hover:border-violet-500/60 hover:bg-violet-950/30 text-slate-400 hover:text-violet-300 text-sm font-medium transition-all"
              >
                <UserPlus size={16} />
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
                  className="w-full bg-white/8 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
                <input
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-white/8 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAdd}
                    disabled={!name.trim()}
                    className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors shadow-sm"
                  >
                    Save to Queue
                  </button>
                  <button
                    onClick={() => { setAdding(false); setName(''); setNotes(''); }}
                    className="p-2.5 rounded-lg bg-white/8 hover:bg-white/15 text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="px-4 py-2 flex-shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                placeholder="Search name or #number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/6 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/60"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
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
              <Section label="📣 Called" count={called.length} color="text-amber-400">
                {called.map((t) => (
                  <TicketCard key={t.id} ticket={t} />
                ))}
              </Section>
            )}

            {/* In Progress */}
            {inProgress.length > 0 && (
              <Section label="⚡ In Progress" count={inProgress.length} color="text-violet-400">
                {inProgress.map((t) => (
                  <TicketCard key={t.id} ticket={t} />
                ))}
              </Section>
            )}

            {/* Waiting */}
            <Section label="🕐 Waiting" count={waiting.length} color="text-blue-400">
              {waiting.length === 0 ? (
                <p className="text-center text-slate-600 text-sm py-6">No waiting clients</p>
              ) : (
                waiting.map((t) => (
                  <TicketCard key={t.id} ticket={t} />
                ))
              )}
            </Section>
          </div>
        </div>
      )}

      {tab === 'history' && <HistoryView />}
      {tab === 'backup' && <BackupView />}
    </div>
  );
}

function Section({
  label,
  count,
  color,
  children,
}: {
  label: string;
  count: number;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold uppercase tracking-wider ${color}`}>{label}</span>
        <span className="text-xs text-slate-600 font-medium">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
