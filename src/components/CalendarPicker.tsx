import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Props {
  selectedDate: string; // YYYY-MM-DD
  activeDates: Set<string>;
  onSelectDate: (dateStr: string) => void;
  onClose: () => void;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function CalendarPickerModal({
  selectedDate,
  activeDates,
  onSelectDate,
  onClose,
}: Props) {
  const [selY, selM] = selectedDate.split('-').map(Number);
  const [viewYear,  setViewYear]  = useState<number>(selY || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(selM ? selM - 1 : new Date().getMonth());

  const today    = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  }

  const firstDayOfWeek  = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth     = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const navBtnStyle: React.CSSProperties = {
    padding: '6px',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-4 space-y-4"
        style={{
          background: 'var(--color-overlay)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-lg)',
          color: 'var(--color-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header: month navigation ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button type="button" onClick={prevMonth} style={navBtnStyle} title="Previous Month">
              <ChevronLeft size={16} />
            </button>
            <span
              className="font-bold px-2"
              style={{ fontSize: '14px', color: 'var(--color-text)' }}
            >
              {monthNames[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} style={navBtnStyle} title="Next Month">
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ ...navBtnStyle, background: 'transparent', border: '1px solid transparent' }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Day-of-week headers ── */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {daysOfWeek.map((d) => (
            <div key={d} className="py-1 text-label-xs" style={{ color: 'var(--color-text-faint)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* ── Days grid ── */}
        <div className="grid grid-cols-7 gap-1">
          {/* Prev-month filler */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div
              key={`prev-${i}`}
              className="h-8 flex items-center justify-center text-body-xs select-none"
              style={{ color: 'var(--color-text-faint)', opacity: 0.4 }}
            >
              {daysInPrevMonth - firstDayOfWeek + 1 + i}
            </div>
          ))}

          {/* Current-month days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum    = i + 1;
            const dateStr   = `${viewYear}-${pad(viewMonth + 1)}-${pad(dayNum)}`;
            const isSelected = dateStr === selectedDate;
            const isToday   = dateStr === todayStr;
            const hasOrders = activeDates.has(dateStr);

            let dayStyle: React.CSSProperties;
            if (isSelected) {
              dayStyle = {
                background: 'var(--color-success)',
                color: '#fff',
                boxShadow: '0 2px 8px rgba(5,150,105,0.35)',
                transform: 'scale(1.08)',
                zIndex: 1,
              };
            } else if (isToday) {
              dayStyle = {
                background: 'var(--color-brand-subtle)',
                border: '1px solid var(--color-brand)',
                color: 'var(--color-brand-text)',
              };
            } else {
              dayStyle = {
                background: 'transparent',
                color: 'var(--color-text-muted)',
              };
            }

            return (
              <button
                key={`day-${dayNum}`}
                type="button"
                onClick={() => { onSelectDate(dateStr); onClose(); }}
                className="relative h-8 rounded-lg font-semibold flex flex-col items-center justify-center"
                style={dayStyle}
              >
                <span style={{ fontSize: '12px' }}>{dayNum}</span>
                {hasOrders && !isSelected && (
                  <span
                    className="absolute bottom-1 w-1 h-1 rounded-full"
                    style={{ background: 'var(--color-success-text)' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div
          className="pt-2 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button
            type="button"
            onClick={() => { onSelectDate(todayStr); onClose(); }}
            className="text-body-xs font-bold py-1 px-2 rounded-md"
            style={{
              color: 'var(--color-success-text)',
              background: 'transparent',
              border: 'none',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--color-success-bg)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            Select Today
          </button>
          <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
            • Orders marked
          </span>
        </div>
      </div>
    </div>
  );
}
