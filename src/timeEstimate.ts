import { useState, useEffect, useMemo } from 'react';
import type { Ticket, PiercingItem } from './types';
import { sortWaiting } from './queue';
import { useStore } from './store';

/**
 * Standard estimated durations (in minutes) per placement.
 */
export const PLACEMENT_DURATIONS: Record<string, number> = {
  'helix': 10,
  'forward helix': 10,
  'industrial': 13,
  'spider bites': 13,
  'snake bites': 13,
  'angel bites': 13,
  'angel fangs': 13,
  'lobe': 5,
  'eyebrow': 5,
};

export const DEFAULT_PIERCING_DURATION = 6;
export const JEWELRY_DURATION = 0;

/**
 * Returns estimated duration (in minutes) for an individual item,
 * accounting for item quantity.
 */
export function getItemDuration(item: PiercingItem): number {
  if (!item.placementName) return DEFAULT_PIERCING_DURATION * (item.quantity || 1);

  // Standalone jewelry purchase doesn't take piercing chair time
  if (item.placementName.trim().toLowerCase() === 'jewelry') {
    return JEWELRY_DURATION;
  }

  const name = item.placementName.trim().toLowerCase();
  const qty = Math.max(1, item.quantity || 1);

  // Check known placements
  for (const [key, duration] of Object.entries(PLACEMENT_DURATIONS)) {
    if (name === key || name.includes(key)) {
      return duration * qty;
    }
  }

  return DEFAULT_PIERCING_DURATION * qty;
}

/**
 * Total estimated piercing duration (in minutes) for all items in a ticket.
 * If a ticket has no items yet, defaults to DEFAULT_PIERCING_DURATION (6 mins).
 */
export function getTicketDuration(items: PiercingItem[]): number {
  if (items.length === 0) {
    return DEFAULT_PIERCING_DURATION;
  }

  const sum = items.reduce((acc, item) => acc + getItemDuration(item), 0);
  return sum > 0 ? sum : DEFAULT_PIERCING_DURATION;
}

/**
 * Formats a Date/epoch to "h:mma" (e.g. "2:20pm").
 */
export function formatClockTime(epochOrDate: number | Date): string {
  const d = typeof epochOrDate === 'number' ? new Date(epochOrDate) : epochOrDate;
  return d
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase()
    .replace(' ', '');
}

export interface TicketWaitEstimate {
  waitMinutes: number;
  targetTime: Date;
  formattedEstimate: string; // e.g. "est: 20m at 2:20pm"
  ownDuration: number;
}

export interface InProgressEstimate {
  ticketId: string;
  totalDuration: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  isOvertime: boolean;
}

export interface QueueEstimates {
  estimates: Map<string, TicketWaitEstimate>;
  inProgressEstimate?: InProgressEstimate;
}

/**
 * Calculates dynamic wait times for all waiting tickets in the queue.
 * - Takes into account the remaining time of any in_progress ticket.
 * - Handles overtime gracefully (fallback 1 min remaining buffer).
 * - Follows the current sorted waiting queue.
 */
export function calculateQueueWaitTimes(
  tickets: Ticket[],
  items: PiercingItem[],
  currentTime = Date.now()
): QueueEstimates {
  const estimates = new Map<string, TicketWaitEstimate>();

  // Find currently active in-progress ticket (if any)
  const inProgressTicket = tickets.find((t) => t.status === 'in_progress');
  let rollingWaitMinutes = 0;
  let inProgressEstimate: InProgressEstimate | undefined = undefined;

  if (inProgressTicket) {
    const ipItems = items.filter((i) => i.ticketId === inProgressTicket.id);
    const totalDuration = getTicketDuration(ipItems);
    const elapsedMs = Math.max(0, currentTime - (inProgressTicket.startedAt ?? currentTime));
    const elapsedMinutes = Math.floor(elapsedMs / 60000);

    const isOvertime = elapsedMinutes >= totalDuration;
    // If overtime, assume wrapping up within 1 minute
    const remainingMinutes = isOvertime ? 1 : Math.max(1, totalDuration - elapsedMinutes);

    rollingWaitMinutes = remainingMinutes;
    inProgressEstimate = {
      ticketId: inProgressTicket.id,
      totalDuration,
      elapsedMinutes,
      remainingMinutes,
      isOvertime,
    };
  }

  // Iterate over sorted waiting tickets
  const waitingTickets = sortWaiting(tickets);

  for (const ticket of waitingTickets) {
    const ticketSpecificItems = items.filter((i) => i.ticketId === ticket.id);
    const ownDuration = getTicketDuration(ticketSpecificItems);

    const waitMinutes = rollingWaitMinutes;
    const targetTime = new Date(currentTime + waitMinutes * 60000);
    const timeStr = formatClockTime(targetTime);

    const formattedEstimate =
      waitMinutes === 0
        ? `est: 0m at ${timeStr}`
        : `est: ${waitMinutes}m at ${timeStr}`;

    estimates.set(ticket.id, {
      waitMinutes,
      targetTime,
      formattedEstimate,
      ownDuration,
    });

    rollingWaitMinutes += ownDuration;
  }

  return { estimates, inProgressEstimate };
}

/**
 * Hook providing a dynamic tick (default every 15s) to keep
 * real-time relative and clock-based wait estimates fresh.
 */
export function useLiveClock(intervalMs = 15000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

/**
 * Reactive hook returning current queue estimates and in-progress session stats.
 */
export function useQueueWaitEstimates() {
  const tickets = useStore((s) => s.tickets);
  const items = useStore((s) => s.items);
  const now = useLiveClock(15000);

  return useMemo(() => calculateQueueWaitTimes(tickets, items, now), [tickets, items, now]);
}
