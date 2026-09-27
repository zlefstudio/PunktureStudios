// Google Calendar events for paid bookings, created by the studio's Apps Script
// (see backend/apps-script/Code.gs). One-way: website → calendar.
import { socialProfileLink } from '../src/socialContact.ts';

/** Phone popup reminders, in minutes before the appointment (studio choice: 1 h 30 min). */
export const CALENDAR_REMINDER_MINUTES = [90];
const DEPOSIT_PESOS = 100;
const LATE_GRACE_MINUTES = 15;

const clip = (text, max) => text.length > max ? `${text.slice(0, max - 1)}…` : text;
const peso = value => `₱${value.toLocaleString('en-PH')}`;
const to12h = (time, add = 0) => {
  const total = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + add;
  const h = Math.floor(total / 60) % 24, m = total % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Item names from the cart summary written by the booking page (cartSnapshot.bookingCartNotes). */
export function cartItems(notes = '') {
  if (!/^Selected items \(\d+\):/.test(notes)) return [];
  return notes.split(/\r?\n/).map(line => /^(\d+)\. (.+)$/.exec(line)?.[2]).filter(Boolean).map(name => name.replace(' · 2×', ''));
}

export function calendarTitle(b) {
  const items = cartItems(b.notes);
  const summary = items.length
    ? items.slice(0, 2).join(', ') + (items.length > 2 ? ` +${items.length - 2}` : '')
    : b.notes?.startsWith('No items selected') ? 'Consultation' : '';
  return clip(`${b.name.replace(/[\r\n]+/g, ' ').trim()}${summary ? ` · ${summary}` : ''}`, 200);
}

export function calendarDescription(b) {
  const total = /^Total estimate: ₱([\d,.]+)$/m.exec(b.notes || '');
  const estimate = total ? Number(total[1].replaceAll(',', '')) : null;
  // Same safe link the staff app shows, so the client can be messaged straight from Calendar.
  const profile = socialProfileLink(b.contact || '');
  const lines = [
    `Deposit ₱${DEPOSIT_PESOS} paid online${b.payment_id ? ` (PayMongo ${b.payment_id})` : ''} — deduct it from the final bill.`,
    ...(estimate !== null ? [`Balance to collect ≈ ${peso(Math.max(0, estimate - DEPOSIT_PESOS))} (cart estimate ${peso(estimate)}; confirm at the studio).`] : []),
    `Late fee applies from ${to12h(b.time, LATE_GRACE_MINUTES)} (${LATE_GRACE_MINUTES} min after the start).`,
    '',
    clip(b.notes || 'No details provided.', 3000),
    '',
    `Social media / contact: ${b.contact}`,
    ...(profile ? [`${profile.label}: ${profile.href}`] : []),
    `Email: ${b.email}`,
    `Booking ID: ${b.id}`,
    'Added automatically by the Punkture booking system. Editing this event does not change the booking.',
  ];
  // Stays well inside the Apps Script request limit even after double JSON escaping.
  return clip(lines.join('\n'), 4000);
}

/** Signed Apps Script request. The booking's current status decides the action. */
export function calendarMessage(b, job, minutes) {
  return {
    id: job.id, type: 'calendar', action: b.status === 'confirmed' ? 'upsert' : 'remove',
    bookingId: b.id, date: b.date, time: b.time, minutes,
    title: calendarTitle(b), description: calendarDescription(b), reminders: CALENDAR_REMINDER_MINUTES,
  };
}
