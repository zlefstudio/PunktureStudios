import type { BackupPayload, PiercingItem, PublicSettings, Ticket } from './types';

const statuses = ['waiting', 'called', 'in_progress', 'finished', 'cancelled'];
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max = 2000, required = false): asserts value is string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Invalid ${label}.`);
}
function number(value: unknown, label: string, min = 0, integer = false): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || (integer && !Number.isSafeInteger(value))) throw new Error(`Invalid ${label}.`);
}
function id(value: unknown) {
  text(value, 'record ID', 128, true);
  if (value.includes('/') || value === '.' || value === '..') throw new Error('Invalid record ID.');
}
function timestamp(value: unknown, label: string) {
  number(value, label, 0, true);
  if (value > 8640000000000000) throw new Error(`Invalid ${label}.`);
}
export function validateTicket(value: unknown): Ticket {
  const t = object(value);
  id(t.id); text(t.name, 'client name', 200, true);
  number(t.ticketNumber, 'ticket number', 1, true);
  if (typeof t.status !== 'string' || !statuses.includes(t.status)) throw new Error('Invalid ticket status.');
  timestamp(t.createdAt, 'creation time');
  for (const key of ['updatedAt', 'archivedAt', 'calledAt', 'startedAt', 'finishedAt', 'cancelledAt']) {
    if (t[key] !== undefined) timestamp(t[key], key);
  }
  if (t.queueOrder !== undefined) number(t.queueOrder, 'queue order', -Number.MAX_SAFE_INTEGER, true);
  if (t.notes !== undefined) text(t.notes, 'notes');
  if (typeof t.archivedAt === 'number' && !['finished', 'cancelled'].includes(t.status)) throw new Error('Only closed tickets may be archived.');
  return pick({ ...t, updatedAt: t.updatedAt ?? t.createdAt }, ['id', 'ticketNumber', 'name', 'status', 'notes', 'createdAt', 'updatedAt', 'archivedAt', 'queueOrder', 'calledAt', 'startedAt', 'finishedAt', 'cancelledAt']) as unknown as Ticket;
}
export function validateItem(value: unknown): PiercingItem {
  const i = object(value);
  id(i.id); id(i.ticketId);
  text(i.placementName, 'placement', 200, true); text(i.upgradeLabel, 'upgrade', 200);
  if (i.memberLabel !== undefined) text(i.memberLabel, 'member', 200);
  number(i.basePrice, 'base price'); number(i.upgradePrice, 'upgrade price');
  number(i.quantity, 'quantity', 1, true); timestamp(i.createdAt, 'creation time');
  if (!Number.isFinite(((i.basePrice as number) + (i.upgradePrice as number)) * (i.quantity as number))) throw new Error('Line total is too large.');
  if (i.updatedAt !== undefined) timestamp(i.updatedAt, 'update time');
  return pick({ ...i, updatedAt: i.updatedAt ?? i.createdAt }, ['id', 'ticketId', 'memberLabel', 'placementName', 'basePrice', 'upgradeLabel', 'upgradePrice', 'quantity', 'createdAt', 'updatedAt']) as unknown as PiercingItem;
}
export function validateSettings(value: unknown): PublicSettings {
  const s = object(value);
  if (s.key !== 'public' || typeof s.eventActive !== 'boolean') throw new Error('Invalid public settings.');
  timestamp(s.updatedAt, 'settings timestamp');
  for (const key of ['eventDate', 'eventLocation', 'eventMapUrl', 'eventTitle', 'eventHours', 'studioName', 'studioAddress', 'studioMapUrl']) {
    if (s[key] !== undefined) text(s[key], key);
  }
  for (const key of ['eventMapUrl', 'studioMapUrl']) {
    if (s[key] && !safeHttpUrl(String(s[key]))) throw new Error('Map links must use https:// or http://.');
  }
  if (s.eventDate) {
    const date = String(s.eventDate);
    const epoch = Date.parse(date + 'T12:00:00+08:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(epoch) || manilaDate(epoch) !== date) throw new Error('Invalid event date.');
  }
  if (s.events !== undefined) {
    if (!Array.isArray(s.events) || s.events.length > 12) throw new Error('Keep up to 12 pop-up events.');
    const ranges = s.events.map(entry => object(entry)).sort((a,b) => String(a.eventDate).localeCompare(String(b.eventDate)));
    for (let i = 1; i < ranges.length; i++) {
      if (String(ranges[i].eventDate) <= String(ranges[i-1].eventEndDate || ranges[i-1].eventDate)) throw new Error('Pop-up dates overlap. Only one venue is allowed per day.');
    }
    const ids = new Set();
    for (const entry of s.events) {
      const e = object(entry);
      text(e.id, 'event ID', 128, true);
      if (ids.has(e.id)) throw new Error('Duplicate event ID.');
      ids.add(e.id);
      if (Object.keys(e).some(k => !['id','eventDate','eventEndDate','eventTitle','eventHours','eventLocation','eventMapUrl','eventActive'].includes(k))) throw new Error('Invalid event fields.');
      for (const k of ['eventDate','eventTitle','eventHours','eventLocation','eventMapUrl']) if (typeof e[k] !== 'string') throw new Error('Incomplete event.');
      if (!e.eventDate || !String(e.eventTitle).trim() || !String(e.eventLocation).trim()) throw new Error('Each event needs a date, title, and venue.');
      validateSettings({ ...e, key: 'public', updatedAt: s.updatedAt });
      if (e.eventEndDate !== undefined) {
        validateSettings({key:'public',eventActive:false,updatedAt:s.updatedAt,eventDate:e.eventEndDate});
        if (typeof e.eventEndDate !== 'string' || e.eventEndDate < String(e.eventDate)) throw new Error('End date must be on or after the start date.');
      }
    }
  }
  return pick(s, [
    'events',
    'key',
    'eventActive',
    'updatedAt',
    'eventDate',
    'eventLocation',
    'eventMapUrl',
    'eventTitle',
    'eventHours',
    'studioName',
    'studioAddress',
    'studioMapUrl',
    'bookingEnabled',
    'bookingDays',
    'bookingSlots',
    'blockedDates',
    'bookingNoticeDays',
  ]) as unknown as PublicSettings;
}
function pick(value: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  return Object.fromEntries(fields.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
}
export function validateBackup(value: unknown): BackupPayload {
  const b = object(value);
  if (b.schemaVersion !== 1 && b.schemaVersion !== 2) throw new Error('Unsupported backup version.');
  if (typeof b.exportedAt !== 'string' || !Number.isFinite(Date.parse(b.exportedAt))) throw new Error('Invalid export date.');
  if (!Array.isArray(b.tickets) || !Array.isArray(b.items)) throw new Error('Backup must contain tickets and items.');
  const tickets = b.tickets.map(validateTicket);
  const items = b.items.map(validateItem);
  const ids = new Set(tickets.map(t => t.id));
  if (ids.size !== tickets.length || new Set(items.map(i => i.id)).size !== items.length) throw new Error('Duplicate record IDs.');
  if (items.some(i => !ids.has(i.ticketId))) throw new Error('An item refers to a missing ticket.');
  if (tickets.filter(t => t.status === 'called' || t.status === 'in_progress').length > 1) throw new Error('Backup has multiple active sessions. Finish or cancel extra sessions before exporting.');
  const active = tickets.filter(t => typeof t.archivedAt !== 'number');
  if (new Set(active.map(t => t.ticketNumber)).size !== active.length) throw new Error('Duplicate unarchived ticket numbers.');
  const highest = active.reduce((max, t) => Math.max(max, t.ticketNumber), 0);
  const ticketCounter = b.schemaVersion === 2 ? b.ticketCounter : highest;
  number(ticketCounter, 'ticket counter', highest, true);
  const settings = b.settings == null ? null : validateSettings(b.settings);
  return { schemaVersion: 2, exportedAt: b.exportedAt, tickets, items, ticketCounter, settings };
}
export function safeHttpUrl(value?: string): string | undefined {
  try { const u = new URL(value ?? ''); return ['https:', 'http:'].includes(u.protocol) ? u.href : undefined; } catch { return undefined; }
}
export function csvCell(value: string | number | undefined): string {
  let s = String(value ?? '');
  if (typeof value !== 'number' && /^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function manilaDate(now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function validAppointmentDate(date: string, time: string, now = Date.now()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false;
  const epoch = Date.parse(`${date}T${time}:00+08:00`);
  return Number.isFinite(epoch) && manilaDate(epoch) === date && epoch > now && epoch < now + 31622400000;
}
