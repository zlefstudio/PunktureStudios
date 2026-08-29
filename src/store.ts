import { create } from 'zustand';
import { db } from './db';
import type { Ticket, PiercingItem } from './types';

function newId(): string {
  return crypto.randomUUID();
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
  finishTicket: (id: string) => Promise<void>;
  cancelTicket: (id: string) => Promise<void>;
  sendToEnd: (id: string) => Promise<void>;
  updateTicketNotes: (id: string, notes: string) => Promise<void>;
  reopenTicket: (id: string) => Promise<void>;
  clearHistoryAndResetNumbering: () => Promise<void>;

  // Item actions
  addItem: (item: Omit<PiercingItem, 'id' | 'createdAt'>) => Promise<void>;
  updateItem: (id: string, changes: Partial<PiercingItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  deleteItemsByTicket: (ticketId: string) => Promise<void>;

  // UI
  setActiveTicket: (id: string | null) => void;

  // Backup
  exportBackup: () => { tickets: Ticket[]; items: PiercingItem[] };
  importBackup: (tickets: Ticket[], items: PiercingItem[]) => Promise<void>;
}

// Helper: get next ticket number
async function nextTicketNumber(): Promise<number> {
  const all = await db.tickets.orderBy('ticketNumber').last();
  return (all?.ticketNumber ?? 0) + 1;
}

export const useStore = create<AppState>((set, get) => ({
  tickets: [],
  items: [],
  activeTicketId: null,
  loaded: false,

  loadAll: async () => {
    const [tickets, rawItems] = await Promise.all([
      db.tickets.orderBy('createdAt').toArray(),
      db.items.toArray(), // createdAt is not indexed on items; sort in memory
    ]);
    const items = rawItems.sort((a, b) => a.createdAt - b.createdAt);
    set({ tickets, items, loaded: true });
  },

  addTicket: async (name, notes) => {
    const ticketNumber = await nextTicketNumber();
    const ticket: Ticket = {
      id: newId(),
      ticketNumber,
      name: name.trim(),
      status: 'waiting',
      notes: notes?.trim() || undefined,
      createdAt: Date.now(),
    };
    await db.tickets.add(ticket);
    set((s) => ({ tickets: [...s.tickets, ticket] }));
    return ticket;
  },

  callTicket: async (id) => {
    const now = Date.now();
    await db.tickets.update(id, { status: 'called', calledAt: now });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id ? { ...t, status: 'called', calledAt: now } : t
      ),
    }));
  },

  callNext: async () => {
    const { tickets } = get();
    const next = tickets
      .filter((t) => t.status === 'waiting')
      .sort((a, b) => a.createdAt - b.createdAt)[0];
    if (next) await get().callTicket(next.id);
  },

  startPiercing: async (id) => {
    const now = Date.now();
    await db.tickets.update(id, { status: 'in_progress', startedAt: now });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id ? { ...t, status: 'in_progress', startedAt: now } : t
      ),
    }));
  },

  finishTicket: async (id) => {
    const now = Date.now();
    await db.tickets.update(id, { status: 'finished', finishedAt: now });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id ? { ...t, status: 'finished', finishedAt: now } : t
      ),
      activeTicketId: s.activeTicketId === id ? null : s.activeTicketId,
    }));
  },

  cancelTicket: async (id) => {
    const now = Date.now();
    await db.tickets.update(id, { status: 'cancelled', cancelledAt: now });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id ? { ...t, status: 'cancelled', cancelledAt: now } : t
      ),
      activeTicketId: s.activeTicketId === id ? null : s.activeTicketId,
    }));
  },

  sendToEnd: async (id) => {
    const now = Date.now();
    // Reset to waiting with new createdAt so it joins end of queue
    await db.tickets.update(id, {
      status: 'waiting',
      createdAt: now,
      calledAt: undefined,
      startedAt: undefined,
    });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id
          ? { ...t, status: 'waiting', createdAt: now, calledAt: undefined, startedAt: undefined }
          : t
      ),
    }));
  },



  updateTicketNotes: async (id, notes) => {
    const val = notes.trim() || undefined;
    await db.tickets.update(id, { notes: val });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id ? { ...t, notes: val } : t
      ),
    }));
  },

  reopenTicket: async (id) => {
    const now = Date.now();
    await db.tickets.update(id, {
      status: 'waiting',
      createdAt: now,
      finishedAt: undefined,
      cancelledAt: undefined,
      calledAt: undefined,
      startedAt: undefined,
    });
    set((s) => ({
      tickets: s.tickets.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'waiting',
              createdAt: now,
              finishedAt: undefined,
              cancelledAt: undefined,
              calledAt: undefined,
              startedAt: undefined,
            }
          : t
      ),
    }));
  },

  clearHistoryAndResetNumbering: async () => {
    const { tickets } = get();
    const historyTicketIds = new Set(
      tickets
        .filter((t) => t.status === 'finished' || t.status === 'cancelled')
        .map((t) => t.id)
    );

    // Filter remaining active tickets sorted by created time
    const activeTickets = tickets
      .filter((t) => !historyTicketIds.has(t.id))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((t, index) => ({
        ...t,
        ticketNumber: index + 1,
      }));

    await db.transaction('rw', db.tickets, db.items, async () => {
      // Delete history tickets and their items
      for (const id of historyTicketIds) {
        await db.tickets.delete(id);
        await db.items.where('ticketId').equals(id).delete();
      }
      // Re-index remaining active tickets in db
      for (const t of activeTickets) {
        await db.tickets.update(t.id, { ticketNumber: t.ticketNumber });
      }
    });

    const activeItemRows = await db.items.toArray();
    set({
      tickets: activeTickets,
      items: activeItemRows.sort((a, b) => a.createdAt - b.createdAt),
    });
  },

  addItem: async (itemData) => {
    const item: PiercingItem = {
      ...itemData,
      id: newId(),
      createdAt: Date.now(),
    };
    await db.items.add(item);
    set((s) => ({ items: [...s.items, item] }));
  },

  updateItem: async (id, changes) => {
    await db.items.update(id, changes);
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...changes } : i)),
    }));
  },

  deleteItem: async (id) => {
    await db.items.delete(id);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  deleteItemsByTicket: async (ticketId) => {
    await db.items.where('ticketId').equals(ticketId).delete();
    set((s) => ({ items: s.items.filter((i) => i.ticketId !== ticketId) }));
  },

  setActiveTicket: (id) => set({ activeTicketId: id }),

  exportBackup: () => {
    const { tickets, items } = get();
    return { tickets, items };
  },

  importBackup: async (tickets, items) => {
    await db.transaction('rw', db.tickets, db.items, async () => {
      await db.tickets.clear();
      await db.items.clear();
      await db.tickets.bulkAdd(tickets);
      await db.items.bulkAdd(items);
    });
    set({ tickets, items, activeTicketId: null });
  },
}));
