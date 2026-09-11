import type { PublicSettings, PopupEvent } from './types';
export function editableEvents(settings: PublicSettings | null): PopupEvent[] {
  if (!settings) return [];
  if (settings.events) return settings.events;
  return settings.eventDate ? [{ id: 'legacy-event', eventDate: settings.eventDate, eventTitle: settings.eventTitle || '', eventHours: settings.eventHours || '', eventLocation: settings.eventLocation || '', eventMapUrl: settings.eventMapUrl || '', eventActive: settings.eventActive }] : [];
}
export function upcomingEvents(settings: PublicSettings | null, now = Date.now()): PopupEvent[] {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return editableEvents(settings).filter(e => e.eventActive && (e.eventEndDate || e.eventDate) >= today).sort((a,b) => a.eventDate.localeCompare(b.eventDate) || a.id.localeCompare(b.id));
}
export function nextEventSettings(settings: PublicSettings | null, now = Date.now()): PublicSettings | null {
  if (!settings) return null;
  const next = upcomingEvents(settings, now)[0];
  return next ? { ...settings, ...next } : { ...settings, eventDate: '', eventTitle: '', eventHours: '', eventLocation: '', eventMapUrl: '', eventActive: false };
}

export function eventDateRange(event: {eventDate?: string; eventEndDate?: string} | null): string {
  if (!event?.eventDate) return '';
  const format = (date: string) => new Date(date + 'T12:00:00+08:00').toLocaleDateString('en-PH', {timeZone:'Asia/Manila', month:'long', day:'numeric', year:'numeric'});
  return format(event.eventDate) + (event.eventEndDate && event.eventEndDate !== event.eventDate ? ` – ${format(event.eventEndDate)}` : '');
}
