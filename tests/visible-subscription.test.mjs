import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whilePageVisible } from '../src/visibleSubscription.ts';

test('public listeners keep short switches, detach when hidden, reconnect once, and clean up', t => {
  const events = new EventTarget();
  globalThis.document = events;
  events.hidden = false;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let starts = 0, stops = 0, resumes = 0;
  const dispose = whilePageVisible(() => { starts++; return () => stops++; }, () => resumes++);
  const hidden = value => { events.hidden = value; events.dispatchEvent(new Event('visibilitychange')); };
  hidden(true); t.mock.timers.tick(1000); hidden(false);
  assert.equal(starts, 1); assert.equal(stops, 0);
  hidden(true); t.mock.timers.tick(30000);
  assert.equal(stops, 1);
  hidden(false); hidden(false);
  assert.equal(starts, 2); assert.equal(resumes, 2);
  dispose(); hidden(true); t.mock.timers.tick(30000); hidden(false);
  assert.equal(starts, 2); assert.equal(stops, 2);
  t.mock.timers.reset(); delete globalThis.document;
});
