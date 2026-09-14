import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowDown, ArrowUpRight, MoveHorizontal, Pause, Play } from 'lucide-react';
import { mediaItems, type MediaItem } from './mediaItems.js';
import { Media } from './Media';
import { mediaPoster } from './mediaUtils';
import type { IntroGate } from './introTimeline';
import { ORBIT, advanceOrbit, isOrbitClick, orbitPose } from './orbitMath';

export function OrbitHero({ onOpen, open, reduced, introGate }: { onOpen: (item: MediaItem, source: HTMLButtonElement) => void; open: boolean; reduced: boolean; introGate?: IntroGate }) {
  const stage = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const engine = useRef({ angle: ORBIT.initialAngle, velocity: 0, width: 1000, height: 600, visible: true, layoutDirty: true, focused: false, open, reduced, paused: false });
  const gesture = useRef<null | { id: number; startX: number; startY: number; x: number; time: number; start: number; distance: number; card: HTMLButtonElement | null }>(null);
  const [paused, setPaused] = useState(false);
  const [playingIds, setPlayingIds] = useState<string[]>([]);
  useEffect(() => { Object.assign(engine.current, { open, reduced, paused }); }, [open, reduced, paused]);
  useEffect(() => {
    const el = stage.current!;
    const state = engine.current;
    const resize = new ResizeObserver(([entry]) => { state.width = entry.contentRect.width; state.height = entry.contentRect.height; state.layoutDirty = true; });
    resize.observe(el);
    const observer = new IntersectionObserver(([entry]) => { state.visible = entry.isIntersecting; }, { threshold: 0.05 });
    observer.observe(el);
    let raf = 0, previous = performance.now(), lastVideos = '';
    const render = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05); previous = now;
      if (introGate && !introGate.ready) { raf = requestAnimationFrame(render); return; }
      const active = state.visible && !document.hidden && !state.open;
      if (active || state.layoutDirty) {
        state.layoutDirty = false;
        if (active && !gesture.current && !state.focused && !state.paused && !state.reduced) Object.assign(state, advanceOrbit(state.angle, state.velocity, dt, ORBIT.idleSpeed));
        const videos: { id: string; depth: number }[] = [];
        cards.current.forEach((card, i) => {
          if (!card) return;
          const pose = orbitPose(state.angle + i / mediaItems.length * Math.PI * 2, state.width, state.height);
          card.style.transform = `translate3d(${pose.x}px,${pose.y}px,0) translate(-50%,-50%) scale(${pose.scale})`;
          card.style.opacity = String(pose.opacity);
          card.style.zIndex = String(pose.zIndex);
          // Crossfade a pre-blurred poster: no continuously animated CSS filter/paint.
          (card.lastElementChild as HTMLElement).style.opacity = String(pose.blur / 1.6 * 0.8);
          if (mediaItems[i].type === 'video' && pose.opacity > 0.8) videos.push({ id: mediaItems[i].id, depth: pose.opacity });
        });
        const next = !active || state.reduced || state.paused ? '' : videos.sort((a, b) => b.depth - a.depth).slice(0, 2).map(v => v.id).sort().join(',');
        if (next !== lastVideos) { lastVideos = next; setPlayingIds(next ? next.split(',') : []); }
      } else if (lastVideos) { lastVideos = ''; setPlayingIds([]); }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(raf); resize.disconnect(); observer.disconnect(); };
  }, [introGate]);

  function down(e: PointerEvent<HTMLDivElement>) {
    if (introGate && !introGate.ready) return;
    if (!e.isPrimary || e.button !== 0 || engine.current.open || gesture.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('a, button:not(.pk-orbit-card)')) return;
    const now = performance.now();
    gesture.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, start: now, time: now, distance: 0, card: target.closest<HTMLButtonElement>('.pk-orbit-card') };
    engine.current.velocity = 0;
    engine.current.focused = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.dataset.dragging = 'true';
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const now = performance.now(), dx = e.clientX - g.x;
    g.distance = Math.max(g.distance, Math.hypot(e.clientX - g.startX, e.clientY - g.startY));
    if (g.distance > ORBIT.clickDistance) {
      engine.current.angle += dx * ORBIT.dragSensitivity;
      const velocity = dx * ORBIT.dragSensitivity / Math.max((now - g.time) / 1000, 0.008);
      engine.current.velocity = engine.current.velocity * 0.25 + Math.max(-ORBIT.maxVelocity, Math.min(ORBIT.maxVelocity, velocity)) * 0.75;
    }
    g.x = e.clientX; g.time = now;
  }
  function up(e: PointerEvent<HTMLDivElement>, cancelled = false) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    g.distance = Math.max(g.distance, Math.hypot(e.clientX - g.startX, e.clientY - g.startY));
    gesture.current = null;
    e.currentTarget.dataset.dragging = 'false';
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (cancelled || performance.now() - g.time > ORBIT.releaseTimeout) engine.current.velocity = 0;
    if (!cancelled && g.card && isOrbitClick(g.distance, performance.now() - g.start)) {
      const item = mediaItems.find(item => item.id === g.card!.dataset.mediaId)!;
      engine.current.open = true;
      onOpen(item, g.card);
    }
  }
  return <section className="pk-hero" aria-labelledby="pk-hero-title">
    <div className="pk-hero-top pk-eyebrow"><span><i /> INDEPENDENT PIERCING STUDIO</span><a href="/appointment.html">BOOK A SESSION <ArrowUpRight size={14} /></a></div>
    <div className="pk-hero-heading"><p className="pk-eyebrow">Customize your character.</p><h1 id="pk-hero-title">Be fierce.<br /><em>Get pierced.</em></h1></div>
    <div className="pk-orbit" ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={e => up(e, true)} onLostPointerCapture={e => up(e, true)}
      onFocusCapture={e => { engine.current.focused = e.target.matches(':focus-visible'); }} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) engine.current.focused = false; }}
      aria-label="Orbiting studio moodboard. Drag sideways to explore, or tab to a card and press Enter to open.">
      <div className="pk-orbit-guide" aria-hidden="true" />
      <div className="pk-ring-brand"><img src="/logo.png" alt="Punkture Studios" width="190" height="190" draggable={false} /></div>
      {mediaItems.map((item, index) => <button type="button" key={item.id} ref={el => { cards.current[index] = el; }} data-media-id={item.id}
        className="pk-orbit-card" style={{ aspectRatio: item.aspect, '--pk-card-aspect': item.aspect } as CSSProperties} aria-label={`Open ${item.caption}${item.type === 'video' ? ', video' : ''}`}
        onClick={e => { if (e.detail === 0 && (!introGate || introGate.ready)) { engine.current.open = true; onOpen(item, e.currentTarget); } }}>
        <Media item={item} playing={playingIds.includes(item.id) && !open} />
        <span className="pk-card-index">{item.id} / {item.type === 'video' ? '▶' : '↗'}</span>
        <span className="pk-card-caption">{item.caption}</span>
        <span className="pk-depth-blur" aria-hidden="true" style={{ backgroundImage: `url(${mediaPoster(item)})` }} />
      </button>)}
    </div>
    <div className="pk-hero-bottom"><a href="#pk-selected" className="pk-eyebrow">SCROLL TO DISCOVER <ArrowDown size={15} /></a><span className="pk-drag-hint"><MoveHorizontal size={18} /> DRAG TO EXPLORE · TAP TO OPEN</span><button type="button" className="pk-pause" disabled={reduced} onClick={() => setPaused(!paused)} aria-label={reduced ? 'Reduced motion enabled' : paused ? 'Play orbit' : 'Pause orbit'} aria-pressed={paused}>{paused || reduced ? <Play size={13} /> : <Pause size={13} />}<span>{paused || reduced ? 'STILL' : 'IN MOTION'}</span></button></div>
  </section>;
}
