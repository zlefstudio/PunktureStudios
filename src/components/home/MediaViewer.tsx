import { useLayoutEffect, useRef } from 'react';
import { animate } from 'motion/mini';
import { X } from 'lucide-react';
import { Media } from './Media';
import { ORBIT } from './orbitMath';
import type { MediaItem } from './mediaItems.js';

export function MediaViewer({ item, source, reduced, onClose }: { item: MediaItem; source: HTMLButtonElement; reduced: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const dismiss = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const el = dialog.current!, card = panel.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const scrollY = window.scrollY;
    const previous = { overflow: document.body.style.overflow, position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
    const sourceRect = source.getBoundingClientRect();
    let alive = true, closing = false;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed'; document.body.style.top = `-${scrollY}px`; document.body.style.width = '100%';
    el.showModal();
    // Reset before measurement, including React StrictMode's second setup.
    card.style.transform = 'none';
    card.style.opacity = '1';
    const rect = card.getBoundingClientRect();
    const transform = `translate(${sourceRect.left - rect.left}px, ${sourceRect.top - rect.top}px) scale(${sourceRect.width / rect.width}, ${sourceRect.height / rect.height})`;
    source.style.visibility = 'hidden';
    let animation = animate(card, { transform: [transform, 'translate(0px, 0px) scale(1, 1)'], opacity: [1, 1] }, { duration: reduced ? 0 : ORBIT.expandDuration, ease: [0.22, 1, 0.36, 1] });
    const fade = animate(el.querySelector('.pk-viewer-backdrop')!, { opacity: [0, 1] }, { duration: reduced ? 0 : 0.3 });
    const chrome = [...el.querySelectorAll<HTMLElement>('.pk-viewer-top, .pk-viewer-caption')];
    const chromeAnimations = chrome.map(node => animate(node, { opacity: [0, 1] }, { duration: reduced ? 0 : 0.32, delay: reduced ? 0 : 0.22 }));
    dismiss.current = () => {
      if (closing) return;
      closing = true; animation.stop();
      chromeAnimations.forEach(control => control.stop());
      chrome.forEach(node => chromeAnimations.push(animate(node, { opacity: 0 }, { duration: reduced ? 0 : 0.12 })));
      // Re-measure the paused source so reverse FLIP also survives viewport rotation.
      const end = { left: (el.clientWidth - card.offsetWidth) / 2, top: (el.clientHeight - card.offsetHeight) / 2, width: card.offsetWidth, height: card.offsetHeight };
      const origin = source.getBoundingClientRect();
      const reverse = `translate(${origin.left - end.left}px, ${origin.top - end.top}px) scale(${origin.width / end.width}, ${origin.height / end.height})`;
      animation = animate(card, { transform: reverse, opacity: 0.65 }, { duration: reduced ? 0 : ORBIT.closeDuration, ease: [0.65, 0, 0.35, 1] });
      void animation.then(() => { if (alive) onClose(); });
      animate(el.querySelector('.pk-viewer-backdrop')!, { opacity: 0 }, { duration: reduced ? 0 : ORBIT.closeDuration });
    };
    return () => {
      alive = false; animation.stop(); fade.stop(); chromeAnimations.forEach(control => control.stop()); el.close();
      source.style.visibility = '';
      Object.assign(document.body.style, previous);
      window.scrollTo({ top: scrollY, behavior: 'instant' });
      (source.isConnected ? source : previousFocus)?.focus({ preventScroll: true });
    };
  }, [source, item.id, reduced, onClose]);
  return <dialog ref={dialog} className="pk-viewer" aria-labelledby="pk-viewer-title" aria-describedby="pk-viewer-description"
    onKeyDown={e => {
      if (e.key !== 'Tab') return;
      const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }}
    onCancel={e => { e.preventDefault(); dismiss.current(); }} onClick={e => { if (e.target === e.currentTarget) dismiss.current(); }}>
    <div className="pk-viewer-backdrop" onClick={() => dismiss.current()} aria-hidden="true" />
    <div className="pk-viewer-panel" ref={panel}>
      <Media item={item} playing viewer />
      <div className="pk-viewer-top pk-eyebrow"><span>PUNKTURE / {item.type === 'video' ? 'REEL' : 'STUDY'} {item.id}</span><button type="button" autoFocus onClick={() => dismiss.current()} aria-label="Close media viewer"><X size={24} /></button></div>
      <div className="pk-viewer-caption"><h2 id="pk-viewer-title">{item.caption}</h2><p id="pk-viewer-description">{item.type === 'video' ? 'PUNKTURE STUDIOS · MUTED / LOOP' : 'CONCEPT MOODBOARD · PLACEHOLDER IMAGE'}</p></div>
    </div>
  </dialog>;
}
