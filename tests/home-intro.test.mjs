import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { INTRO, INTRO_ANGLE, introCard, introTransform } from '../src/components/home/introTimeline.ts';
import { orbitPose } from '../src/components/home/orbitMath.ts';
import { startHomeIntro } from '../src/components/home/homeIntro.ts';
import { preloadFirstMedia } from '../src/components/home/preloadFirstMedia.ts';

function fixture({ loaded = true, reduced = false } = {}) {
  const dom = new JSDOM(`<html data-home-intro="pending"><body><div id="pk-boot"><div class="pk-boot-curtain"></div><div class="pk-boot-mark"><span class="pk-boot-halo"></span></div></div><div class="public-shell"><div><div class="public-header"><a class="public-brand"></a><button class="public-menu-toggle"></button></div></div><div class="pk-home"><div class="pk-grain"></div><div class="pk-hero-top"><span></span><a></a></div><div class="pk-hero-heading"><p></p><h1></h1></div><div class="pk-orbit"><div class="pk-ring-brand"></div><div class="pk-orbit-guide"></div>${Array.from({ length: 12 }, () => '<button class="pk-orbit-card"><span></span></button>').join('')}</div><div class="pk-hero-bottom"><a></a><span></span><button></button></div></div></div></body></html>`, { url: 'http://localhost/home.html' });
  const frames = new Map();
  let id = 0;
  const requests = [];
  class FakeImage {
    decode() { return Promise.resolve(); }
    set src(value) { requests.push(value); if (loaded) queueMicrotask(() => this.onload?.()); }
  }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, history: dom.window.history, innerWidth: 1000, innerHeight: 800, Image: FakeImage, HTMLVideoElement: dom.window.HTMLVideoElement,
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; }, cancelAnimationFrame: key => frames.delete(key) });
  dom.window.HTMLMediaElement.prototype.load = () => {};
  Object.defineProperty(dom.window.HTMLVideoElement.prototype, 'src', {
    configurable: true,
    get() { return ''; },
    set(value) { requests.push(value); if (loaded) queueMicrotask(() => this.onloadeddata?.()); },
  });
  dom.window.matchMedia = () => ({ matches: reduced });
  dom.window.scrollTo = () => {};
  const root = document.querySelector('.pk-home'), stage = root.querySelector('.pk-orbit');
  Object.defineProperties(stage, { clientWidth: { value: 1000 }, clientHeight: { value: 420 } });
  root.querySelector('.pk-ring-brand').getBoundingClientRect = () => ({ left: 420, top: 340, width: 160, height: 160 });
  return { dom, root, requests, frames, frame: time => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)); }, close: () => dom.window.close() };
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

test('intro is deterministic on reload and lands exactly on every orbit slot, including 14 cards', () => {
  for (const [width, height] of [[320, 330], [390, 460], [1440, 600]]) {
    for (const count of [10, 12, 14]) for (let i = 0; i < count; i++) {
      const start = introCard(i, count, width, height, 0);
      assert.equal(start.opacity, 0);
      assert.equal(introTransform(start), introTransform(introCard(i, count, width, height, 0)));
      const end = introCard(i, count, width, height, INTRO.duration);
      const expected = orbitPose(INTRO_ANGLE + i / count * Math.PI * 2, width, height);
      for (const key of ['x', 'y', 'opacity', 'scale', 'zIndex']) assert.equal(end[key], expected[key]);
      assert.equal(end.rotation, 0);
    }
  }
});

test('master timeline preloads only one item, reveals, then hands off exactly once', async () => {
  const f = fixture(), gate = { ready: false }; let completions = 0;
  const dispose = startHomeIntro(f.root, gate, () => completions++);
  try {
    assert.equal(gate.ready, false);
    assert.equal(f.root.getAttribute('aria-busy'), 'true');
    assert.equal(document.documentElement.dataset.homeIntro, 'pending');
    await flush();
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0], '/videos/posters/1.jpg', 'intro never downloads a disposable video');
    assert.equal(document.documentElement.dataset.homeIntro, 'revealing');
    f.frame(100); f.frame(750);
    assert.equal(gate.ready, false);
    assert.ok(Number(f.root.querySelector('.pk-orbit-card').style.opacity) > 0);
    f.frame(100 + INTRO.duration * 1000);
    assert.equal(gate.ready, true);
    assert.equal(document.getElementById('pk-boot').hidden, true);
    assert.equal(f.root.getAttribute('aria-busy'), 'false');
    assert.equal(completions, 1);
    window.dispatchEvent(new window.Event('wheel'));
    assert.equal(completions, 1);
    assert.equal(f.frames.size, 0);
  } finally { dispose(); f.close(); }
});

