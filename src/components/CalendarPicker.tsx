import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Props {
  selectedDate: string; // YYYY-MM-DD
  activeDates: Set<string>; // Set of dates (YYYY-MM-DD) that have orders
  onSelectDate: (dateStr: string) => void;
  onClose: () => void;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function CalendarPickerModal({ selectedDate, activeDates, onSelectDate, onClose }: Props) {
  const [selY, selM] = selectedDate.split('-').map(Number);
  const [viewYear, setViewYear] = useState<number>(selY || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(selM ? selM - 1 : new Date().getMonth()); // 0-indexed

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // Month navigation
  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  // Days in month calculation
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun, 1 = Mon ...
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs bg-[#131620] border border-white/15 rounded-2xl shadow-2xl p-4 text-white space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Month & Year + Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg bg-white/6 hover:bg-white/12 active:scale-95 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-white px-2">
              {monthNames[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg bg-white/6 hover:bg-white/12 active:scale-95 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Day of week headers */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400">
          {daysOfWeek.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Previous month filler days */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => {
            const dayNum = daysInPrevMonth - firstDayOfWeek + 1 + i;
            return (
              <div
                key={`prev-${i}`}
                className="h-8 flex items-center justify-center text-xs text-slate-600 select-none"
              >
                {dayNum}
              </div>
            );
          })}

          {/* Current month days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(dayNum)}`;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;
            const hasOrders = activeDates.has(dateStr);

            return (
              <button
                key={`day-${dayNum}`}
                type="button"
                onClick={() => {
                  onSelectDate(dateStr);
                  onClose();
                }}
                className={`relative h-8 rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-900/50 scale-105 z-10'
                    : isToday
                    ? 'bg-violet-950/70 border border-violet-500/60 text-violet-200 hover:bg-violet-900/80'
                    : 'hover:bg-white/10 text-slate-200'
                }`}
              >
                <span>{dayNum}</span>
                {/* Dot indicator if day has orders */}
                {hasOrders && !isSelected && (
                  <span className="w-1 h-1 rounded-full bg-emerald-400 absolute bottom-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer shortcuts */}
        <div className="pt-2 border-t border-white/8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onSelectDate(todayStr);
              onClose();
            }}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 py-1 px-2 rounded-md hover:bg-emerald-950/40 transition-colors cursor-pointer"
          >
            Select Today
          </button>
          <span className="text-[10px] text-slate-500">
            • Dot indicates order activity
          </span>
        </div>
      </div>
    </div>
  );
}
