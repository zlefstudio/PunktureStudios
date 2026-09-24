import { db } from './db';
import { sortWaiting } from './queue';
export const manilaDay = (now: number) => Math.floor((now + 8 * 3600000) / 86400000);
/** Caller holds withDataLock. History is retained; live tickets keep serving order. */
export async function rolloverQueueDay(now = Date.now()): Promise<boolean> {
  return db.transaction('rw', db.tickets, db.meta, async () => {
    const today = manilaDay(now);
    const marker = await db.meta.get('queueDay');
    const tickets = await db.tickets.toArray();
    const previous = marker?.value ?? (tickets.length ? manilaDay(Math.max(...tickets.map(t => t.createdAt))) : today);
    if (previous >= today) {
      if (!marker) await db.meta.put({ key: 'queueDay', value: today });
      return false;
    }
    const live = tickets.filter(t => typeof t.archivedAt !== 'number');
    const ordered = [...live.filter(t => t.status === 'called' || t.status === 'in_progress'), ...sortWaiting(live)];
    const stamp = Math.max(now, ...tickets.map(t => (t.updatedAt || 0) + 1));
    for (const t of live) {
      if (t.status === 'finished' || t.status === 'cancelled') await db.tickets.update(t.id, { archivedAt: stamp, updatedAt: stamp });
    }
    for (const [i, t] of ordered.entries()) await db.tickets.update(t.id, { ticketNumber: i + 1, updatedAt: stamp });
    await db.meta.put({ key: 'ticketCounter', value: ordered.length });
    await db.meta.put({ key: 'queueDay', value: today });
    return true;
  });
}
