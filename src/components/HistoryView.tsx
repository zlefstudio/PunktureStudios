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
import { calcTotal, ticketItems, peso, formatDate, formatTime, statusColor, formatJewelryName } from './utils';
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
  const date = new Date(y, m - 1, d);
  const todayStr = toDateString(new Date());

  const formatted = date.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (dateStr === todayStr) {
    return `Today · ${formatted}`;
  }
  return formatted;
}

export function HistoryView() {
  const tickets = useStore((s) => s.tickets);
  const items = useStore((s) => s.items);
  const reopenTicket = useStore((s) => s.reopenTicket);
  const setActiveTicket = useStore((s) => s.setActiveTicket);
  const clearHistoryAndResetNumbering = useStore((s) => s.clearHistoryAndResetNumbering);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reopenConfirm, setReopenConfirm] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('date');

  // Default selected date is today in YYYY-MM-DD
  const todayStr = toDateString(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  function isMatchingSelectedDate(timestamp: number): boolean {
    const d = new Date(timestamp);
    return toDateString(d) === selectedDate;
  }

  function isSameMonth(timestamp: number): boolean {
    const d = new Date(timestamp);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  }

  const finishedTickets = tickets.filter((t) => t.status === 'finished');

  // Selected date finished stats
  const dateTickets = finishedTickets.filter((t) => isMatchingSelectedDate(t.finishedAt ?? t.createdAt));
  const dateTotalPesos = dateTickets.reduce((sum, t) => sum + calcTotal(ticketItems(items, t.id)), 0);
  const dateTotalItems = dateTickets.reduce((sum, t) => {
    const myItems = ticketItems(items, t.id);
    return sum + myItems.reduce((acc, i) => acc + i.quantity, 0);
  }, 0);

  // Monthly finished stats (This Month)
  const monthTickets = finishedTickets.filter((t) => isSameMonth(t.finishedAt ?? t.createdAt));
  const monthTotalPesos = monthTickets.reduce((sum, t) => sum + calcTotal(ticketItems(items, t.id)), 0);

  // All-time finished stats
  const allTimeTotalPesos = finishedTickets.reduce((sum, t) => sum + calcTotal(ticketItems(items, t.id)), 0);

  // Filtered history records list
  const history = tickets
    .filter((t) => t.status === 'finished' || t.status === 'cancelled')
    .filter((t) => {
      const time = t.finishedAt ?? t.cancelledAt ?? t.createdAt;
      if (timeFilter === 'date') return isMatchingSelectedDate(time);
      if (timeFilter === 'month') return isSameMonth(time);
      return true;
    })
    .sort((a, b) => {
      const ta = a.finishedAt ?? a.cancelledAt ?? a.createdAt;
      const tb = b.finishedAt ?? b.cancelledAt ?? b.createdAt;
      return tb - ta;
    });

  // Date stepper handlers
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

  const activeDates = new Set(
    tickets.map((t) => toDateString(new Date(t.finishedAt ?? t.cancelledAt ?? t.createdAt)))
  );

  const isTodaySelected = selectedDate === todayStr;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {/* Top Card: Sales Performance & Interactive Calendar Picker */}
      <div className="rounded-2xl bg-gradient-to-br from-[#121620] via-[#141926] to-[#171c2b] border border-white/12 p-4 shadow-xl space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-300 text-xs font-bold uppercase tracking-wider">
            <TrendingUp size={14} className="text-emerald-400" />
            <span>Sales &amp; Income</span>
          </div>

          {!showResetConfirm && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-red-300 hover:text-white text-[11px] font-semibold transition-colors"
              title="Clear test data and reset counter"
            >
              <RefreshCw size={11} />
              Reset #1
            </button>
          )}
        </div>

        {/* Date Selector Navigation Bar */}
        <div className="bg-white/4 border border-white/8 rounded-xl p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-1.5">
            {/* Prev Day Button */}
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-2 rounded-lg bg-white/6 hover:bg-white/12 active:scale-95 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft size={18} />
            </button>

            {/* Custom Date Input with Calendar Icon */}
            <div className="relative flex-1 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setShowCalendarModal(true)}
                className="flex items-center gap-2 cursor-pointer bg-white/8 hover:bg-white/14 border border-white/15 active:scale-[0.99] px-3 py-2 rounded-xl text-xs font-bold text-white transition-all w-full justify-center shadow-sm"
              >
                <CalendarIcon size={15} className="text-emerald-400 flex-shrink-0" />
                <span className="truncate text-xs font-bold">{formatDisplayDate(selectedDate)}</span>
              </button>
            </div>

            {/* Next Day Button */}
            <button
              type="button"
              onClick={handleNextDay}
              className="p-2 rounded-lg bg-white/6 hover:bg-white/12 active:scale-95 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Next Day"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Quick "Today" jump button if another day is selected */}
          {!isTodaySelected && (
            <button
              onClick={handleToday}
              className="w-full py-1 text-center text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-800/40 rounded-md transition-colors"
            >
              Jump to Today
            </button>
          )}
        </div>

        {/* Selected Date Sales Banner */}
        <div
          onClick={() => setTimeFilter('date')}
          className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
            timeFilter === 'date'
              ? 'bg-emerald-950/70 border-emerald-500/60 ring-1 ring-emerald-500/40'
              : 'bg-white/4 border-white/8 hover:bg-white/7'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-emerald-400 mb-1">
            <span>{isTodaySelected ? "Today's Income" : `Income on ${selectedDate}`}</span>
            <span className="text-slate-400 font-normal">
              {dateTickets.length} client{dateTickets.length !== 1 ? 's' : ''} · {dateTotalItems} item{dateTotalItems !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-300 tracking-tight">
            {peso(dateTotalPesos)}
          </div>
        </div>

        {/* Quick Month & All-Time Overview Pills */}
        <div className="grid grid-cols-2 gap-2">
          {/* This Month Card */}
          <div
            onClick={() => setTimeFilter('month')}
            className={`cursor-pointer rounded-xl p-2.5 border transition-all ${
              timeFilter === 'month'
                ? 'bg-violet-950/70 border-violet-500/60 ring-1 ring-violet-500/40'
                : 'bg-white/4 border-white/8 hover:bg-white/7'
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-violet-400 mb-0.5">
              This Month
            </div>
            <div className="text-lg font-black text-white">{peso(monthTotalPesos)}</div>
            <div className="text-[10px] text-slate-400">{monthTickets.length} finished</div>
          </div>

          {/* All Time Card */}
          <div
            onClick={() => setTimeFilter('all')}
            className={`cursor-pointer rounded-xl p-2.5 border transition-all ${
              timeFilter === 'all'
                ? 'bg-blue-950/70 border-blue-500/60 ring-1 ring-blue-500/40'
                : 'bg-white/4 border-white/8 hover:bg-white/7'
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-0.5">
              All Time
            </div>
            <div className="text-lg font-black text-white">{peso(allTimeTotalPesos)}</div>
            <div className="text-[10px] text-slate-400">{finishedTickets.length} finished</div>
          </div>
        </div>
      </div>

      {/* Confirmation prompt for Reset Numbering */}
      {showResetConfirm && (
        <div className="rounded-xl border border-red-800/60 bg-red-950/50 p-3.5 space-y-2.5 shadow-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-200 leading-relaxed">
              <p className="font-bold text-red-300 mb-0.5">Reset Ticket Numbers to #1?</p>
              This will remove completed/cancelled test records from history and start new ticket numbers back from #1.
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleResetNumbering}
              disabled={resetting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold transition-colors"
            >
              <Trash2 size={13} />
              {resetting ? 'Resetting…' : 'Yes, Reset to #1'}
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 py-2 rounded-lg bg-white/8 hover:bg-white/15 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filtered list section header */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1">
        <span className="font-bold uppercase tracking-wider">
          {timeFilter === 'date'
            ? isTodaySelected
              ? `Today's Orders (${history.length})`
              : `Orders for ${selectedDate} (${history.length})`
            : timeFilter === 'month'
            ? `This Month's Orders (${history.length})`
            : `All Orders (${history.length})`}
        </span>
        <span className="font-semibold text-emerald-400">
          {timeFilter === 'date'
            ? peso(dateTotalPesos)
            : timeFilter === 'month'
            ? peso(monthTotalPesos)
            : peso(allTimeTotalPesos)}
        </span>
      </div>

      {history.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm py-12 text-center bg-white/2 rounded-xl border border-white/5">
          No records found for{' '}
          {timeFilter === 'date'
            ? isTodaySelected
              ? 'today'
              : selectedDate
            : timeFilter === 'month'
            ? 'this month'
            : 'this period'}
          .
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((t) => {
            const myItems = ticketItems(items, t.id);
            const total = calcTotal(myItems);
            const isExpanded = expandedId === t.id;
            const doneAt = t.finishedAt ?? t.cancelledAt ?? t.createdAt;

            return (
              <div
                key={t.id}
                className="rounded-xl border border-white/8 bg-white/3 overflow-hidden"
              >
                <button
                  className="w-full text-left px-3 py-3 flex items-center gap-2"
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                >
                  <span className="text-slate-500 font-mono text-xs">#{t.ticketNumber}</span>
                  <span className="font-medium text-sm text-white flex-1 truncate">{t.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${statusColor(t.status)}`}>
                    {t.status}
                  </span>
                  {isExpanded ? (
                    <ChevronUp size={14} className="text-slate-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown size={14} className="text-slate-500 flex-shrink-0" />
                  )}
                </button>

                <div className="px-3 pb-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{formatDate(doneAt)} {formatTime(doneAt)}</span>
                  {myItems.length > 0 && (
                    <span className={`font-semibold ${t.status === 'finished' ? 'text-emerald-400' : 'text-slate-500 line-through'}`}>
                      {peso(total)}
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-white/8 px-3 py-3 space-y-2">
                    {myItems.length === 0 ? (
                      <p className="text-slate-600 text-xs">No items recorded.</p>
                    ) : (
                      myItems.map((item) => {
                        const lt = (item.basePrice + item.upgradePrice) * item.quantity;
                        return (
                          <div key={item.id} className="flex justify-between text-xs text-slate-400">
                            <span>
                              {item.memberLabel ? `${item.memberLabel} · ` : ''}
                              {item.placementName === 'Jewelry' ? formatJewelryName(item.upgradeLabel) : item.placementName}
                              {item.placementName !== 'Jewelry' && item.upgradePrice > 0 ? ` + ${formatJewelryName(item.upgradeLabel)}` : ''}
                              {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                            </span>
                            <span className="text-slate-300 font-semibold">{peso(lt)}</span>
                          </div>
                        );
                      })
                    )}

                    {myItems.length > 0 && (
                      <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-white/8">
                        <span>Total</span>
                        <span className={t.status === 'finished' ? 'text-emerald-400' : 'text-slate-500 line-through'}>
                          {peso(total)}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      {reopenConfirm === t.id ? (
                        <>
                          <p className="text-xs text-amber-400 flex-1">Reopen this ticket?</p>
                          <button
                            onClick={() => handleReopen(t.id)}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                          >
                            Yes, Reopen
                          </button>
                          <button
                            onClick={() => setReopenConfirm(null)}
                            className="px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-slate-300 text-xs font-semibold"
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setReopenConfirm(t.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-slate-400 hover:text-white text-xs font-semibold transition-colors"
                        >
                          <RotateCcw size={12} />
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

      {/* Custom Calendar Picker Modal */}
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
