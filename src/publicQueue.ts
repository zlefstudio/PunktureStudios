import type { Ticket, PiercingItem, PublicQueueRow } from './types';
import { sortWaiting } from './queue';
import { getTicketDuration } from './queueEstimates';

/** Only masked nicknames ever cross the public sync boundary. */
export function maskNickname(name: string): string {
  const chars = Array.from(name.trim());
  if (chars.length < 3) return '***';
  return chars[0] + '*'.repeat(chars.length - 2) + chars[chars.length - 1];
}

/** Shared privacy boundary for cloud publishing and same-browser local preview. */
export function buildPublicQueue(tickets: Ticket[], items: PiercingItem[]): PublicQueueRow[] {
  const live = tickets.filter(t => typeof t.archivedAt !== 'number' && ['waiting', 'called', 'in_progress'].includes(t.status));
  const positions = new Map(sortWaiting(live).map((t, i) => [t.id, i]));
  return live.map(t => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    status: t.status as PublicQueueRow['status'],
    position: positions.get(t.id) ?? null,
    seq: positions.get(t.id) ?? (t.status === 'called' ? 100 : 200),
    createdAt: t.createdAt,
    calledAt: t.calledAt ?? null,
    startedAt: t.startedAt ?? null,
    updatedAt: t.updatedAt,
    maskedNickname: maskNickname(t.name),
    estimatedDurationMinutes: getTicketDuration(items.filter(i => i.ticketId === t.id)),
  }));
}
