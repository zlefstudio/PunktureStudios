import { mediaItems } from './mediaItems.js';
import { INTRO, introCard, introProgress, introTransform, settle, type IntroGate } from './introTimeline';
import { preloadFirstMedia } from './preloadFirstMedia';

/** Single master timeline; the orbit engine cannot write while gate.ready is false. */
export function startHomeIntro(root: HTMLElement, gate: IntroGate, onComplete: () => void) {
  const html = document.documentElement;
  const boot = document.getElementById('pk-boot');
  const curtain = boot?.querySelector<HTMLElement>('.pk-boot-curtain');
  const mark = boot?.querySelector<HTMLElement>('.pk-boot-mark');
  const halo = boot?.querySelector<HTMLElement>('.pk-boot-halo');
  const stage = root.querySelector<HTMLElement>('.pk-orbit')!;
  const logo = root.querySelector<HTMLElement>('.pk-ring-brand')!;
  const cards = [...root.querySelectorAll<HTMLElement>('.pk-orbit-card')];
  const grain = root.querySelector<HTMLElement>('.pk-grain')!;
  const guide = root.querySelector<HTMLElement>('.pk-orbit-guide')!;
  const shell = root.closest('.public-shell')!;
  const header = shell.querySelector<HTMLElement>('.public-header')!.parentElement!;
  const chrome = [
    shell.querySelector<HTMLElement>('.public-brand')!,
    shell.querySelector<HTMLElement>('.public-menu-toggle')!,
    ...root.querySelectorAll<HTMLElement>('.pk-hero-top > *, .pk-hero-heading > *'),
  ];
  const bottom = [...root.querySelectorAll<HTMLElement>('.pk-hero-bottom > *')];
  const abort = new AbortController();
  let alive = true, finished = false, frame = 0, start = 0;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let width = stage.clientWidth, height = stage.clientHeight;
  let logoX = 0, logoY = 0, logoScale = 1;
  const setActor = (el: HTMLElement, progress: number, offset = 20) => {
    const eased = settle(progress);
    el.style.opacity = String(eased);
    el.style.transform = `translate3d(0,${(1 - eased) * offset}px,0)`;
  };
  const render = (time: number) => {
    cards.forEach((card, index) => {
      const pose = introCard(index, cards.length, width, height, time);
      card.style.transform = introTransform(pose);
      card.style.opacity = String(pose.opacity);
      card.style.zIndex = String(pose.zIndex);
      (card.lastElementChild as HTMLElement).style.opacity = String(pose.blurOpacity);
    });
    if (curtain) curtain.style.opacity = String(1 - settle(introProgress(time, 0, INTRO.stageDuration)));
    const progress = settle(introProgress(time, 0, INTRO.logoDuration));
    if (mark) mark.style.transform = `translate(-50%,-50%) translate3d(${logoX * progress}px,${logoY * progress}px,0) scale(${1 + (logoScale - 1) * progress}) rotate(${-14 * Math.sin(progress * Math.PI)}deg)`;
    if (halo) halo.style.opacity = String(1 - progress);
    guide.style.opacity = String(settle(introProgress(time, 0.4, 1)));
    setActor(header, introProgress(time, INTRO.headerStart, INTRO.chromeDuration), 0);
    chrome.forEach((el, i) => setActor(el, introProgress(time, INTRO.headerStart + i * INTRO.chromeStagger, INTRO.chromeDuration)));
    bottom.forEach((el, i) => setActor(el, introProgress(time, INTRO.bottomStart + i * 0.07, INTRO.chromeDuration), 14));
    grain.style.opacity = String(0.035 * introProgress(time, INTRO.grainStart, 0.7));
  };
  const restoreScroll = () => {
    if (html.dataset.homeScrollRestoration) {
      history.scrollRestoration = html.dataset.homeScrollRestoration as ScrollRestoration;
      delete html.dataset.homeScrollRestoration;
    }
  };
  const events = ['pointerdown', 'click', 'wheel', 'touchstart', 'keydown', 'scroll', 'pk:intro-skip'] as const;
  const detach = () => {
    events.forEach(event => window.removeEventListener(event, interrupt, true));
    window.removeEventListener('resize', resize);
    window.removeEventListener('pagehide', interrupt);
  };
  const finish = () => {
    if (!alive || finished) return;
    finished = true;
    cancelAnimationFrame(frame); clearTimeout(watchdog); abort.abort(); detach();
    width = stage.clientWidth; height = stage.clientHeight;
    render(INTRO.duration);
    logo.style.opacity = '1';
    if (boot) boot.hidden = true;
    html.dataset.homeIntro = 'ready';
    root.setAttribute('aria-busy', 'false');
    gate.ready = true; // Synchronous: this same pointer event can now reach the orbit handler.
    restoreScroll();
    onComplete();
  };
  function interrupt(event?: Event) { if (event?.type === 'scroll' && window.scrollY === 0) return; finish(); }
  function resize() { finish(); }
  const tick = (now: number) => {
    if (!alive || finished) return;
    if (!start) start = now;
    const time = (now - start) / 1000;
    render(time);
    if (time >= INTRO.duration) finish();
    else frame = requestAnimationFrame(tick);
  };
  if (gate.ready && html.dataset.homeIntro === 'ready') {
    // A later preference change must not reset an orbit the visitor has already spun.
    logo.style.opacity = '1';
    if (boot) boot.hidden = true;
    root.setAttribute('aria-busy', 'false');
    restoreScroll(); onComplete();
    return () => { alive = false; };
  }
  if (gate.ready || window.matchMedia('(prefers-reduced-motion: reduce)').matches || html.dataset.homeIntro === 'ready') {
    finish();
    return () => { alive = false; };
  }
  gate.ready = false;
  // Reset old scroll restoration under the black curtain; explicit user input is never cancelled.
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (boot) boot.hidden = false;
  if (mark) mark.style.transform = 'translate(-50%,-50%)';
  if (curtain) curtain.style.opacity = '1';
  if (halo) halo.style.opacity = '1';
  logo.style.opacity = '0';
  const logoRect = logo.getBoundingClientRect();
  logoX = logoRect.left + logoRect.width / 2 - innerWidth / 2;
  logoY = logoRect.top + logoRect.height / 2 - innerHeight / 2;
  logoScale = logoRect.width / 96;
  root.setAttribute('aria-busy', 'true');
  render(0);
  html.dataset.homeIntro = 'pending';
  events.forEach(event => window.addEventListener(event, interrupt, { capture: true, passive: true }));
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pagehide', interrupt);
  // The wall-clock failsafe also releases the page if RAF is suspended in a background tab.
  watchdog = setTimeout(finish, INTRO.preloadCapMs + INTRO.duration * 1000 + 250);
  void preloadFirstMedia(mediaItems[0], abort.signal).then(result => {
    if (!alive || finished || result === 'aborted') return;
    html.dataset.homeIntro = 'revealing';
    frame = requestAnimationFrame(tick);
  });
  return () => {
    alive = false; cancelAnimationFrame(frame); clearTimeout(watchdog); abort.abort(); detach();
    // StrictMode's next setup starts from the same seed and measurements, never an old timeline.
  };
}
