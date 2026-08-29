import type { Ticket, PiercingItem } from '../types';

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
  const sorted = tickets
    .filter((t) => t.status === 'waiting')
    .sort((a, b) => a.createdAt - b.createdAt);
  return sorted.findIndex((t) => t.id === id) + 1;
}

export function statusLabel(status: Ticket['status']): string {
  switch (status) {
    case 'waiting': return 'Waiting';
    case 'called': return 'Called';
    case 'in_progress': return 'In Progress';
    case 'finished': return 'Finished';
    case 'cancelled': return 'Cancelled';
  }
}

export function statusColor(status: Ticket['status']): string {
  switch (status) {
    case 'waiting': return 'text-blue-400 bg-blue-950/50';
    case 'called': return 'text-amber-400 bg-amber-950/50';
    case 'in_progress': return 'text-violet-400 bg-violet-950/50';
    case 'finished': return 'text-emerald-400 bg-emerald-950/50';
    case 'cancelled': return 'text-red-400 bg-red-950/50';
  }
}

export function statusBorder(status: Ticket['status']): string {
  switch (status) {
    case 'waiting': return 'border-blue-800/50';
    case 'called': return 'border-amber-700/60';
    case 'in_progress': return 'border-violet-700/60';
    case 'finished': return 'border-emerald-800/50';
    case 'cancelled': return 'border-red-800/50';
  }
}

export function copyCallMessage(name: string): void {
  const msg = `Hi ${name}, next na po kayo sa piercing station.`;
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
    const member = item.memberLabel ? `${item.memberLabel} - ` : '';
    const upgrade = item.upgradePrice === 0 ? 'Free' : formatJewelryName(item.upgradeLabel);
    const total = (item.basePrice + item.upgradePrice) * item.quantity;
    return `- ${member}${item.placementName} - ${item.basePrice} + ${upgrade} x${item.quantity} = ${total}`;
  });
  const total = calcTotal(items);
  return [header, ...lines, `TOTAL: ${total}`].join('\n');
}
