import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upcomingEvents, editableEvents, nextEventSettings } from '../src/popupEvents.ts';
import { validateSettings } from '../src/validation.ts';
const now = Date.parse('2026-09-11T17:00:00Z'); // September 12 in Manila
const event = (id,date,active=true) => ({id,eventDate:date,eventTitle:'Market',eventLocation:'Manila',eventHours:'10 AM',eventMapUrl:'https://example.com/map',eventActive:active});
const settings = {key:'public',eventActive:false,updatedAt:1};
test('events use Manila date, skip drafts/past events, preserve same-day venues, and sort',()=>{
 const s={...settings,events:[event('c','2026-09-13'),event('b','2026-09-12'),event('a','2026-09-12'),event('old','2026-09-11'),event('draft','2026-09-12',false)]};
 assert.deepEqual(upcomingEvents(s,now).map(e=>e.id),['a','b','c']);
 assert.equal(nextEventSettings(s,now).eventDate,'2026-09-12');
});
test('legacy event migrates without duplication and clearing the list prevents revival',()=>{
 const s={...settings,...event('old','2026-09-13')};
 assert.equal(editableEvents(s).length,1);
 assert.equal(upcomingEvents({...s,events:[]},now).length,0);
 assert.equal(nextEventSettings({...s,events:[]},now).eventActive,false);
});
test('validation preserves event lists for sync and rejects invalid input',()=>{
 const e=event('a','2026-09-13');
 assert.deepEqual(validateSettings({...settings,events:[e]}).events,[e]);
 for(const events of [[e,e],[{...e,eventDate:'2026-02-30'}],[{...e,eventMapUrl:'javascript:alert(1)'}],[{...e,eventTitle:''}],Array.from({length:13},(_,i)=>({...e,id:String(i)}))]) assert.throws(()=>validateSettings({...settings,events}));
});

test('multi-day event stays visible through its last Manila date and overlap is rejected',()=>{
 const e={...event('range','2026-09-14'),eventEndDate:'2026-09-15'};
 assert.equal(upcomingEvents({...settings,events:[e]},Date.parse('2026-09-15T12:00:00+08:00')).length,1);
 assert.equal(upcomingEvents({...settings,events:[e]},Date.parse('2026-09-16T00:00:00+08:00')).length,0);
 assert.throws(()=>validateSettings({...settings,events:[e,event('other','2026-09-15')]}),/overlap/);
 assert.throws(()=>validateSettings({...settings,events:[{...e,eventEndDate:'2026-09-13'}]}));
 assert.doesNotThrow(()=>validateSettings({...settings,events:[e,event('next','2026-09-16')]}));
});

test('backend blocks every pop-up day while preserving drafts and explicit empty lists', async()=>{
 const {validateSchedule,popupBlocks}=await import('../backend/worker.mjs');
 const s={...settings,events:[{...event('range','2026-09-14'),eventEndDate:'2026-09-15'}]};
 assert.equal(popupBlocks(s,'2026-09-14'),true);
 assert.equal(popupBlocks(s,'2026-09-15'),true);
 assert.equal(popupBlocks(s,'2026-09-16'),false);
 assert.throws(()=>validateSchedule(s,'2026-09-15','13:00',now));
 assert.doesNotThrow(()=>validateSchedule(s,'2026-09-16','13:00',now));
 assert.equal(popupBlocks({...s,events:s.events.map(e=>({...e,eventActive:false}))},'2026-09-15'),false);
 assert.equal(popupBlocks({...event('legacy','2026-09-15'),events:[]},'2026-09-15'),false);
});
