import { useState } from 'react';
import {
  RotateCcw,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Trash2,
  AlertTriangle,
  TrendingUp,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useStore } from '../store';
import {
  calcTotal,
  ticketItems,
  peso,
  formatDate,
  formatTime,
  statusColor,
  formatJewelryName,
} from './utils';
import { CalendarPickerModal } from './CalendarPicker';

type TimeFilter = 'date' | 'month' | 'all';

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date      = new Date(y, m - 1, d);
  const todayStr  = toDateString(new Date());
  const formatted = date.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return dateStr === todayStr ? `Today · ${formatted}` : formatted;
}

export function HistoryView() {
  const tickets                    = useStore((s) => s.tickets);
  const items                      = useStore((s) => s.items);
  const reopenTicket               = useStore((s) => s.reopenTicket);
  const setActiveTicket            = useStore((s) => s.setActiveTicket);
  const clearHistoryAndResetNumbering = useStore((s) => s.clearHistoryAndResetNumbering);

  const [expandedId,       setExpandedId]       = useState<string | null>(null);
  const [reopenConfirm,    setReopenConfirm]    = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [resetting,        setResetting]        = useState(false);
  const [timeFilter,       setTimeFilter]       = useState<TimeFilter>('date');

  const todayStr = toDateString(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const now          = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth();

  function isMatchingSelectedDate(timestamp: number): boolean {
    return toDateString(new Date(timestamp)) === selectedDate;
  }
  function isSameMonth(timestamp: number): boolean {
    const d = new Date(timestamp);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  }

  const finishedTickets = tickets.filter((t) => t.status === 'finished');

  const dateTickets     = finishedTickets.filter((t) => isMatchingSelectedDate(t.finishedAt ?? t.createdAt));
  const dateTotalPesos  = dateTickets.reduce((s, t) => s + calcTotal(ticketItems(items, t.id)), 0);
  const dateTotalItems  = dateTickets.reduce((s, t) => {
    return s + ticketItems(items, t.id).reduce((a, i) => a + i.quantity, 0);
  }, 0);

  const monthTickets    = finishedTickets.filter((t) => isSameMonth(t.finishedAt ?? t.createdAt));
  const monthTotalPesos = monthTickets.reduce((s, t) => s + calcTotal(ticketItems(items, t.id)), 0);

  const allTimeTotalPesos = finishedTickets.reduce((s, t) => s + calcTotal(ticketItems(items, t.id)), 0);

  const history = tickets
    .filter((t) => t.status === 'finished' || t.status === 'cancelled')
    .filter((t) => {
      const time = t.finishedAt ?? t.cancelledAt ?? t.createdAt;
      if (timeFilter === 'date')  return isMatchingSelectedDate(time);
      if (timeFilter === 'month') return isSameMonth(time);
      return true;
    })
    .sort((a, b) => {
      const ta = a.finishedAt ?? a.cancelledAt ?? a.createdAt;
      const tb = b.finishedAt ?? b.cancelledAt ?? b.createdAt;
      return tb - ta;
    });

  function handlePrevDay() {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - 1);
    setSelectedDate(toDateString(date));
    setTimeFilter('date');
  }
  function handleNextDay() {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 1);
    setSelectedDate(toDateString(date));
    setTimeFilter('date');
  }
  function handleToday() {
    setSelectedDate(todayStr);
    setTimeFilter('date');
  }

  async function handleReopen(id: string) {
    await reopenTicket(id);
    setReopenConfirm(null);
    setActiveTicket(id);
  }
  async function handleResetNumbering() {
    setResetting(true);
    await clearHistoryAndResetNumbering();
    setResetting(false);
    setShowResetConfirm(false);
  }

  const activeDates     = new Set(
    tickets.map((t) => toDateString(new Date(t.finishedAt ?? t.cancelledAt ?? t.createdAt)))
  );
  const isTodaySelected = selectedDate === todayStr;

  /* ── Shared style helpers ── */
  const filterCardBase: React.CSSProperties = {
    cursor: 'pointer',
    borderRadius: '12px',
    padding: '12px 14px',
    border: '1px solid var(--color-border)',
    background: 'rgba(255,255,255,0.03)',
    transition:
      'background 200ms, border-color 200ms, box-shadow 200ms, transform 180ms cubic-bezier(0.16, 1, 0.3, 1), filter 180ms',
  };
  const navBtnStyle: React.CSSProperties = {
    padding: '8px',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

      {/* ── Stats + Date Nav card ── */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{
          background: 'linear-gradient(145deg, var(--color-surface) 0%, var(--color-muted) 100%)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={13} style={{ color: 'var(--color-success-text)' }} />
            <span className="text-label-xs" style={{ color: 'var(--color-text-muted)' }}>
              Sales &amp; Income
            </span>
          </div>
          {!showResetConfirm && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-body-xs font-semibold"
              style={{
                background: 'var(--color-error-bg)',
                border: '1px solid rgba(185,28,28,0.25)',
                color: 'var(--color-error-text)',
              }}
              title="Clear test data and reset counter"
            >
              <RefreshCw size={10} />
              Reset #1
            </button>
          )}
        </div>

        {/* Date navigation bar */}
        <div
          className="rounded-xl p-2.5 space-y-2"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center justify-between gap-1.5">
            <button type="button" onClick={handlePrevDay} style={navBtnStyle} title="Previous Day">
              <ChevronLeft size={17} />
            </button>

            <div className="relative flex-1 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setShowCalendarModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl font-bold w-full justify-center"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid var(--color-border-strong)',
                  color: 'var(--color-text)',
                  fontSize: '12px',
                }}
              >
                <CalendarIcon size={14} style={{ color: 'var(--color-success-text)', flexShrink: 0 }} />
                <span className="truncate">{formatDisplayDate(selectedDate)}</span>
              </button>
            </div>

            <button type="button" onClick={handleNextDay} style={navBtnStyle} title="Next Day">
              <ChevronRight size={17} />
            </button>
          </div>

          {!isTodaySelected && (
            <button
              onClick={handleToday}
              className="w-full py-1 text-center text-body-xs font-bold rounded-md"
              style={{
                background: 'var(--color-success-bg)',
                border: '1px solid rgba(5,150,105,0.25)',
                color: 'var(--color-success-text)',
              }}
            >
              Jump to Today
            </button>
          )}
        </div>

        {/* Today's Income banner */}
        <div
          className="clickable-card"
          onClick={() => setTimeFilter('date')}
          style={{
            ...filterCardBase,
            ...(timeFilter === 'date'
              ? {
                  background: 'var(--color-success-bg)',
                  borderColor: 'rgba(5,150,105,0.50)',
                  boxShadow: '0 0 0 1px var(--color-success-ring)',
                }
              : {}),
          }}
        >
          <div className="flex items-center justify-between text-label-xs mb-1">
            <span style={{ color: 'var(--color-success-text)' }}>
              {isTodaySelected ? "Today's Income" : `Income on ${selectedDate}`}
            </span>
            <span style={{ color: 'var(--color-text-muted)', fontWeight: 500, letterSpacing: '0' }}>
              {dateTickets.length} client{dateTickets.length !== 1 ? 's' : ''} · {dateTotalItems} item{dateTotalItems !== 1 ? 's' : ''}
            </span>
          </div>
          <div
            className="font-black tracking-tight"
            style={{ fontSize: '28px', color: 'var(--color-success-text)', fontFamily: 'var(--font-mono)' }}
          >
            {peso(dateTotalPesos)}
          </div>
        </div>

        {/* Month + All-time pills */}
        <div className="grid grid-cols-2 gap-2">
          {/* This Month */}
          <div
            className="clickable-card"
            onClick={() => setTimeFilter('month')}
            style={{
              ...filterCardBase,
              ...(timeFilter === 'month'
                ? {
                    background: 'var(--color-brand-bg)',
                    borderColor: 'rgba(124,58,237,0.45)',
                    boxShadow: '0 0 0 1px var(--color-brand-ring)',
                  }
                : {}),
            }}
          >
            <div className="text-label-xs mb-0.5" style={{ color: 'var(--color-brand-text)' }}>
              This Month
            </div>
            <div
              className="font-black"
              style={{ fontSize: '17px', color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
            >
              {peso(monthTotalPesos)}
            </div>
            <div className="text-body-xs mt-0.5" style={{ color: 'var(--color-text-faint)' }}>
              {monthTickets.length} finished
            </div>
          </div>

          {/* All Time */}
          <div
            className="clickable-card"
            onClick={() => setTimeFilter('all')}
            style={{
              ...filterCardBase,
              ...(timeFilter === 'all'
                ? {
                    background: 'rgba(37,99,235,0.12)',
                    borderColor: 'rgba(37,99,235,0.40)',
                    boxShadow: '0 0 0 1px rgba(96,165,250,0.20)',
                  }
                : {}),
            }}
          >
            <div className="text-label-xs mb-0.5" style={{ color: 'var(--color-status-waiting-text)' }}>
              All Time
            </div>
            <div
              className="font-black"
              style={{ fontSize: '17px', color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
            >
              {peso(allTimeTotalPesos)}
            </div>
            <div className="text-body-xs mt-0.5" style={{ color: 'var(--color-text-faint)' }}>
              {finishedTickets.length} finished
            </div>
          </div>
        </div>
      </div>

      {/* ── Reset confirm ── */}
      {showResetConfirm && (
        <div
          className="rounded-xl p-3.5 space-y-2.5"
          style={{
            background: 'var(--color-error-bg)',
            border: '1px solid rgba(185,28,28,0.40)',
          }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} style={{ color: 'var(--color-error-text)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p className="text-body-sm font-bold mb-0.5" style={{ color: 'var(--color-error-text)' }}>
                Reset Ticket Numbers to #1?
              </p>
              <p className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>
                This will remove completed/cancelled test records from history and start new ticket numbers back from #1.
              </p>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleResetNumbering}
              disabled={resetting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-body-xs font-bold"
              style={{
                background: 'var(--color-error)',
                color: '#fff',
                border: 'none',
                opacity: resetting ? 0.5 : 1,
              }}
            >
              <Trash2 size={12} />
              {resetting ? 'Resetting…' : 'Yes, Reset to #1'}
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 py-2 rounded-lg text-body-xs font-semibold"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Section header ── */}
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-label-xs" style={{ color: 'var(--color-text-faint)' }}>
          {timeFilter === 'date'
            ? isTodaySelected
              ? `Today's Orders (${history.length})`
              : `Orders for ${selectedDate} (${history.length})`
            : timeFilter === 'month'
            ? `This Month's Orders (${history.length})`
            : `All Orders (${history.length})`}
        </span>
        <span
          className="text-body-xs font-bold"
          style={{ color: 'var(--color-success-text)', fontFamily: 'var(--font-mono)' }}
        >
          {timeFilter === 'date'
            ? peso(dateTotalPesos)
            : timeFilter === 'month'
            ? peso(monthTotalPesos)
            : peso(allTimeTotalPesos)}
        </span>
      </div>

      {/* ── History list ── */}
      {history.length === 0 ? (
        <div
          className="flex items-center justify-center text-body-sm py-12 text-center rounded-xl"
          style={{
            color: 'var(--color-text-faint)',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          No records for{' '}
          {timeFilter === 'date'
            ? isTodaySelected ? 'today' : selectedDate
            : timeFilter === 'month'
            ? 'this month'
            : 'this period'}
          .
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((t) => {
            const myItems   = ticketItems(items, t.id);
            const total     = calcTotal(myItems);
            const isExpanded = expandedId === t.id;
            const doneAt    = t.finishedAt ?? t.cancelledAt ?? t.createdAt;

            return (
              <div
                key={t.id}
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'var(--color-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {/* Row: expand toggle */}
                <button
                  className="w-full text-left px-3 py-3 flex items-center gap-2"
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                >
                  <span
                    className="font-mono font-semibold flex-shrink-0"
                    style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}
                  >
                    #{t.ticketNumber}
                  </span>
                  <span
                    className="font-medium flex-1 truncate"
                    style={{ fontSize: '13px', color: 'var(--color-text)' }}
                  >
                    {t.name}
                  </span>
                  <span className="status-badge" style={statusColor(t.status)}>
                    {t.status}
                  </span>
                  {isExpanded
                    ? <ChevronUp size={13} style={{ color: 'var(--color-text-faint)', flexShrink: 0 }} />
                    : <ChevronDown size={13} style={{ color: 'var(--color-text-faint)', flexShrink: 0 }} />
                  }
                </button>

                {/* Timestamp + total */}
                <div
                  className="px-3 pb-2 flex items-center justify-between text-body-xs"
                  style={{ color: 'var(--color-text-faint)' }}
                >
                  <span>{formatDate(doneAt)} {formatTime(doneAt)}</span>
                  {myItems.length > 0 && (
                    <span
                      className="font-semibold font-mono"
                      style={{
                        color: t.status === 'finished'
                          ? 'var(--color-success-text)'
                          : 'var(--color-text-faint)',
                        textDecoration: t.status !== 'finished' ? 'line-through' : 'none',
                      }}
                    >
                      {peso(total)}
                    </span>
                  )}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div
                    className="px-3 py-3 space-y-2"
                    style={{ borderTop: '1px solid var(--color-border)' }}
                  >
                    {myItems.length === 0 ? (
                      <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
                        No items recorded.
                      </p>
                    ) : (
                      myItems.map((item) => {
                        const lt = (item.basePrice + item.upgradePrice) * item.quantity;
                        return (
                          <div
                            key={item.id}
                            className="flex justify-between text-body-xs"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            <span>
                              {item.memberLabel ? `${item.memberLabel} · ` : ''}
                              {item.placementName === 'Jewelry'
                                ? formatJewelryName(item.upgradeLabel)
                                : item.placementName}
                              {item.placementName !== 'Jewelry' && item.upgradePrice > 0
                                ? ` + ${formatJewelryName(item.upgradeLabel)}`
                                : ''}
                              {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                            </span>
                            <span
                              className="font-semibold font-mono"
                              style={{ color: 'var(--color-text)' }}
                            >
                              {peso(lt)}
                            </span>
                          </div>
                        );
                      })
                    )}

                    {myItems.length > 0 && (
                      <div
                        className="flex justify-between text-body-sm font-bold pt-1"
                        style={{
                          borderTop: '1px solid var(--color-border)',
                          color: 'var(--color-text)',
                        }}
                      >
                        <span>Total</span>
                        <span
                          className="font-mono"
                          style={{
                            color: t.status === 'finished'
                              ? 'var(--color-success-text)'
                              : 'var(--color-text-faint)',
                            textDecoration: t.status !== 'finished' ? 'line-through' : 'none',
                          }}
                        >
                          {peso(total)}
                        </span>
                      </div>
                    )}

                    {/* Reopen */}
                    <div className="flex gap-2 pt-1">
                      {reopenConfirm === t.id ? (
                        <>
                          <p
                            className="text-body-xs font-semibold flex-1 self-center"
                            style={{ color: 'var(--color-warn-text)' }}
                          >
                            Reopen this ticket?
                          </p>
                          <button
                            onClick={() => handleReopen(t.id)}
                            className="px-3 py-1.5 rounded-lg text-body-xs font-semibold"
                            style={{ background: 'var(--color-warn)', color: '#fff', border: 'none' }}
                          >
                            Yes, Reopen
                          </button>
                          <button
                            onClick={() => setReopenConfirm(null)}
                            className="px-3 py-1.5 rounded-lg text-body-xs font-semibold"
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text-muted)',
                            }}
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setReopenConfirm(t.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-xs font-semibold"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          <RotateCcw size={11} />
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Calendar Modal ── */}
      {showCalendarModal && (
        <CalendarPickerModal
          selectedDate={selectedDate}
          activeDates={activeDates}
          onSelectDate={(dateStr) => {
            setSelectedDate(dateStr);
            setTimeFilter('date');
          }}
          onClose={() => setShowCalendarModal(false)}
        />
      )}
    </div>
  );
}
