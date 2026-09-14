import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { animate } from 'motion/mini';
import Lenis from 'lenis';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { firestore } from '../firebase';
import { eventDateRange, nextEventSettings } from '../popupEvents';
import type { PublicSettings } from '../types';
import { PublicShell } from './PublicShell';
import { OrbitHero } from './home/OrbitHero';
import { MediaViewer } from './home/MediaViewer';
import { Media } from './home/Media';
import { mediaItems, type MediaItem } from './home/mediaItems.js';
import { startHomeIntro } from './home/homeIntro';
import './home/home.css';

export function HomePage() {
  const [rawSettings, setPublicSettings] = useState<PublicSettings | null>(null);
  const [selected, setSelected] = useState<{ item: MediaItem; source: HTMLButtonElement } | null>(null);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [introDone, setIntroDone] = useState(() => reduced || document.documentElement.dataset.homeIntro === 'ready');
  const introGate = useRef({ ready: introDone });
  const root = useRef<HTMLDivElement>(null);
  const lenis = useRef<Lenis | null>(null);
  const magnetic = useRef<ReturnType<typeof animate> | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const open = useCallback((item: MediaItem, source: HTMLButtonElement) => setSelected({ item, source }), []);
  const publicSettings = nextEventSettings(rawSettings);
  const hasEvent = publicSettings?.eventActive === true && !!publicSettings.eventDate;
  useLayoutEffect(() => startHomeIntro(root.current!, introGate.current, () => setIntroDone(true)), [reduced]);
  useEffect(() => onSnapshot(doc(firestore, 'public', 'public'), snap => setPublicSettings(snap.exists() ? snap.data() as PublicSettings : null), () => setPublicSettings(null)), []);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (reduced || !introDone) return;
    const scroll = new Lenis({ lerp: 0.085, smoothWheel: true, syncTouch: false, anchors: true });
    lenis.current = scroll;
    if (document.body.style.overflow === 'hidden') scroll.stop();
    let frame = 0;
    const tick = (time: number) => { scroll.raf(time); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    // The existing navigation owns its body lock. Respect it without modifying the shared shell.
    const locks = new MutationObserver(() => { if (document.body.style.overflow === 'hidden') scroll.stop(); else scroll.start(); });
    locks.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    return () => { cancelAnimationFrame(frame); locks.disconnect(); scroll.destroy(); lenis.current = null; };
  }, [reduced, introDone]);
  useEffect(() => {
    if (selected || document.body.style.overflow === 'hidden') lenis.current?.stop(); else lenis.current?.start();
  }, [selected, introDone]);
  useEffect(() => {
    if (!introDone) return;
    const nodes = root.current!.querySelectorAll<HTMLElement>('[data-reveal]');
    if (reduced) { nodes.forEach(node => { node.style.opacity = '1'; node.style.transform = 'none'; }); return; }
    const animations: ReturnType<typeof animate>[] = [];
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target as HTMLElement;
      animations.push(animate(el, { opacity: [0, 1], transform: ['translateY(36px)', 'translateY(0px)'] }, { duration: 0.9, delay: Number(el.dataset.reveal || 0) * 0.1, ease: [0.16, 1, 0.3, 1] }));
      observer.unobserve(el);
    }), { threshold: 0.12 });
    nodes.forEach(node => { node.style.opacity = '0'; observer.observe(node); });
    return () => { observer.disconnect(); animations.forEach(animation => animation.stop()); magnetic.current?.stop(); };
  }, [reduced, introDone]);
  useEffect(() => { if (introDone) lenis.current?.resize(); }, [introDone]);
  return <PublicShell page="home"><div ref={root} className="pk-home">
    <div className="pk-grain" aria-hidden="true" />
    <OrbitHero introGate={introGate.current} onOpen={open} open={!!selected} reduced={reduced} />
    <div className="pk-status-strip"><span className="pk-eyebrow"><i /> YOUR NEXT CHAPTER STARTS HERE</span><a href={hasEvent ? '/popup.html' : '/appointment.html'}>{hasEvent ? `${publicSettings.eventTitle || 'Next pop-up'} — ${eventDateRange(publicSettings)}` : 'Private studio sessions · By appointment'}<ArrowUpRight size={17} /></a></div>
    <section className="pk-intro pk-section" id="pk-selected">
      <p className="pk-eyebrow" data-reveal="0">01 / THE PUNKTURE PERSPECTIVE</p>
      <div><h2 data-reveal="1">Life’s an RPG.<br />Never skip character creation.</h2><div className="pk-intro-bottom" data-reveal="2"><span className="pk-asterisk" aria-hidden="true">✳</span><div><p className="pk-intro-statement"><strong>Piercings are your IRL character customization.</strong></p><p>A quiet statement. A bold beginning. A little piece of who you are.</p></div><div className="pk-intro-actions"><a href="/appointment.html" className="pk-text-link"><strong>Start your build →</strong></a><a href="https://maps.app.goo.gl/4dPsJAiQHDwJxVsM6" target="_blank" rel="noopener noreferrer" className="pk-text-link">Punkture Point <ArrowUpRight size={18} /></a></div></div></div>
    </section>
    <section className="pk-gallery pk-section" aria-labelledby="pk-gallery-title">
      <div className="pk-section-heading" data-reveal="0"><h2 id="pk-gallery-title" className="pk-eyebrow">PIERCING GUIDES & RATES / 001—004</h2><span className="pk-eyebrow">PIERCING, IN YOUR OWN WAY</span></div>
      <div className="pk-editorial-grid">
        {[mediaItems[0], mediaItems[2], mediaItems[8], mediaItems[6]].map(item => item.gallery!).map((item, i) => <figure className={`pk-study pk-study-${i + 1}`} key={`${item.id}-gallery`} data-reveal={i % 2}>
          <button type="button" style={{ aspectRatio: item.aspect }} onClick={e => open(item, e.currentTarget)} aria-label={`View ${item.caption}`}>{introDone && <Media item={item} />}</button>
          <figcaption><span><small>0{i + 1} / {i < 2 ? 'PLACEMENT GUIDE' : 'RATE CARD'}</small>{item.caption}</span><span>VIEW ↗</span></figcaption>
        </figure>)}
      </div><p className="pk-placeholder-note">Tap a guide or rate card to view it in full.</p>
    </section>
    <div className="pk-marquee" aria-label="Your body. Your story. Your expression."><div aria-hidden="true">{[0, 1].map(i => <span key={i}>YOUR BODY. <b>✳</b> YOUR STORY. <b>✳</b> YOUR EXPRESSION. <b>✳</b> </span>)}</div></div>
    <section className="pk-care pk-section"><div data-reveal="0"><p className="pk-eyebrow">02 / GOOD ENERGY. CONSIDERED CARE.</p><h2>A little edge.<br /><em>A lot of care.</em></h2></div><div className="pk-care-links" data-reveal="1">{[
      ['01', 'Before the moment', 'Everything to know before your session.', '/waiver.html'],
      ['02', 'After the sparkle', 'Give your new piercing the care it deserves.', '/aftercare.html'],
      ['03', 'Out in the world', 'Find the next Punkture pop-up.', '/popup.html'],
      ['04', 'Your place in line', 'Follow the live studio queue.', '/live.html'],
    ].map(([n, title, description, href]) => <a href={href} key={n}><small>{n}</small><span><strong>{title}</strong><p>{description}</p></span><ArrowUpRight size={22} /></a>)}</div></section>
    <section className="pk-footer-cta pk-section"><p className="pk-eyebrow" data-reveal="0"><i /> A NEW CHAPTER LOOKS GOOD ON YOU</p><h2 data-reveal="1">Make it<br /><em>personal.</em></h2><a className="pk-magnetic" href="/appointment.html"
      onPointerMove={e => { if (reduced || e.pointerType !== 'mouse') return; const el = e.currentTarget, rect = el.getBoundingClientRect(); magnetic.current?.stop(); magnetic.current = animate(el, { transform: `translate(${(e.clientX - rect.left - rect.width / 2) * 0.13}px, ${(e.clientY - rect.top - rect.height / 2) * 0.13}px)` }, { duration: 0.3, ease: [0.16, 1, 0.3, 1] }); }}
      onPointerLeave={e => { magnetic.current?.stop(); magnetic.current = animate(e.currentTarget, { transform: 'translate(0px, 0px)' }, { duration: 0.5, ease: [0.16, 1, 0.3, 1] }); }}>BOOK YOUR SESSION <ArrowUpRight size={26} /></a>
      <div className="pk-footer-meta"><a href="https://www.instagram.com/punkture_studios/" target="_blank" rel="noopener noreferrer">FOLLOW THE STUDIO <ArrowRight size={15} /></a><span>STERILE. CONSIDERED. UNIQUELY YOU.</span><a href="#public-content">BACK TO TOP ↑</a></div>
    </section>
    {selected && <MediaViewer {...selected} reduced={reduced} onClose={close} />}
  </div></PublicShell>;
}