test('all input types fast-forward synchronously during loading and convergence, with no hidden actors', async () => {
  for (const loaded of [false, true]) for (const type of ['pointerdown', 'click', 'wheel', 'touchstart', 'keydown', 'pk:intro-skip', 'resize']) {
    const f = fixture({ loaded }), gate = { ready: false }; let completions = 0;
    const dispose = startHomeIntro(f.root, gate, () => completions++);
    try {
      if (loaded) { await flush(); f.frame(100); f.frame(450); }
      window.dispatchEvent(new window.Event(type));
      assert.equal(gate.ready, true, type);
      assert.equal(completions, 1);
      assert.equal(document.documentElement.dataset.homeIntro, 'ready');
      assert.equal(f.root.querySelector('.pk-ring-brand').style.opacity, '1');
      assert.equal(f.root.querySelector('.pk-hero-bottom a').style.opacity, '1');
      const pose = orbitPose(INTRO_ANGLE, 1000, 420);
      assert.equal(Number(f.root.querySelector('.pk-orbit-card').style.opacity), pose.opacity);
      await flush();
      assert.equal(f.frames.size, 0, 'late asset completion cannot restart an interrupted timeline');
    } finally { dispose(); f.close(); }
  }
});

test('StrictMode cleanup invalidates old preload/timeline callbacks, and reduced motion skips preload', async () => {
  const f = fixture();
  let completions = 0; const gate = { ready: false };
  const first = startHomeIntro(f.root, gate, () => completions++);
  first();
  const second = startHomeIntro(f.root, gate, () => completions++);
  await flush(); f.frame(100); f.frame(2300);
  assert.equal(completions, 1);
  second(); f.close();
  const reduced = fixture({ reduced: true });
  const reducedGate = { ready: false };
  const stop = startHomeIntro(reduced.root, reducedGate, () => {});
  assert.equal(reducedGate.ready, true);
  assert.equal(reduced.requests.length, 0);
  assert.equal(reduced.frames.size, 0);
  stop(); reduced.close();
});

test('first-media preload fails open at the hard cap and on abort', async t => {
  const f = fixture({ loaded: false });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const pending = preloadFirstMedia({ type: 'image', src: '/first.svg' }, new AbortController().signal);
    t.mock.timers.tick(INTRO.preloadCapMs);
    assert.equal(await pending, 'timeout');
    const abort = new AbortController();
    const cancelled = preloadFirstMedia({ type: 'image', src: '/first.svg' }, abort.signal);
    abort.abort();
    assert.equal(await cancelled, 'aborted');
  } finally { t.mock.timers.reset(); f.close(); }
});

test('suspended animation frames still release the page through the wall-clock failsafe', async t => {
  const f = fixture(), gate = { ready: false };
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dispose = startHomeIntro(f.root, gate, () => {});
  try {
    await flush();
    assert.equal(document.documentElement.dataset.homeIntro, 'revealing');
    t.mock.timers.tick(INTRO.preloadCapMs + INTRO.duration * 1000 + 250);
    assert.equal(gate.ready, true);
    assert.equal(f.frames.size, 0);
    assert.equal(document.getElementById('pk-boot').hidden, true);
  } finally { dispose(); t.mock.timers.reset(); f.close(); }
});

test('later preference changes do not reset an already interactive orbit', () => {
  const f = fixture({ reduced: true });
  document.documentElement.dataset.homeIntro = 'ready';
  const card = f.root.querySelector('.pk-orbit-card');
  card.style.transform = 'translate3d(42px, 10px, 0px)';
  const pose = card.style.transform;
  const stop = startHomeIntro(f.root, { ready: true }, () => {});
  assert.equal(card.style.transform, pose);
  assert.equal(f.requests.length, 0);
  stop(); f.close();
});
