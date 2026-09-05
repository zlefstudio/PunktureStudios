import Dexie, { type Table } from 'dexie';
import type { Ticket, PiercingItem, PublicSettings } from './types';

/** Key → number store used for atomic counters (ticket numbering, queue tokens). */
export interface MetaCounter {
  key: string;
  value: number;
}

class PiercingDB extends Dexie {
  tickets!: Table<Ticket, string>;
  items!: Table<PiercingItem, string>;
  meta!: Table<MetaCounter, string>;
  settings!: Table<PublicSettings, string>;

  constructor() {
    super('PiercingQueueDB');

    // v1 — original schema (kept so older installs upgrade cleanly).
    this.version(1).stores({
      tickets: 'id, ticketNumber, status, createdAt',
      items: 'id, ticketId',
    });

    // v2 — adds the `meta` counter table (atomic ticket numbering) plus
    // sync-ready `updatedAt` / `archivedAt` fields and indexes. Existing
    // rows are backfilled here; store.loadAll also backfills defensively.
    this.version(2)
      .stores({
        tickets: 'id, ticketNumber, status, createdAt, updatedAt, finishedAt, cancelledAt, archivedAt',
        items: 'id, ticketId, createdAt, updatedAt',
        meta: 'key',
      })
      .upgrade(async (tx) => {
        const ts = Date.now();
        await tx
          .table('tickets')
          .toCollection()
          .modify((t: Ticket) => {
            if (typeof t.updatedAt !== 'number') {
              t.updatedAt = typeof t.createdAt === 'number' ? t.createdAt : ts;
            }
          });
        await tx
          .table('items')
          .toCollection()
          .modify((i: PiercingItem) => {
            if (typeof i.updatedAt !== 'number') {
              i.updatedAt = typeof i.createdAt === 'number' ? i.createdAt : ts;
            }
          });
      });

    // v3 — adds the `settings` table (public page / event preferences) so the
    // Public tab works offline and syncs to the cloud like tickets do.
    this.version(3).stores({
      tickets: 'id, ticketNumber, status, createdAt, updatedAt, finishedAt, cancelledAt, archivedAt',
      items: 'id, ticketId, createdAt, updatedAt',
      meta: 'key',
      settings: 'key',
    });
  }
}

export const db = new PiercingDB();

/**
 * Atomically allocates the next ticket number inside a single read-write
 * transaction so two rapid saves can never issue the same number. When no
 * counter row exists yet (brand-new database) it falls back to scanning the
 * highest existing ticketNumber.
 */
export async function allocateTicketNumber(): Promise<number> {
  return db.transaction('rw', db.meta, db.tickets, async () => {
    const rec = await db.meta.get('ticketCounter');
    const highest = rec?.value ?? (await db.tickets.orderBy('ticketNumber').last())?.ticketNumber ?? 0;
    const next = highest + 1;
    await db.meta.put({ key: 'ticketCounter', value: next });
    return next;
  });
}

/** Overwrites the ticket counter (used after backup import / "Reset #1"). */
export async function setTicketCounter(value: number): Promise<void> {
  await db.meta.put({ key: 'ticketCounter', value });
}

// ── Sync tombstones ────────────────────────────────────────────────────────
// Local item deletions are recorded here so the next sync can remove the
// remote copy too. Without a tombstone, the pull step would re-import the
// item from the cloud and the deletion would silently "come back".
const ITEM_DELETE_PREFIX = 'itemDel:';

/** Remember that these local item ids were deleted (offline-safe). */
export async function recordItemDeletions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const ts = Date.now();
  await db.transaction('rw', db.meta, async () => {
    for (const id of ids) await db.meta.put({ key: ITEM_DELETE_PREFIX + id, value: ts });
  });
}

/** id → deletion time for every locally deleted, not-yet-synced item. */
export async function listItemDeletions(): Promise<Map<string, number>> {
  const rows = await db.meta.toArray();
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.key.startsWith(ITEM_DELETE_PREFIX)) {
      out.set(r.key.slice(ITEM_DELETE_PREFIX.length), r.value);
    }
  }
  return out;
}

/** Forget tombstones that have already been applied to the cloud. */
export async function clearItemDeletions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.transaction('rw', db.meta, async () => {
    for (const id of ids) await db.meta.delete(ITEM_DELETE_PREFIX + id);
  });
}
