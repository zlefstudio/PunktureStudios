import { useLayoutEffect, useRef } from 'react';

/** Keep keyboard navigation inside a portalled dialog and restore its opener. */
export function useDialogFocus(active = true) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!active || !panel) return;
    const owner = panel.ownerDocument;
    const opener = owner.activeElement;
    const controls = () => Array.from(panel.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
    )).filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
    (controls()[0] ?? panel).focus({ preventScroll: true });
    function trap(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const targets = controls();
      const first = targets[0] ?? panel!;
      const last = targets.at(-1) ?? panel!;
      if (!panel!.contains(owner.activeElement) || (event.shiftKey && owner.activeElement === first)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && owner.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
    owner.addEventListener('keydown', trap);
    return () => {
      owner.removeEventListener('keydown', trap);
      queueMicrotask(() => {
        if (owner.querySelector('[role="dialog"][aria-modal="true"]')) return;
        const target = opener && 'focus' in opener && opener.isConnected ? opener as HTMLElement : owner.querySelector<HTMLElement>('[data-booking-cart-trigger]');
        target?.focus({ preventScroll: true });
      });
    };
  }, [active]);
  return ref;
}
