import { collection, doc, onSnapshot, type DocumentData, type SnapshotMetadata } from 'firebase/firestore';
import { firestore } from './firebase';

export interface CloudRow { id: string; updatedAt?: number; deleted?: boolean }
type Waiter = { resolve: (rows: Map<string, CloudRow>) => void; reject: (error: Error) => void };
type Entry = { rows: Map<string, CloudRow> | null; error?: Error; stop: () => void; waiters: Set<Waiter> };

/** Keep server-confirmed snapshots across sync cycles; never merge cache-only or pending writes. */
export function createRemoteRows(changed: () => void) {
  const entries = new Map<string, Entry>();
  function reset() {
    for (const entry of entries.values()) {
      entry.stop();
      for (const waiter of entry.waiters) waiter.reject(new Error('Cloud session changed. Retry sync.'));
    }
    entries.clear();
  }
  async function read(col: string): Promise<Map<string, CloudRow>> {
    let entry = entries.get(col);
    if (!entry) {
      entry = { rows: null, stop: () => {}, waiters: new Set() };
      entries.set(col, entry);
      const current = entry;
      const receive = (rows: Map<string, CloudRow>, metadata: SnapshotMetadata) => {
        if (entries.get(col) !== current) return;
        if (metadata.fromCache || metadata.hasPendingWrites) { current.rows = null; return; }
        current.rows = rows;
        for (const waiter of current.waiters) waiter.resolve(new Map(rows));
        current.waiters.clear();
        changed();
      };
      const failed = (error: Error) => {
        current.rows = null;
        current.error = error;
        for (const waiter of current.waiters) waiter.reject(error);
        current.waiters.clear();
        changed();
      };
      const row = (id: string, data: DocumentData) => ({ ...data, id } as CloudRow);
      current.stop = col === 'public'
        ? onSnapshot(doc(firestore, col, 'public'), { includeMetadataChanges: true }, snap => {
          receive(new Map(snap.exists() ? [['public', row('public', snap.data())]] : []), snap.metadata);
        }, failed)
        : onSnapshot(collection(firestore, col), { includeMetadataChanges: true }, snap => {
          receive(new Map(snap.docs.map(d => [d.id, row(d.id, d.data())])), snap.metadata);
        }, failed);
    }
    if (entry.error) throw entry.error;
    if (entry.rows) return new Map(entry.rows);
    const current = entry;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        current.waiters.delete(waiter);
        reject(new Error('Cloud snapshot unavailable. Local data is safe; sync will retry.'));
      }, 15000);
      const waiter: Waiter = {
        resolve: rows => { clearTimeout(timer); resolve(rows); },
        reject: error => { clearTimeout(timer); reject(error); },
      };
      current.waiters.add(waiter);
    });
  }
  return { read, reset };
}
