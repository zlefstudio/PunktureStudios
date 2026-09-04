import type { Ticket } from './types';

/**
 * Waiting queue ordering helpers.
 *
 * Every waiting ticket carries a small, monotonic `queueOrder` token
 * (0 = front of the line). Older records created before reordering existed
 * may lack the field — for those we fall back to their `createdAt`.
 */

function queueKey(t: Ticket): number {
  return t.queueOrder ?? t.createdAt;
}

/** Waiting tickets in serving order (front of the line first). */
export function sortWaiting(tickets: Ticket[]): Ticket[] {
  return tickets
    .filter((t) => t.status === 'waiting')
    .sort(
      (a, b) =>
        queueKey(a) - queueKey(b) ||
        a.createdAt - b.createdAt ||
        (a.id < b.id ? -1 : 1)
    );
}

/** Smallest queueOrder token greater than every current waiting ticket. */
export function nextWaitingToken(tickets: Ticket[]): number {
  let max = -1;
  for (const t of tickets) {
    if (t.status === 'waiting') {
      const k = queueKey(t);
      if (k > max) max = k;
    }
  }
  return max + 1;
}
