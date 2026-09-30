import { test, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RITUAL_CONFIG } from '../src/components/ritualConfig.ts';
import { Forceps } from '../src/components/ForcepsSprite.tsx';
import { FORCEPS_BOX } from '../src/components/forcepsGeometry.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5185/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Image = dom.window.Image;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const { createRoot } = await import('react-dom/client');
const { PiercingRitualAnimation } = await import('../src/components/PiercingRitualAnimation.tsx');

let root, container;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = null; });
afterEach(async () => { if (root) await act(async () => root.unmount()); container.remove(); });
after(() => dom.window.close());

/** Show one frozen moment of the loop (?t= is read when the component mounts, so mount it fresh). */
async function frame(t) {
  if (root) await act(async () => root.unmount());
  dom.reconfigure({ url: `http://localhost:5185/?t=${t}` });
  root = createRoot(container);
  await act(async () => root.render(React.createElement(PiercingRitualAnimation)));
  return container;
}
/** Angles of the two arms of every forceps on the stage: [back arm, front arm]. */
const armAngles = () => [...container.querySelectorAll('svg')].map(svg => {
  const groups = [...svg.querySelectorAll(':scope > g[transform]')];
  return groups.map(g => Number(/rotate\((-?[\d.]+)/.exec(g.getAttribute('transform'))[1]));
});

test('forceps arms are rigid: opening swings both arms symmetrically and closing brings them to 0', () => {
  const html = open => renderToStaticMarkup(React.createElement(Forceps, { open, openAngle: 22 }));
  const angles = markup => [...markup.matchAll(/<g transform="rotate\((-?[\d.]+)\)/g)].map(m => Number(m[1]));
  assert.deepEqual(angles(html(1)), [-22, 22], 'back arm swings one way, front arm the other');
  assert.deepEqual(angles(html(0)), [0, 0], 'closed: both arms upright');
  assert.deepEqual(angles(html(0.5)), [-11, 11]);
  assert.deepEqual(angles(html(-3)).map(Math.abs), [0, 0], 'never swings past closed');
  assert.match(html(1), /scale\(-1 1\)/, 'the back arm is the mirrored copy of the front arm');
  assert.doesNotMatch(html(0.5), /gold-/, 'no stud unless it is being carried');
  assert.match(renderToStaticMarkup(React.createElement(Forceps, { open: 0.06, openAngle: 22, stud: true })), /gold-/);
});

test('the jaw window (where the ear is gripped) sits inside the drawing so the tool rotates around it', () => {
  assert.ok(FORCEPS_BOX.anchor.x > 0 && FORCEPS_BOX.anchor.x < FORCEPS_BOX.width);
  assert.ok(FORCEPS_BOX.anchor.y > 0 && FORCEPS_BOX.anchor.y < FORCEPS_BOX.height / 4, 'near the jaw tips at the top');
  assert.ok(FORCEPS_BOX.height < 105 && FORCEPS_BOX.width < 90, 'compact next to the 230px avatar');
});

test('tool sprites are tightly cropped, match their configured size and stay tiny for phones', () => {
  let total = 0;
  for (const [name, spec] of Object.entries(RITUAL_CONFIG.tools)) {
    if (!('src' in spec)) continue;
    assert.match(spec.src, /^\/animations\/v\d+\//,`${name} sprite is in a versioned folder, so a cached old picture can never pair with new size numbers`);
    const file = `public${spec.src}`;
    const png = readFileSync(file);
    assert.equal(png.readUInt32BE(16), spec.naturalWidth, `${name} width`);
    assert.equal(png.readUInt32BE(20), spec.naturalHeight, `${name} height`);
    assert.ok(spec.anchor.x >= 0 && spec.anchor.x <= spec.naturalWidth && spec.anchor.y >= 0 && spec.anchor.y <= spec.naturalHeight, `${name} anchor inside the image`);
    assert.ok(spec.displayHeight <= 160, `${name} is small on the stage (${spec.displayHeight}px)`);
    assert.ok(spec.naturalHeight >= spec.displayHeight * 2.5, `${name} keeps 3x detail for phone screens`);
    total += statSync(file).size;
  }
  assert.ok(total < 100 * 1024, `all tool sprites together are ${total} bytes (was about 2.1 MB)`);
});

test('forceps enter open, swing shut around the ear, hold for the needle and reopen to release the stud', async () => {
  await frame(7.4);
  assert.equal(container.querySelectorAll('svg').length, 0, 'no forceps before they arrive');
  await frame(8.1);
  assert.deepEqual(armAngles(), [[-22, 22]], 'open when they reach the ear');
  await frame(8.55);
  const [[back, front]] = armAngles();
  assert.ok(front > 2 && front < 20 && Math.abs(back + front) < 1e-9, `closing smoothly (${front}°)`);
  await frame(9.3);
  assert.deepEqual(armAngles(), [[0, 0]], 'shut and holding');
  await frame(10.1);
  assert.ok(container.querySelector('img[alt="Piercing Needle"]'), 'needle passes while the forceps hold');
  assert.deepEqual(armAngles(), [[0, 0]], 'still closed at needle contact');
  await frame(11.4);
  const carried = container.querySelectorAll('svg');
  assert.equal(carried.length, 1);
  assert.match(carried[0].innerHTML, /gold-/, 'jewel forceps carry the stud');
  await frame(12.1);
  const [[openBack, openFront]] = armAngles();
  assert.ok(openFront > 15 && openBack === -openFront, `opening (${openFront}°)`);
  assert.doesNotMatch(container.querySelector('svg').innerHTML, /gold-/, 'stud released onto the ear');
  await frame(13.6);
  assert.equal(container.querySelectorAll('svg').length, 0, 'forceps are gone for the reveal');
});

test('the whole loop runs a little slower than the raw timeline', () => {
  const { pace } = RITUAL_CONFIG.durations;
  assert.ok(pace >= 1.2 && pace <= 1.4, `pace ${pace}`);
  assert.ok(RITUAL_CONFIG.durations.total * pace > 18, 'the loop is about 19 real seconds');
});

test('no stale clamp pictures are requested and the wait phase is labelled idle', async () => {
  await frame(14.7);
  assert.equal(container.querySelectorAll('img[alt^="Clamp"], img[alt^="Opening"], img[alt^="Forceps"]').length, 0);
  assert.match(container.textContent, /IDLE/);
  await frame(13.4);
  assert.match(container.textContent, /REVEAL/);
});
