import { create } from 'zustand';
import { db, allocateTicketNumber, setTicketCounter, recordItemDeletions } from './db';
import type { Ticket, PiercingItem, BackupPayload } from './types';
import { validateBackup, validateItem } from './validation';
import { withDataLock } from './dataLock';
import { sortWaiting, nextWaitingToken } from './queue';

function newId(): string {
  return crypto.randomUUID();
}

let lastStamp = 0;
function stampNow(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
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
  activeTab: 'active' | 'history' | 'settings';
  setActiveTab: (tab: 'active' | 'history' | 'settings') => void;
  setActiveTicket: (id: string | null) => void;

  // Backup
  exportBackup: () => Promise<BackupPayload>;
  importBackup: (payload: BackupPayload) => Promise<void>;
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
  activeTab: 'active',
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
    for (const row of [...tickets, ...items]) if (Number.isFinite(row.updatedAt)) lastStamp = Math.max(lastStamp, row.updatedAt);

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
    if (!name.trim() || name.trim().length > 200) throw new Error('Enter a client name (up to 200 characters).');
    if (notes && notes.length > 2000) throw new Error('Notes must be at most 2000 characters.');
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
    await db.transaction('rw', db.tickets, async () => {
      const ticket = await db.tickets.get(id);
      if (!ticket || ticket.status !== 'waiting') throw new Error('Only waiting tickets can be called.');
      if (await db.tickets.where('status').anyOf('called', 'in_progress').count()) throw new Error('Finish the current session first.');
      await db.tickets.update(id, { status: 'called', calledAt: ts, updatedAt: ts });
    });
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
    await db.transaction('rw', db.tickets, async () => {
      const ticket = await db.tickets.get(id);
      if (!ticket || !['waiting', 'called'].includes(ticket.status)) throw new Error('This ticket cannot be started.');
      const busy = await db.tickets.where('status').anyOf('called', 'in_progress').toArray();
      if (busy.some(t => t.id !== id)) throw new Error('Finish or return the current session to the queue first.');
      await db.tickets.update(id, { status: 'in_progress', startedAt: ts, updatedAt: ts });
    });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id ? { ...t, status: 'in_progress', startedAt: ts, updatedAt: ts } : t
      ),
    }));
  },

  cancelSession: async (id: string) => {
    if ((await db.tickets.get(id))?.status !== 'in_progress') throw new Error('Only an active session can return to the queue.');
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
    await db.transaction('rw', db.tickets, db.items, async () => {
      const ticket = await db.tickets.get(id);
      if (!ticket || ['finished', 'cancelled'].includes(ticket.status)) throw new Error('This ticket is already closed.');
      if (!(await db.items.where('ticketId').equals(id).count())) throw new Error('Add an item before finishing.');
      await db.tickets.update(id, { status: 'finished', finishedAt: ts, cancelledAt: undefined, updatedAt: ts });
    });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id ? { ...t, status: 'finished', finishedAt: ts, updatedAt: ts } : t
      ),
      activeTicketId: s.activeTicketId === id ? null : s.activeTicketId,
    }));
  },

  cancelTicket: async (id) => {
    const current = await db.tickets.get(id);
    if (!current || ['finished', 'cancelled'].includes(current.status)) throw new Error('This ticket is already closed.');
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
    if ((await db.tickets.get(id))?.status !== 'called') throw new Error('Only a called ticket can be sent to the end.');
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

    try {
      await db.transaction('rw', db.tickets, async () => {
        for (let i = 0; i < nextOrder.length; i++) {
          await db.tickets.update(nextOrder[i].id, { queueOrder: i, updatedAt: ts });
        }
      });
    } catch (error) { set({ tickets }); throw error; }
  },

  updateTicketNotes: async (id, notes) => {
    const ticket = await db.tickets.get(id);
    if (!ticket || ['finished', 'cancelled'].includes(ticket.status)) throw new Error('This ticket is closed.');
    if (notes.length > 2000) throw new Error('Notes must be at most 2000 characters.');
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
    const ticket = await db.tickets.get(id);
    if (!ticket || !['finished', 'cancelled'].includes(ticket.status)) throw new Error('Only closed tickets can be reopened.');
    const numberInUse = get().tickets.some(t => t.id !== id && typeof t.archivedAt !== 'number' && t.ticketNumber === ticket.ticketNumber);
    const ticketNumber = numberInUse || typeof ticket.archivedAt === 'number' ? await allocateTicketNumber() : ticket.ticketNumber;
    const ts = stampNow();
    const queueOrder = nextWaitingToken(get().tickets);
    await db.tickets.update(id, {
      status: 'waiting',
      createdAt: ts,
      queueOrder,
      ticketNumber,
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
              ticketNumber,
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

    // Preserve the manually chosen waiting order while renumbering.
    const waitingPositions = new Map(sortWaiting(tickets).map((t, i) => [t.id, i]));
    const activeTickets = tickets
      .filter((t) => t.status !== 'finished' && t.status !== 'cancelled')
      .sort((a, b) => (a.status === 'waiting' ? 1 : 0) - (b.status === 'waiting' ? 1 : 0)
        || (waitingPositions.get(a.id) ?? 0) - (waitingPositions.get(b.id) ?? 0))
      .map((t, index) => ({
        ...t,
        ticketNumber: index + 1,
        queueOrder: waitingPositions.get(t.id) ?? t.queueOrder,
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
    validateItem(item);
    await db.transaction('rw', db.tickets, db.items, async () => {
      const ticket = await db.tickets.get(item.ticketId);
      if (!ticket || ['finished', 'cancelled'].includes(ticket.status)) throw new Error('Select an open ticket.');
      await db.items.add(item);
    });
    set((s) => ({ items: [...s.items, item] }));
  },

  updateItem: async (id, changes) => {
    const ts = stampNow();
    const merged = { ...changes, updatedAt: ts };
    await db.transaction('rw', db.items, db.tickets, async () => {
      const current = await db.items.get(id);
      if (!current) throw new Error('Item no longer exists.');
      if ((changes.id && changes.id !== id) || (changes.ticketId && changes.ticketId !== current.ticketId)) throw new Error('Item identity cannot change.');
      const ticket = await db.tickets.get(current.ticketId);
      if (!ticket || ['finished', 'cancelled'].includes(ticket.status)) throw new Error('This ticket is closed.');
      validateItem({ ...current, ...merged });
      await db.items.update(id, merged);
    });
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...merged } : i)),
    }));
  },

  deleteItem: async (id) => {
    await db.transaction('rw', db.items, db.meta, db.tickets, async () => {
      const item = await db.items.get(id);
      if (!item) return;
      const ticket = await db.tickets.get(item.ticketId);
      if (!ticket || ['finished', 'cancelled'].includes(ticket.status)) throw new Error('This ticket is closed.');
      await db.items.delete(id);
      await recordItemDeletions([id]);
    });
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  deleteItemsByTicket: async (ticketId) => {
    const ticket = await db.tickets.get(ticketId);
    if (!ticket || ['finished', 'cancelled'].includes(ticket.status)) throw new Error('This ticket is closed.');
    const doomed = (await db.items.where('ticketId').equals(ticketId).toArray()).map((i) => i.id);
    await db.transaction('rw', db.items, db.meta, async () => {
      if (doomed.length > 0) {
        await db.items.where('ticketId').equals(ticketId).delete();
        await recordItemDeletions(doomed);
      }
    });
    set((s) => ({ items: s.items.filter((i) => i.ticketId !== ticketId) }));
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveTicket: (id) => set({ activeTicketId: id }),

  exportBackup: async () => db.transaction('r', db.tickets, db.items, db.meta, db.settings, async () => ({
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    tickets: await db.tickets.toArray(),
    items: await db.items.toArray(),
    ticketCounter: (await db.meta.get('ticketCounter'))?.value ?? (await db.tickets.toArray()).reduce((max, ticket) => typeof ticket.archivedAt === 'number' ? max : Math.max(max, ticket.ticketNumber), 0),
    settings: (await db.settings.get('public')) ?? null,
  })),

  importBackup: async (raw) => {
    const payload = validateBackup(raw);
    const ts = stampNow();
    await db.transaction('rw', db.tickets, db.items, db.meta, db.settings, async () => {
      await db.tickets.clear();
      await db.items.clear();
      await db.meta.clear();
      await db.settings.clear();
      await db.tickets.bulkAdd(payload.tickets.map(t => ({ ...t, updatedAt: ts })));
      await db.items.bulkAdd(payload.items.map(i => ({ ...i, updatedAt: ts })));
      if (payload.settings) await db.settings.put({ ...payload.settings, updatedAt: ts });
      await setTicketCounter(payload.ticketCounter ?? 0);
      // A durable restore intent survives reloads, offline use and partial cloud writes.
      await db.meta.put({ key: 'restorePending', value: ts });
    });
    await get().loadAll();
    set({ activeTicketId: null });
  },
}));

// Sync and every local mutation share one lock. callNext delegates to callTicket.
const serializedActions = [
  'addTicket', 'callTicket', 'startPiercing', 'cancelSession', 'finishTicket',
  'cancelTicket', 'sendToEnd', 'moveWaitingTicket', 'updateTicketNotes',
  'reopenTicket', 'clearHistoryAndResetNumbering', 'addItem', 'updateItem',
  'deleteItem', 'deleteItemsByTicket', 'importBackup', 'exportBackup',
] as const;
for (const key of serializedActions) {
  const action = useStore.getState()[key] as (...args: never[]) => Promise<unknown>;
  useStore.setState({ [key]: (...args: never[]) => withDataLock(() => action(...args)) });
}
