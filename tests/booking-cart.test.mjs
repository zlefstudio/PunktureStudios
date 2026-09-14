import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingCartNotes, itemEstimate, readCartDraft, saveCartDraft, clearCartDraft } from '../src/components/booking/cartSnapshot.ts';
const item = {id:'one',name:'Hidden Helix',category:'EAR',basePrice:400,upgradePrice:200,upgradeLabel:'200 Titanium',side:'both'};
test('cart snapshot keeps every item, custom instructions and both-ear pricing without truncation',()=>{
 const items=Array.from({length:12},(_,i)=>({...item,id:String(i),name:`Selection ${i}`,customNotes:'Please discuss jewelry fit.'}));
 const notes=bookingCartNotes(items,'Client request');
 assert.ok(notes.length>300);
 for(const entry of items) assert.ok(notes.includes(entry.name));
 assert.match(notes,/Please discuss jewelry fit/);
 assert.match(notes,/Total estimate: ₱14400/);
 assert.match(notes,/Client request/);
 assert.equal(itemEstimate(item),1200);
 assert.throws(()=>bookingCartNotes(items,'x'.repeat(20001)),/too long/);
});
test('cart draft survives reload and can be cleared after booking creation',t=>{
 const old=globalThis.sessionStorage;const data=new Map();
 globalThis.sessionStorage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 t.after(()=>{if(old===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=old;});
 saveCartDraft([item]);assert.deepEqual(readCartDraft(),[item]);
 clearCartDraft();assert.deepEqual(readCartDraft(),[]);
});
