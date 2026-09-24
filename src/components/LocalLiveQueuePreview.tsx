import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db';
import { buildPublicQueue } from '../publicQueue';
import type { PublicQueueRow } from '../types';
import { LiveQueuePage } from './LiveQueuePage';

/** Development-only: observes this browser's staff DB, without writing or syncing. */
export function LocalLiveQueuePreview() {
  const [rows, setRows] = useState<PublicQueueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const subscription = liveQuery(() => db.transaction('r', db.tickets, db.items, async () =>
      buildPublicQueue(await db.tickets.toArray(), await db.items.toArray())
    )).subscribe({ next: setRows, error: () => setError('Cannot read the local queue. Open the admin in this browser on localhost:5174 and retry.') });
    return () => subscription.unsubscribe();
  }, []);
  return <LiveQueuePage localPreview={{ rows, error }} />;
}
