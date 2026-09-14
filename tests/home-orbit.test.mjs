import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { advanceOrbit, isOrbitClick, orbitPose, ORBIT } from '../src/components/home/orbitMath.ts';
import { mediaItems } from '../src/components/home/mediaItems.js';

test('orbit momentum has the same displacement and decay at 30, 60 and 120Hz', () => {
  const step = fps => {
    let state = { angle: 0, velocity: 3 };
    for (let i = 0; i < fps * 2; i++) state = advanceOrbit(state.angle, state.velocity, 1 / fps, ORBIT.idleSpeed);
    return state;
  };
  const baseline = step(60);
  for (const fps of [30, 120]) {
    assert.ok(Math.abs(step(fps).angle - baseline.angle) < 1e-10);
    assert.ok(Math.abs(step(fps).velocity - baseline.velocity) < 1e-10);
  }
  assert.ok(baseline.velocity < 0.006);
});
test('drag, long hold and cancelled-style distances cannot be treated as a tap', () => {
  assert.equal(isOrbitClick(3, 180), true);
  assert.equal(isOrbitClick(8, 120), false);
  assert.equal(isOrbitClick(0, 351), false);
  assert.equal(isOrbitClick(100, 60), false);
});
test('front of the ellipse is larger, clearer and above the rear at phone and desktop sizes', () => {
  for (const [width, height] of [[320, 330], [390, 460], [1440, 560]]) {
    const front = orbitPose(Math.PI / 2, width, height);
    const back = orbitPose(-Math.PI / 2, width, height);
    assert.ok(front.scale > back.scale && front.opacity > back.opacity && front.zIndex > back.zIndex && front.blur < back.blur);
    assert.ok(Number.isFinite(front.x) && Math.abs(front.y) < height / 2);
    const loop = orbitPose(Math.PI / 2 + Math.PI * 2, width, height);
    assert.ok(Math.abs(loop.y - front.y) < 1e-9);
  }
});
test('one manifest covers every supplied portrait reel exactly once, with a local poster', () => {
  assert.equal(mediaItems.length, 12);
  assert.equal(new Set(mediaItems.map(item => item.id)).size, mediaItems.length);
  assert.equal(new Set(mediaItems.map(item => item.src)).size, 12);
  const supplied = readdirSync(new URL('../public/videos/', import.meta.url)).filter(file => file.endsWith('.mp4')).sort();
  assert.deepEqual(mediaItems.map(item => item.src.replace('/videos/', '')).sort(), supplied);
  for (const item of mediaItems) {
    assert.equal(item.type, 'video');
    assert.equal(item.aspect, 9 / 16);
    assert.ok(item.poster.startsWith('/videos/posters/'));
    assert.ok(existsSync(new URL('../public' + item.poster, import.meta.url)));
  }
  for (const index of [0, 2, 8, 6]) assert.equal(mediaItems[index].gallery.type, 'image');
  for (const item of mediaItems) assert.ok(item.src && item.caption && item.aspect > 0);
});

test('front cards and their release momentum follow the horizontal drag direction', () => {
  for (const direction of [-1, 1]) {
    const initial = Math.PI / 2;
    const dragged = initial + direction * 40 * ORBIT.dragSensitivity;
    const pose = orbitPose(dragged, 390, 460);
    assert.equal(Math.sign(pose.x), direction);
    const released = advanceOrbit(dragged, direction * ORBIT.dragSensitivity * 300, 1 / 60, 0);
    assert.equal(Math.sign(orbitPose(released.angle, 390, 460).x - pose.x), direction);
  }
});
