import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ritualMotion, excitement, RITUAL_LOOP } from '../src/components/ritualMotion.ts';

const KEYS = ['x', 'y', 'rot', 'scaleX', 'scaleY', 'shadowScale', 'shadowOpacity'];

test('avatar reactions loop smoothly and include a bounded recoil at needle contact', () => {
  for (const key of KEYS) assert.ok(Math.abs(ritualMotion(0)[key] - ritualMotion(RITUAL_LOOP)[key]) < 1e-9, `${key} matches across the loop seam`);
  assert.ok(Math.abs(ritualMotion(RITUAL_LOOP - 0.0001).y - ritualMotion(0).y) < .01);
  assert.ok(ritualMotion(5.05).scaleY < 1);
  assert.ok(ritualMotion(10.07).x < -3);
  assert.ok(ritualMotion(10.07).rot < -2);
  assert.ok(Math.abs(ritualMotion(10.7).rot) < 1e-9);
  assert.ok(ritualMotion(13.275).y < -5);
  for (let t = 0; t < RITUAL_LOOP; t += .01) {
    const m = ritualMotion(t);
    for (const key of KEYS) assert.ok(Number.isFinite(m[key]), `${key} at ${t}`);
    assert.ok(m.scaleY >= .93 && m.scaleY <= 1.04, `scaleY ${m.scaleY} at ${t}`);
    assert.ok(m.scaleX >= .97 && m.scaleX <= 1.04, `scaleX ${m.scaleX} at ${t}`);
  }
});

test('no frame-to-frame jump, so the avatar never pops at 60fps', () => {
  let previous = ritualMotion(0);
  for (let t = 1 / 60; t <= RITUAL_LOOP; t += 1 / 60) {
    const m = ritualMotion(t);
    assert.ok(Math.abs(m.x - previous.x) < 1, `x jump at ${t.toFixed(3)}`);
    assert.ok(Math.abs(m.y - previous.y) < 1.5, `y jump at ${t.toFixed(3)}`);
    assert.ok(Math.abs(m.rot - previous.rot) < 1, `rotation jump at ${t.toFixed(3)}`);
    assert.ok(Math.abs(m.scaleY - previous.scaleY) < .03, `scale jump at ${t.toFixed(3)}`);
    previous = m;
  }
});

test('avatar is excited while waiting for tools and completely steady once a tool is at the ear', () => {
  // Waiting: the last 1.2s of the loop and the first 1.5s of the next one.
  for (const t of [14.6, 15.0, 0.3, 0.9, 1.2]) assert.ok(excitement(t).weight > .9, `excited at ${t}`);
  // The swab is gliding in from 1.5s and lands at 2.0s; the avatar has settled before it touches.
  assert.ok(excitement(1.7).weight < .3);
  assert.equal(excitement(1.9).weight, 0);
  // Every tool contact window is still: swab, marker, mirror, forceps (with the needle) and jewel.
  for (const [from, to] of [[2.0, 2.8], [4.15, 4.55], [6.1, 6.85], [8.1, 11.0], [11.5, 12.4]]) {
    for (let t = from; t <= to; t += .01) assert.equal(excitement(t).weight, 0, `steady at ${t.toFixed(2)}`);
  }
  // Short waits between tools get a smaller perk, then settle before the next tool arrives.
  assert.ok(excitement(3.35).weight > .4 && excitement(3.35).weight < 1);
  assert.equal(excitement(4.15).weight, 0);
  assert.equal(excitement(7.25).weight, 0, 'the gap after the mirror is a nod, not a bounce');
  assert.equal(excitement(8.0).weight, 0);
});

test('the avatar nods "yes" after the mirror just like after the marker, and is still before the forceps land', () => {
  const dip = t => ritualMotion(t).scaleY;
  for (const start of [4.65, 6.95]) {
    assert.ok(dip(start + .22) < .96, `first nod at ${start}`);
    assert.ok(dip(start + .66) < .98, `softer second nod at ${start}`);
    assert.ok(ritualMotion(start + .22).y > 3, 'dips down');
  }
  assert.equal(dip(6.94) > .99, true);
  assert.ok(Math.abs(ritualMotion(7.85).y - ritualMotion(7.85).y) === 0);
  for (let t = 7.8; t <= 8.3; t += .01) assert.ok(Math.abs(ritualMotion(t).scaleY - 1) < .03, `settled by ${t.toFixed(2)}`);
});

test('waiting is a soft vertical bounce only: no tilt, sway or head-shake, and a small, slow rhythm', () => {
  const windows = [[14.4, RITUAL_LOOP], [0, 1.4], [3.1, 3.7]];
  let top = 0, bottom = 0;
  for (const [from, to] of windows) for (let t = from; t <= to; t += .01) {
    const m = ritualMotion(t);
    assert.equal(m.rot, 0, `no tilt at ${t.toFixed(2)}`);
    assert.equal(m.x, 0, `no sideways sway at ${t.toFixed(2)}`);
    top = Math.min(top, m.y); bottom = Math.max(bottom, m.y);
  }
  assert.ok(top < -3 && top > -8, `bounce height ${top}`);
  assert.ok(bottom < 3, `stays near the floor ${bottom}`);
  // Smooth landing: vertical speed is near zero when the bounce touches down.
  let slowest = Infinity;
  for (let t = 14.5; t < 15.1; t += .005) slowest = Math.min(slowest, Math.abs(ritualMotion(t + .005).y - ritualMotion(t).y));
  assert.ok(slowest < .002, 'eases in and out of the floor');
});
