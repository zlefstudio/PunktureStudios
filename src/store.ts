import { create } from 'zustand';
import { db, allocateTicketNumber, setTicketCounter, recordItemDeletions } from './db';
import type { Ticket, PiercingItem } from './types';
import { sortWaiting, nextWaitingToken } from './queue';

function newId(): string {
  return crypto.randomUUID();
}

function stampNow(): number {
  return Date.now();
}


interface AppState {
  tickets: Ticket[];
  items: PiercingItem[];
  activeTicketId: string | null;
  loaded: boolean;

  // Init
  loadAll: () => Promise<void>;

  // Ticket actions
  addTicket: (name: string, notes?: string) => Promise<Ticket>;
  callTicket: (id: string) => Promise<void>;
  callNext: () => Promise<void>;
  startPiercing: (id: string) => Promise<void>;
  cancelSession: (id: string) => Promise<void>;
  finishTicket: (id: string) => Promise<void>;
  cancelTicket: (id: string) => Promise<void>;
  sendToEnd: (id: string) => Promise<void>;
  moveWaitingTicket: (id: string, toIndex: number) => Promise<void>;
  updateTicketNotes: (id: string, notes: string) => Promise<void>;
  reopenTicket: (id: string) => Promise<void>;
  clearHistoryAndResetNumbering: () => Promise<void>;

  // Item actions
  addItem: (item: Omit<PiercingItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateItem: (id: string, changes: Partial<PiercingItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  deleteItemsByTicket: (ticketId: string) => Promise<void>;

  // UI
  setActiveTicket: (id: string | null) => void;

  // Backup
  exportBackup: () => { tickets: Ticket[]; items: PiercingItem[] };
  importBackup: (tickets: Ticket[], items: PiercingItem[]) => Promise<void>;
}

/**
 * One-time migration / hygiene pass: every waiting ticket gets a contiguous
 * `queueOrder` (0..n-1) so legacy rows without the field sort correctly
 * against newly created tickets. Returns the updated ticket array.
 */
async function normalizeWaitingOrder(tickets: Ticket[]): Promise<Ticket[]> {
  const waiting = sortWaiting(tickets);
  const indexById = new Map(waiting.map((t, i) => [t.id, i]));
  const changed = waiting.filter((t, i) => t.queueOrder !== i);
  if (changed.length === 0) return tickets;

  await db.tickets.bulkUpdate(
    changed.map((t) => ({
      key: t.id,
      changes: { queueOrder: indexById.get(t.id)! },
    }))
  );

  return tickets.map((t) => {
    if (t.status === 'waiting' && indexById.has(t.id)) {
      return { ...t, queueOrder: indexById.get(t.id) };
    }
    return t;
  });
}

export const useStore = create<AppState>((set, get) => ({
  tickets: [],
  items: [],
  activeTicketId: null,
  loaded: false,

  loadAll: async () => {
    let [rows, rawItems] = await Promise.all([
      db.tickets.orderBy('createdAt').toArray(),
      db.items.toArray(), // createdAt is not indexed on items; sort in memory
    ]);
    const stamp = (ts: number | undefined, fallback: number) => (typeof ts === 'number' ? ts : fallback);
    const epoch = Date.now();

    // Backfill updatedAt for legacy rows so downstream sync code can rely on it.
    let tickets = rows.map((t) => ({ ...t, updatedAt: stamp(t.updatedAt, t.createdAt) }));
    tickets = await normalizeWaitingOrder(tickets);
    const items = rawItems
      .map((i) => ({ ...i, updatedAt: stamp(i.updatedAt, i.createdAt) }))
      .sort((a, b) => a.createdAt - b.createdAt);

    // Persist the backfill once so future loads read clean rows.
    const ticketFixes = rows
      .filter((t) => typeof t.updatedAt !== 'number')
      .map((t) => ({
        key: t.id,
        changes: { updatedAt: typeof t.createdAt === 'number' ? t.createdAt : epoch },
      }));
    const itemFixes = rawItems
      .filter((i) => typeof i.updatedAt !== 'number')
      .map((i) => ({
        key: i.id,
        changes: { updatedAt: typeof i.createdAt === 'number' ? i.createdAt : epoch },
      }));
    if (ticketFixes.length > 0 || itemFixes.length > 0) {
      db.transaction('rw', db.tickets, db.items, async () => {
        if (ticketFixes.length > 0) await db.tickets.bulkUpdate(ticketFixes);
        if (itemFixes.length > 0) await db.items.bulkUpdate(itemFixes);
      }).catch(() => {});
    }

    set({ tickets, items, loaded: true });
  },

  addTicket: async (name, notes) => {
    const ticketNumber = await allocateTicketNumber();
    const created = stampNow();
    const ticket: Ticket = {
      id: newId(),
      ticketNumber,
      name: name.trim(),
      status: 'waiting',
      notes: notes?.trim() || undefined,
      createdAt: created,
      updatedAt: created,
      queueOrder: nextWaitingToken(get().tickets),
    };
    await db.tickets.add(ticket);
    set((s) => ({ tickets: [...s.tickets, ticket] }));
    return ticket;
  },

  callTicket: async (id) => {
    const ts = stampNow();
    await db.tickets.update(id, { status: 'called', calledAt: ts, updatedAt: ts });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id ? { ...t, status: 'called', calledAt: ts, updatedAt: ts } : t
      ),
    }));
  },

