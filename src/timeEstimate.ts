import { useMemo, useSyncExternalStore } from 'react';
import type { Ticket, PiercingItem } from './types';
import { useStore } from './store';
import { calculateQueueWaitTimes, type QueueEstimates } from './queueEstimates';
export * from './queueEstimates';

/**
 * Hook providing a dynamic tick (default every 15s) to keep
 * real-time relative and clock-based wait estimates fresh.
 */
export function useLiveClock(intervalMs = 15000): number {
  const clock = useMemo(() => getClock(intervalMs), [intervalMs]);
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getSnapshot);
}

const clocks = new Map<number, ReturnType<typeof createClock>>();
function createClock(interval: number) {
  let now = Date.now();
  let timer: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => now,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (!timer) {
        now = Date.now();
        timer = setInterval(() => { now = Date.now(); listeners.forEach(l => l()); }, interval);
      }
      return () => { listeners.delete(listener); if (!listeners.size) { clearInterval(timer); timer = undefined; } };
    },
  };
}
function getClock(interval: number) {
  let clock = clocks.get(interval);
  if (!clock) { clock = createClock(interval); clocks.set(interval, clock); }
  return clock;
}
let estimateCache: { tickets: Ticket[]; items: PiercingItem[]; now: number; result: QueueEstimates } | undefined;

/**
 * Reactive hook returning current queue estimates and in-progress session stats.
 */
export function useQueueWaitEstimates() {
  const tickets = useStore((s) => s.tickets);
  const items = useStore((s) => s.items);
  const now = useLiveClock(15000);

  return useMemo(() => {
    if (!estimateCache || estimateCache.tickets !== tickets || estimateCache.items !== items || estimateCache.now !== now) {
      estimateCache = { tickets, items, now, result: calculateQueueWaitTimes(tickets, items, now) };
    }
    return estimateCache.result;
  }, [tickets, items, now]);
}
