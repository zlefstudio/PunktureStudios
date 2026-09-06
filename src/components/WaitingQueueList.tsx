import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Ticket } from '../types';
import { TicketCard } from './TicketCard';

/* ─────────────────────────────────────────────────────────────────────────────
   WaitingQueueList — premium "grab & glide" vertical reordering.
   Pure Pointer Events + CSS transforms (no DnD library).

   Behaviour:
   · Mouse / pen: press anywhere on a card and drag.
   · Touch:      press & drag the grip handle (⋮⋮) on the right of the card.
   · The lifted card follows the pointer 1:1 (no lag), neighbours smoothly
     slide out of the way (cubic-bezier), and near the edges the list
     auto-scrolls.
   · On release the final layout is committed with a FLIP animation so every
     card glides to its resting slot.
   · A plain click (no movement) still opens the ticket workspace.
───────────────────────────────────────────────────────────────────────────── */

const DRAG_THRESHOLD = 6;   // px of movement before a press becomes a drag
const MOVE_MS        = 150;  // how fast neighbours shuffle out of the way
const SETTLE_MS      = 240;  // drop settle animation
const EASE           = 'cubic-bezier(0.16, 1, 0.3, 1)';

interface DragSession {
  dragId: string;
  startY: number;        // clientY when the drag was activated
  lastY: number;         // latest known clientY
  started: boolean;
  startContentY: number; // pointer position inside the list, at activation
  initialOrder: string[]; // display order when the press began
  liveOrder: string[];    // current visual order bookkeeping
  tops: Map<string, number>;    // natural content-space top of every row
  heights: Map<string, number>; // layout height of every row
  deltas: Map<string, number>;  // current translateY applied to every row
  gap: number;
  scrollEl: HTMLElement | null;
  raf: number;
}

