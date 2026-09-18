import { useState } from 'react';
import type { PublicSettings } from '../../types';
import { DEFAULT_DAYS, format12Hour, slotEndTime, slotsForDay, slotsOverlap } from '../../schedule';
import { editableEvents } from '../../popupEvents';

/** Exceptions only: changing one date never rewrites the recurring week. */
export function DateAvailabilityEditor({ settings, onChange }: {
  settings: PublicSettings;
  onChange: (patch: Pick<PublicSettings, 'blockedDates' | 'blockedDateSlots'>) => void;
}) {
  const [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()));
  const day = new Date(`${date}T12:00:00+08:00`).getUTCDay();
  const closed = (settings.blockedDates ?? []).includes(date);
  const weeklyClosed = !(settings.bookingDays ?? DEFAULT_DAYS).includes(day);
  const popup = editableEvents(settings).some(e => e.eventActive && e.eventDate <= date && (e.eventEndDate || e.eventDate) >= date);
  const blocked = settings.blockedDateSlots?.[date] ?? [];
  const slots = weeklyClosed ? [] : slotsForDay(settings, day);
  const exceptions = [...new Set([
    ...(settings.blockedDates ?? []),
    ...Object.keys(settings.blockedDateSlots ?? {}).filter(key => settings.blockedDateSlots![key].length),
  ])].sort();

  function setBlocks(next: string[]) {
    const map = { ...settings.blockedDateSlots };
    if (next.length) map[date] = [...new Set(next)].sort();
    else delete map[date];
    onChange({ blockedDateSlots: map });
  }

  function restore(dateKey: string) {
    const map = { ...settings.blockedDateSlots };
    delete map[dateKey];
    onChange({ blockedDates: (settings.blockedDates ?? []).filter(d => d !== dateKey), blockedDateSlots: map });
  }

  return (
    <div className="space-y-3 pt-4 border-t border-zinc-800" aria-label="Date availability">
      <div>
        <h3 className="text-sm font-bold text-white">Time off on a specific date</h3>
        <p className="text-body-xs text-zinc-400 mt-1">Pick a date, then tap times to block or reopen them. Only this date changes. Save changes to publish.</p>
      </div>
      <label className="block text-body-xs text-zinc-300">
        Date to adjust (Manila)
        <input type="date" aria-label="Date to adjust" value={date} onChange={e => setDate(e.target.value)}
          className="block mt-2 p-2.5 rounded-xl text-white bg-zinc-800 border border-zinc-700 max-w-full" />
      </label>
      {date && <>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={closed} onClick={() => onChange({ blockedDates: closed
            ? (settings.blockedDates ?? []).filter(d => d !== date)
            : [...(settings.blockedDates ?? []), date].sort() })}
            className={`px-3 py-2 rounded-xl text-body-xs font-bold border ${closed ? 'bg-red-950/40 border-red-700 text-red-200' : 'bg-zinc-800 border-zinc-700 text-white'}`}>
            {closed ? 'Reopen date' : 'Block whole date'}
          </button>
          {blocked.length > 0 && <button type="button" onClick={() => setBlocks([])} className="px-3 py-2 rounded-xl text-body-xs text-violet-300 border border-zinc-700">Clear time blocks</button>}
        </div>
        {closed || popup || !slots.length ? (
          <p className="text-body-xs text-amber-200">{closed ? 'This whole date is blocked. Reopen it to adjust individual times.'
            : popup ? 'A published pop-up closes the studio on this date. Adjust that event in Pop-ups & studio to reopen it.'
            : 'Closed in your weekly schedule. Enable this weekday and add times below to make it bookable.'}</p>
        ) : <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setBlocks([...blocked, ...slots.filter(t => t < '12:00')])} className="px-3 py-2 text-body-xs rounded-xl border border-zinc-700 text-zinc-300">Block morning</button>
            <button type="button" onClick={() => setBlocks([...blocked, ...slots.filter(t => t >= '13:00')])} className="px-3 py-2 text-body-xs rounded-xl border border-zinc-700 text-zinc-300">Block afternoon</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {slots.map(slot => {
              const off = blocked.some(t => slotsOverlap(slot, t));
              return <button key={slot} type="button" aria-pressed={off}
                aria-label={`${off ? 'Reopen' : 'Block'} ${format12Hour(slot)} on ${date}`}
                onClick={() => setBlocks(off ? blocked.filter(t => !slotsOverlap(slot, t)) : [...blocked, slot])}
                className={`p-2.5 rounded-xl text-body-xs border ${off ? 'bg-red-950/40 border-red-800 text-red-200' : 'bg-emerald-950/30 border-emerald-900 text-emerald-200'}`}>
                <span className="block font-bold">{format12Hour(slot)} – {format12Hour(slotEndTime(slot))}</span>
                <span className="block mt-1">{off ? 'Blocked · tap to reopen' : 'Open · tap to block'}</span>
              </button>;
            })}
          </div>
        </>}
      </>}
      <p className="text-body-xs text-zinc-400">These controls stop new bookings. Existing bookings stay confirmed; review them in Bookings &amp; deposits. “Open” here means allowed by your schedule; paid bookings and holds are checked at checkout.</p>
      {exceptions.length > 0 && <div className="space-y-2">
        <p className="text-body-xs font-bold text-zinc-300">Your date exceptions</p>
        {exceptions.map(key => <div key={key} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-zinc-800/50">
          <button type="button" onClick={() => setDate(key)} className="text-left text-body-xs text-white">
            <span className="font-bold">{key}</span> · {(settings.blockedDates ?? []).includes(key) ? 'Whole day blocked'
              : `${settings.blockedDateSlots?.[key]?.length ?? 0} time blocks`}
          </button>
          <button type="button" aria-label={`Restore weekly schedule for ${key}`} onClick={() => restore(key)} className="text-body-xs text-violet-300 px-2 py-1">Restore weekly schedule</button>
        </div>)}
      </div>}
    </div>
  );
}
