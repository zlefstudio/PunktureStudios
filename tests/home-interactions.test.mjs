import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { OrbitHero } from '../src/components/home/OrbitHero.tsx';

test('mouse, touch and pen support tap, captured drag, release momentum and cancellation', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/home.html' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  let nextFrame, nextId = 0;
  globalThis.requestAnimationFrame = callback => { nextFrame = callback; return ++nextId; };
  globalThis.cancelAnimationFrame = () => { nextFrame = null; };
  globalThis.ResizeObserver = class { constructor(callback) { this.callback = callback; } observe() { this.callback([{ contentRect: { width: 390, height: 460 } }]); } disconnect() {} };
  globalThis.IntersectionObserver = class { constructor(callback) { this.callback = callback; } observe() { this.callback([{ isIntersecting: true }]); } disconnect() {} };
  dom.window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  dom.window.HTMLMediaElement.prototype.pause = () => {};
  const captures = new Set();
  dom.window.HTMLElement.prototype.setPointerCapture = id => captures.add(id);
  dom.window.HTMLElement.prototype.hasPointerCapture = id => captures.has(id);
  dom.window.HTMLElement.prototype.releasePointerCapture = id => captures.delete(id);
  Object.defineProperty(dom.window.document, 'hidden', { value: false });
  const root = createRoot(document.getElementById('root'));
  const opened = [];
  let time = performance.now();
  const frame = async () => { time += 16.667; await act(async () => nextFrame?.(time)); };
  const pointer = async (target, type, pointerType, x, y = 100) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: pointerType }, isPrimary: { value: true } });
    await act(async () => target.dispatchEvent(event));
  };
  try {
    for (const type of ['mouse', 'touch', 'pen']) {
      await act(async () => root.render(React.createElement(OrbitHero, { key: type, open: false, reduced: false, onOpen: item => opened.push(item.id) })));
      await frame();
      const stage = document.querySelector('.pk-orbit'), card = document.querySelector('.pk-orbit-card');
      const startCount = opened.length;
      await pointer(card, 'pointerdown', type, 60);
      await pointer(stage, 'pointermove', type, 155);
      await pointer(stage, 'pointermove', type, 225);
      await pointer(stage, 'pointerup', type, 225);
      assert.equal(opened.length, startCount, `${type}: drag must not open a card`);
      assert.equal(captures.size, 0);
      await frame(); const pose = card.style.transform;
      await frame(); assert.notEqual(card.style.transform, pose, `${type}: orbit continues after release`);
      await pointer(card, 'pointerdown', type, 60);
      await pointer(stage, 'pointercancel', type, 60);
      assert.equal(opened.length, startCount, `${type}: cancelled touch never opens`);
      await pointer(card, 'pointerdown', type, 60);
      await pointer(stage, 'pointerup', type, 61);
      assert.equal(opened.length, startCount + 1, `${type}: tap opens the card`);
    }
    await act(async () => root.render(React.createElement(OrbitHero, { key: 'reduced', open: false, reduced: true, onOpen: item => opened.push(item.id) })));
    await frame();
    const staticPose = document.querySelector('.pk-orbit-card').style.transform;
    await frame(); await frame();
    assert.equal(document.querySelector('.pk-orbit-card').style.transform, staticPose, 'reduced motion has no auto rotation');
    assert.equal(document.querySelectorAll('video').length, 0, 'reduced motion does not load or autoplay films');
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
