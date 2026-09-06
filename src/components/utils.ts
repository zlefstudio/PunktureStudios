import type { Ticket, PiercingItem } from '../types';
import { sortWaiting } from '../queue';

export function formatTime(epoch: number): string {
  return new Date(epoch).toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(epoch: number): string {
  return new Date(epoch).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ticketItems(items: PiercingItem[], ticketId: string): PiercingItem[] {
  return items.filter((i) => i.ticketId === ticketId);
}

export function calcTotal(items: PiercingItem[]): number {
  return items.reduce((s, i) => s + (i.basePrice + i.upgradePrice) * i.quantity, 0);
}

export function peso(n: number): string {
  return `₱${n}`;
}

export function waitingPosition(tickets: Ticket[], id: string): number {
  const sorted = sortWaiting(tickets);
  return sorted.findIndex((t) => t.id === id) + 1;
}

export function statusLabel(status: Ticket['status']): string {
  switch (status) {
    case 'waiting':     return 'Waiting';
    case 'called':      return 'Called';
    case 'in_progress': return 'In Progress';
    case 'finished':    return 'Finished';
    case 'cancelled':   return 'Cancelled';
  }
}

/**
 * Returns an inline-style object for the status badge.
 * Used with the `.status-badge` CSS class in index.css.
 */
export function statusColor(status: Ticket['status']): React.CSSProperties {
  switch (status) {
    case 'waiting':
      return { color: 'var(--color-status-waiting-text)', background: 'var(--color-status-waiting-bg)' };
    case 'called':
      return { color: 'var(--color-status-called-text)',  background: 'var(--color-status-called-bg)' };
    case 'in_progress':
      return { color: 'var(--color-status-active-text)',  background: 'var(--color-status-active-bg)' };
    case 'finished':
      return { color: 'var(--color-status-done-text)',    background: 'var(--color-status-done-bg)' };
    case 'cancelled':
      return { color: 'var(--color-status-cancelled-text)', background: 'var(--color-status-cancelled-bg)' };
  }
}

/**
 * Returns the CSS custom-property value for the status border color.
 * Use directly as a border-color string.
 */
export function statusBorder(status: Ticket['status']): string {
  switch (status) {
    case 'waiting':     return 'rgba(37,99,235,0.28)';
    case 'called':      return 'rgba(217,119,6,0.35)';
    case 'in_progress': return 'rgba(109,40,217,0.40)';
    case 'finished':    return 'rgba(5,150,105,0.28)';
    case 'cancelled':   return 'rgba(185,28,28,0.28)';
  }
}

export function copyCallMessage(name: string): void {
  const msg = `Hi ${name}, you're next at the piercing station.`;
  navigator.clipboard.writeText(msg).catch(() => {
    // fallback: show msg (handled by caller)
  });
}

export function formatJewelryName(label: string): string {
  if (!label || label === 'Free') return '';
  let clean = label.trim();

  // Strip leading price numbers or symbols like "150 ", "200 ", "+50 "
  clean = clean.replace(/^(\+?\d+\s*)/, '');

  // If this is the +50 jewelry upgrade, display just "Jewelry"
  if (label.includes('+50')) {
    clean = 'Jewelry';
  } else {
    // Ensure Titanium is present for gold / silver / general upgrades
    if (clean.toLowerCase().includes('gold') && !clean.toLowerCase().includes('titanium')) {
      clean = clean.replace(/gold/i, 'Gold Titanium');
    } else if (clean.toLowerCase().includes('silver') && !clean.toLowerCase().includes('titanium')) {
      clean = clean.replace(/silver/i, 'Silver Titanium');
    } else if (clean.toLowerCase() === 'jewelry') {
      // For 150 or 200 upgrades, keep Titanium Jewelry
      clean = 'Titanium Jewelry';
    }
  }

  // Ensure Jewelry word is present (unless already exactly "Jewelry")
  if (clean.toLowerCase() !== 'jewelry' && !clean.toLowerCase().includes('jewelry')) {
    clean = `${clean} Jewelry`;
  }

  return clean;
}

export function buildBreakdownText(ticket: Ticket, items: PiercingItem[]): string {
  const header = `${ticket.name} (#${ticket.ticketNumber})`;
  const lines = items.map((item) => {
    const member  = item.memberLabel ? `${item.memberLabel} - ` : '';
    const upgrade = item.upgradePrice === 0 ? 'Free' : formatJewelryName(item.upgradeLabel);
    const total   = (item.basePrice + item.upgradePrice) * item.quantity;
    return `- ${member}${item.placementName} - ${item.basePrice} + ${upgrade} x${item.quantity} = ${total}`;
  });
  const total = calcTotal(items);
  return [header, ...lines, `TOTAL: ${total}`].join('\n');
}
