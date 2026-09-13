import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ritualMotion } from '../src/components/ritualMotion.ts';
test('avatar reactions loop smoothly and include a bounded recoil at needle contact',()=>{
 assert.deepEqual(ritualMotion(0),ritualMotion(14));
 assert.ok(Math.abs(ritualMotion(13.9999).y-ritualMotion(0).y)<.01);
 assert.ok(ritualMotion(5.05).scaleY<1);
 assert.ok(ritualMotion(10.07).x < -3);
 assert.ok(ritualMotion(10.07).rot < -2);
 assert.equal(ritualMotion(10.7).rot,0);
 assert.ok(ritualMotion(13.275).y < -5);
 for(let t=0;t<14;t+=.01){const m=ritualMotion(t);assert.ok(Number.isFinite(m.y));assert.ok(m.scaleY>=.95 && m.scaleY<=1.02);}
});