  callNext: async () => {
    const next = sortWaiting(get().tickets)[0];
    if (next) await get().callTicket(next.id);
  },

  startPiercing: async (id) => {
    const ts = stampNow();
    await db.tickets.update(id, { status: 'in_progress', startedAt: ts, updatedAt: ts });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id ? { ...t, status: 'in_progress', startedAt: ts, updatedAt: ts } : t
      ),
    }));
  },

  cancelSession: async (id: string) => {
    const currentWaiting = sortWaiting(get().tickets.filter((t) => t.id !== id));
    // Set queueOrder lower than any existing waiting ticket so it becomes Queue #1
    let queueOrder = 0;
    if (currentWaiting.length > 0) {
      const minKey = Math.min(...currentWaiting.map((t) => t.queueOrder ?? t.createdAt));
      queueOrder = minKey - 1;
    }
    const ts = stampNow();
    await db.tickets.update(id, {
      status: 'waiting',
      queueOrder,
      startedAt: undefined,
      calledAt: undefined,
      updatedAt: ts,
    });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id
          ? { ...t, status: 'waiting', queueOrder, startedAt: undefined, calledAt: undefined, updatedAt: ts }
          : t
      ),
    }));
  },

  finishTicket: async (id) => {
    const ts = stampNow();
    await db.tickets.update(id, { status: 'finished', finishedAt: ts, updatedAt: ts });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id ? { ...t, status: 'finished', finishedAt: ts, updatedAt: ts } : t
      ),
      activeTicketId: s.activeTicketId === id ? null : s.activeTicketId,
    }));
  },

  cancelTicket: async (id) => {
    const ts = stampNow();
    await db.tickets.update(id, { status: 'cancelled', cancelledAt: ts, updatedAt: ts });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id ? { ...t, status: 'cancelled', cancelledAt: ts, updatedAt: ts } : t
      ),
      activeTicketId: s.activeTicketId === id ? null : s.activeTicketId,
    }));
  },

  sendToEnd: async (id) => {
    const ts = stampNow();
    const queueOrder = nextWaitingToken(get().tickets);
    // Reset to waiting with new createdAt so it joins end of queue
    await db.tickets.update(id, {
      status: 'waiting',
      createdAt: ts,
      queueOrder,
      calledAt: undefined,
      startedAt: undefined,
      updatedAt: ts,
    });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id
          ? { ...t, status: 'waiting', createdAt: ts, queueOrder, calledAt: undefined, startedAt: undefined, updatedAt: ts }
          : t
      ),
    }));
  },

  moveWaitingTicket: async (id, toIndex) => {
    const { tickets } = get();
    const ordered = sortWaiting(tickets);
    const from = ordered.findIndex((t) => t.id === id);
    if (from === -1) return;
    const without = ordered.filter((t) => t.id !== id);
    const target = Math.max(0, Math.min(toIndex, without.length));
    if (target === from) return;
    const nextOrder = [...without.slice(0, target), ordered[from], ...without.slice(target)];

    const indexById = new Map(nextOrder.map((t, i) => [t.id, i]));
    const ts = stampNow();
    // Optimistic + synchronous: the UI (drag FLIP animation) reads the new
    // order immediately; the IndexedDB write happens right after.
    set((s) => ({
      tickets: s.tickets.map((t) =>
        indexById.has(t.id)
          ? { ...t, queueOrder: indexById.get(t.id), updatedAt: ts }
          : t
      ),
    }));

    await db.transaction('rw', db.tickets, async () => {
      for (let i = 0; i < nextOrder.length; i++) {
        await db.tickets.update(nextOrder[i].id, { queueOrder: i, updatedAt: ts });
      }
    });
  },

  updateTicketNotes: async (id, notes) => {
    const val = notes.trim() || undefined;
    const ts = stampNow();
    await db.tickets.update(id, { notes: val, updatedAt: ts });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id ? { ...t, notes: val, updatedAt: ts } : t
      ),
    }));
  },

  reopenTicket: async (id) => {
    const ts = stampNow();
    const queueOrder = nextWaitingToken(get().tickets);
    await db.tickets.update(id, {
      status: 'waiting',
      createdAt: ts,
      queueOrder,
      finishedAt: undefined,
      cancelledAt: undefined,
      calledAt: undefined,
      startedAt: undefined,
      archivedAt: undefined,
      updatedAt: ts,
    });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'waiting',
              createdAt: ts,
              queueOrder,
              finishedAt: undefined,
              cancelledAt: undefined,
              calledAt: undefined,
              startedAt: undefined,
              archivedAt: undefined,
              updatedAt: ts,
            }
          : t
      ),
    }));
  },

  clearHistoryAndResetNumbering: async () => {
    const { tickets } = get();
    const ts = stampNow();

    // Finished / cancelled tickets are ARCHIVED (kept forever for reports) —
    // never deleted. Only ticket numbers restart at #1.
    const archiveIds = new Set(
      tickets
        .filter(
          (t) =>
            (t.status === 'finished' || t.status === 'cancelled') &&
            typeof t.archivedAt !== 'number'
        )
        .map((t) => t.id)
    );

    // Active tickets get renumbered 1..n (sorted by creation time) and their
    // queue slots rewritten contiguously.
    const activeTickets = tickets
      .filter((t) => t.status !== 'finished' && t.status !== 'cancelled')
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((t, index) => ({
        ...t,
        ticketNumber: index + 1,
        queueOrder: index,
        updatedAt: ts,
      }));

    await db.transaction('rw', db.tickets, db.meta, async () => {
      for (const id of archiveIds) {
        await db.tickets.update(id, { archivedAt: ts, updatedAt: ts });
      }
      for (const t of activeTickets) {
        await db.tickets.update(t.id, {
          ticketNumber: t.ticketNumber,
          queueOrder: t.queueOrder,
          updatedAt: ts,
        });
      }
      // Next fresh ticket continues right after the renumbered actives.
      await setTicketCounter(activeTickets.length);
    });

    const activeById = new Map(activeTickets.map((t) => [t.id, t]));
    set({
      // Items are intentionally untouched — archived records keep their items
      // so history totals & the earnings dashboard stay accurate forever.
      tickets: tickets.map((t) => {
        if (archiveIds.has(t.id)) return { ...t, archivedAt: ts, updatedAt: ts };
        const renumbered = activeById.get(t.id);
        return renumbered ?? t;
      }),
    });
  },

  addItem: async (itemData) => {
    const created = stampNow();
    const item: PiercingItem = {
      ...itemData,
      id: newId(),
      createdAt: created,
      updatedAt: created,
    };
    await db.items.add(item);
    set((s) => ({ items: [...s.items, item] }));
  },

  updateItem: async (id, changes) => {
    const ts = stampNow();
    const merged = { ...changes, updatedAt: ts };
    await db.items.update(id, merged);
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...merged } : i)),
    }));
  },

  deleteItem: async (id) => {
    await db.transaction('rw', db.items, db.meta, async () => {
      await db.items.delete(id);
      await recordItemDeletions([id]);
    });
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  deleteItemsByTicket: async (ticketId) => {
    const doomed = (await db.items.where('ticketId').equals(ticketId).toArray()).map((i) => i.id);
    await db.transaction('rw', db.items, db.meta, async () => {
      if (doomed.length > 0) {
        await db.items.where('ticketId').equals(ticketId).delete();
        await recordItemDeletions(doomed);
      }
    });
    set((s) => ({ items: s.items.filter((i) => i.ticketId !== ticketId) }));
  },

  setActiveTicket: (id) => set({ activeTicketId: id }),

  exportBackup: () => {
    const { tickets, items } = get();
    return { tickets, items };
  },

  importBackup: async (tickets, items) => {
    // Backfill sync/audit fields for backups exported before they existed.
    const readyTickets: Ticket[] = tickets.map((t) => ({
      ...t,
      updatedAt: typeof t.updatedAt === 'number' ? t.updatedAt : t.createdAt,
    }));
    const readyItems: PiercingItem[] = items.map((i) => ({
      ...i,
      updatedAt: typeof i.updatedAt === 'number' ? i.updatedAt : i.createdAt,
    }));

    let maxNumber = 0;
    for (const t of readyTickets) {
      if (typeof t.ticketNumber === 'number' && t.ticketNumber > maxNumber) {
        maxNumber = t.ticketNumber;
      }
    }

    await db.transaction('rw', db.tickets, db.items, db.meta, async () => {
      await db.tickets.clear();
      await db.items.clear();
      await db.meta.delete('ticketCounter');
      if (readyTickets.length > 0) await db.tickets.bulkAdd(readyTickets);
      if (readyItems.length > 0) await db.items.bulkAdd(readyItems);
      await setTicketCounter(maxNumber);
    });
    // Normalize queue order for backups created before reordering existed.
    const normalized = await normalizeWaitingOrder(readyTickets);
    set({
      tickets: normalized,
      items: readyItems.sort((a, b) => a.createdAt - b.createdAt),
      activeTicketId: null,
    });
  },
}));