interface Props {
  tickets: Ticket[];
  disabled?: boolean;
  onReorder: (dragId: string, toIndex: number) => void | Promise<void>;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function getScrollParent(node: HTMLElement | null): HTMLElement | null {
  let cur = node?.parentElement ?? null;
  while (cur && cur !== document.body) {
    const style = getComputedStyle(cur);
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      cur.scrollHeight > cur.clientHeight
    ) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}

export function WaitingQueueList({ tickets, disabled = false, onReorder }: Props) {
  const listRef     = useRef<HTMLDivElement | null>(null);
  const rowRefs     = useRef(new Map<string, HTMLDivElement>());
  const sessionRef  = useRef<DragSession | null>(null);
  const cleanupRef  = useRef<(() => void) | null>(null);
  const clickGuardTimer = useRef<number | undefined>(undefined);
  const settleTimers = useRef<number[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const canDrag = !disabled && tickets.length > 1;

  /* Clean up anything left behind on unmount. */
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      window.clearTimeout(clickGuardTimer.current);
      for (const t of settleTimers.current) window.clearTimeout(t);
      settleTimers.current = [];
    };
  }, []);

  function clearRowTransitionsAndTransforms(rows: Iterable<string>) {
    for (const id of rows) {
      const el = rowRefs.current.get(id);
      if (!el) continue;
      el.style.transition = 'none';
      el.style.transform  = '';
    }
  }

  /** Cancel the auto-scroll rAF loop + window listeners. */
  function endSession() {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (sessionRef.current) {
      cancelAnimationFrame(sessionRef.current.raf);
      sessionRef.current.raf = 0;
      sessionRef.current = null;
    }
    document.body.style.userSelect = '';
    setDraggingId(null);
  }

  function startAutoScroll(s: DragSession) {
    const loop = () => {
      const cur = sessionRef.current;
      if (!cur) return; // session finished
      const sc = cur.scrollEl;
      if (sc) {
        const rect = sc.getBoundingClientRect();
        const y    = cur.lastY;
        const zone = 56;
        let dir = 0;
        if (y < rect.top + zone) dir = -1;
        else if (y > rect.bottom - zone) dir = 1;

        if (dir !== 0) {
          const max  = sc.scrollHeight - sc.clientHeight;
          const dist = dir < 0 ? y - rect.top : rect.bottom - y;
          const step = clamp((zone - dist) / zone, 0, 1) * 14 + 4;
          sc.scrollTop = clamp(sc.scrollTop + dir * step, 0, max);
          if (sc.scrollTop > 0 || dir < 0) reposition(cur.lastY);
        }
      }
      cur.raf = requestAnimationFrame(loop);
    };
    s.raf = requestAnimationFrame(loop);
  }

  /* ── Swap helpers ── */

  function applyDelta(id: string, delta: number, animate: boolean) {
    const el = rowRefs.current.get(id);
    if (!el) return;
    const s = sessionRef.current;
    if (s) s.deltas.set(id, delta);
    el.style.transition = animate
      ? `transform ${MOVE_MS}ms ${EASE}`
      : 'none';
    el.style.transform = delta === 0 ? '' : `translate3d(0, ${delta}px, 0)`;
  }

  function centerOf(s: DragSession, id: string): number {
    return (
      (s.tops.get(id) ?? 0) +
      (s.deltas.get(id) ?? 0) +
      (s.heights.get(id) ?? 0) / 2
    );
  }

  function swapDown(s: DragSession, idx: number) {
    const next = s.liveOrder[idx + 1];
    if (next === undefined) return;
    const shift = (s.heights.get(s.dragId) ?? 0) + s.gap;
    // neighbour below slides up into the vacated slot
    applyDelta(next, (s.deltas.get(next) ?? 0) - shift, true);
    s.liveOrder[idx] = next;
    s.liveOrder[idx + 1] = s.dragId;
  }

  function swapUp(s: DragSession, idx: number) {
    const prev = s.liveOrder[idx - 1];
    if (prev === undefined) return;
    const shift = (s.heights.get(s.dragId) ?? 0) + s.gap;
    // neighbour above slides down into the vacated slot
    applyDelta(prev, (s.deltas.get(prev) ?? 0) + shift, true);
    s.liveOrder[idx] = prev;
    s.liveOrder[idx - 1] = s.dragId;
  }

  /** Move the lifted row under the pointer + cascade swaps past neighbours. */
  function reposition(clientY: number) {
    const s = sessionRef.current;
    const list = listRef.current;
    if (!s || !list) return;
    s.lastY = clientY;

    const lr = list.getBoundingClientRect();
    const py = clientY - lr.top; // pointer position in list content coords

    // 1. Lifted card follows the pointer 1:1 (keeps the original grab point).
    const dragEl = rowRefs.current.get(s.dragId);
    if (dragEl) {
      const translate = py - s.startContentY;
      s.deltas.set(s.dragId, translate);
      dragEl.style.transition = 'none';
      dragEl.style.transform  = `translate3d(0, ${translate}px, 0)`;
    }

    // 2. Cascade swaps: walk the dragged card to its slot, one neighbour at a
    //    time so each crossed card visibly slides out of the way.
    let guard = 0;
    while (guard++ < s.liveOrder.length) {
      const idx = s.liveOrder.indexOf(s.dragId);
      // How many non-dragged rows sit above the pointer right now?
      let above = 0;
      for (const oid of s.liveOrder) {
        if (oid !== s.dragId && centerOf(s, oid) < py) above++;
      }
      if (above === idx) break;
      if (above > idx) swapDown(s, idx);
      else swapUp(s, idx);
    }
  }


  /* ── Press → possible drag ── */

  function handleRowPointerDown(e: React.PointerEvent<HTMLDivElement>, id: string) {
    if (!canDrag || sessionRef.current) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (e.isPrimary === false) return;

    // Touch only starts from the explicit grip handle so vertical scroll of
    // the queue keeps working everywhere else.
    if (e.pointerType === 'touch') {
      const target = e.target as Element | null;
      if (!target?.closest?.('[data-reorder-handle]')) return;
    }

    const s: DragSession = {
      dragId: id,
      startY: e.clientY,
      lastY: e.clientY,
      started: false,
      startContentY: 0,
      initialOrder: tickets.map((t) => t.id),
      liveOrder: tickets.map((t) => t.id),
      tops: new Map(),
      heights: new Map(),
      deltas: new Map(),
      gap: 0,
      scrollEl: null,
      raf: 0,
    };
    sessionRef.current = s;

    const onMove = (ev: PointerEvent) => {
      if (sessionRef.current !== s) return;
      if (!s.started) {
        if (
          Math.abs(ev.clientY - s.startY) < DRAG_THRESHOLD &&
          Math.abs(ev.clientX - e.clientX) < DRAG_THRESHOLD
        ) {
          s.lastY = ev.clientY;
          return;
        }
        beginDrag(s, ev.clientY);
      }
      ev.preventDefault();
      reposition(ev.clientY);
    };

    const onEnd = (ev: PointerEvent) => {
      if (sessionRef.current !== s) return;
      if (!s.started) {
        // Plain press + release → normal click behaviour.
        cleanupRef.current?.();
        cleanupRef.current = null;
        sessionRef.current = null;
        return;
      }
      void drop(s, ev.clientY, false);
    };

    const onCancel = () => {
      if (sessionRef.current !== s) return;
      if (s.started) {
        void drop(s, s.lastY, true);
      } else {
        cleanupRef.current?.();
        cleanupRef.current = null;
        sessionRef.current = null;
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('blur', onCancel);

    cleanupRef.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', onCancel);
    };
  }

  function beginDrag(s: DragSession, clientY: number) {
    const list = listRef.current;
    if (!list) return;
    const listRect0 = list.getBoundingClientRect();

    // Cancel any leftover drop-settle animation and flatten the rows first.
    for (const t of settleTimers.current) window.clearTimeout(t);
    settleTimers.current = [];
    clearRowTransitionsAndTransforms(s.initialOrder);
    list.getBoundingClientRect(); // force reflow after transform removal

    // Measure the natural layout of every row once.
    let prevTop: number | null = null;
    let prevHeight = 0;
    for (const id of s.initialOrder) {
      const el = rowRefs.current.get(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const top  = rect.top - listRect0.top;
      s.tops.set(id, top);
      s.heights.set(id, rect.height);
      s.deltas.set(id, 0);
      if (prevTop !== null && !s.gap) {
        s.gap = Math.max(0, top - prevTop - prevHeight);
      }
      prevTop = top;
      prevHeight = rect.height;
    }

    s.scrollEl = getScrollParent(list);
    s.started = true;
    s.startContentY = clientY - listRect0.top;

    document.body.style.userSelect = 'none';
    setDraggingId(s.dragId);
    startAutoScroll(s);
    reposition(clientY);
  }


  /* ── Drop ── */

  async function drop(s: DragSession, clientY: number, cancelled: boolean) {
    const list = listRef.current;
    if (!list) return;

    // Resolve the final slot using each row's CURRENT visual centre.
    const py = clientY - list.getBoundingClientRect().top;
    const others = s.liveOrder.filter((oid) => oid !== s.dragId);
    let above = 0;
    for (const oid of others) if (centerOf(s, oid) < py) above++;
    const finalOrder = [...others.slice(0, above), s.dragId, ...others.slice(above)];
    const didMove = !cancelled && !ordersEqual(finalOrder, s.initialOrder);

    // Where is every row visually right now? Use the transform *targets*
    // (not a live rect) so a still-running shuffle can't cause a jump.
    const listTop = list.getBoundingClientRect().top;
    const oldTops = new Map<string, number>();
    for (const id of s.initialOrder) {
      oldTops.set(id, listTop + (s.tops.get(id) ?? 0) + (s.deltas.get(id) ?? 0));
    }

    sessionRef.current = null; // stop rAF + event guards
    endSession();              // detach listeners, clear draggingId

    if (didMove) {
      const toIndex = finalOrder.indexOf(s.dragId);
      try {
        setReorderError(null);
        // onReorder updates the store synchronously (optimistic), so the DOM
        // can be committed + FLIP-animated right away — no flash frame —
        // while the IndexedDB write finishes in the background.
        await onReorder(s.dragId, toIndex);
        flushSync(() => {});
        settleFrom(oldTops, s.initialOrder, true);
        armClickGuard();
      } catch (e) {
        setReorderError(e instanceof Error ? e.message : 'Could not save the queue order.');
        flushSync(() => {});
        settleFrom(oldTops, s.initialOrder, false);
      }
      return;
    }

    // Unchanged order (or cancelled) — spring back to the resting layout.
    flushSync(() => {});
    settleFrom(oldTops, s.initialOrder, true);
    armClickGuard();
  }

  function ordersEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((id, i) => id === b[i]);
  }

  function armClickGuard() {
    window.clearTimeout(clickGuardTimer.current);
    clickGuardTimer.current = window.setTimeout(() => {
      clickGuardTimer.current = undefined;
    }, 350);
  }

  /**
   * FLIP: rows are already committed into their final DOM order — start every
   * row where it visually was (oldTops) and glide down to its resting slot.
   * Runs synchronously right after the React commit (see `drop`), so there is
   * never a wrong-looking intermediate frame.
   */
  function settleFrom(oldTops: Map<string, number>, ids: string[], animated: boolean) {
    const rows = ids
      .map((id) => rowRefs.current.get(id))
      .filter((el): el is HTMLDivElement => !!el);
    if (rows.length === 0) return;

    if (!animated) {
      clearRowTransitionsAndTransforms(ids);
      return;
    }

    // 1. Drop any leftover drag transform so positions measure clean.
    for (const el of rows) {
      el.style.transition = 'none';
      el.style.transform  = '';
    }
    void listRef.current?.offsetHeight; // commit the clean-up (same task → no paint)

    // 2. Start each row where the user left it visually…
    for (const el of rows) {
      const id = el.dataset.ticketId ?? '';
      const dy = (oldTops.get(id) ?? el.getBoundingClientRect().top) - el.getBoundingClientRect().top;
      el.style.transform = dy === 0 ? '' : `translate3d(0, ${dy}px, 0)`;
    }
    void listRef.current?.offsetHeight; // reflow so the starting offset sticks

    // 3. …and glide down to the natural resting slot.
    for (const el of rows) {
      el.style.transition = `transform ${SETTLE_MS}ms ${EASE}`;
      el.style.transform  = '';
    }
    const t = window.setTimeout(() => {
      clearRowTransitionsAndTransforms(ids);
      settleTimers.current = settleTimers.current.filter((x) => x !== t);
    }, SETTLE_MS + 60);
    settleTimers.current.push(t);
  }

  return (
    <div
      ref={listRef}
      role="list"
      aria-label="Waiting queue — drag to reorder, or focus a ticket and press Alt plus Up or Down"
      className="flex flex-col gap-2 select-none"
      onClickCapture={(e) => {
        // Suppress the ghost click browsers fire right after a drag.
        if (clickGuardTimer.current === undefined) return;
        window.clearTimeout(clickGuardTimer.current);
        clickGuardTimer.current = undefined;
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDownCapture={() => {
        // A brand-new press is a fresh intent — disarm the guard.
        if (clickGuardTimer.current !== undefined) {
          window.clearTimeout(clickGuardTimer.current);
          clickGuardTimer.current = undefined;
        }
      }}
    >
      {reorderError && <p role="alert" className="text-red-400 text-sm">{reorderError}</p>}
      {tickets.map((t) => {
        const isDragging = draggingId === t.id;
        return (
          <div
            key={t.id}
            data-ticket-id={t.id}
            role="listitem"
            ref={(el) => {
              if (el) rowRefs.current.set(t.id, el);
              else rowRefs.current.delete(t.id);
            }}
            className="relative"
            style={isDragging ? { zIndex: 40, willChange: 'transform' } : undefined}
            onPointerDown={(e) => handleRowPointerDown(e, t.id)}
            onKeyDown={async e => {
              if (!canDrag || !e.altKey || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
              e.preventDefault();
              const index = tickets.findIndex(ticket => ticket.id === t.id);
              try { await onReorder(t.id, index + (e.key === 'ArrowUp' ? -1 : 1)); setReorderError(null); }
              catch (error) { setReorderError(error instanceof Error ? error.message : 'Could not reorder.'); }
            }}
          >
            <TicketCard ticket={t} reorderable={canDrag} dragging={isDragging} />
          </div>
        );
      })}
    </div>
  );
}

