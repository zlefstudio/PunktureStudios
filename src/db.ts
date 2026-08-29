import Dexie, { type Table } from 'dexie';
import type { Ticket, PiercingItem } from './types';

class PiercingDB extends Dexie {
  tickets!: Table<Ticket, string>;
  items!: Table<PiercingItem, string>;

  constructor() {
    super('PiercingQueueDB');
    this.version(1).stores({
      tickets: 'id, ticketNumber, status, createdAt',
      items: 'id, ticketId',
    });
  }
}

export const db = new PiercingDB();
