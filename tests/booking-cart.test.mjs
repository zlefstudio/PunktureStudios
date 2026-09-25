import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingCartNotes, itemEstimate, readCartDraft, saveCartDraft, clearCartDraft, upsertCartItem } from '../src/components/booking/cartSnapshot.ts';
const item = {id:'one',name:'Hidden Helix',category:'EAR',basePrice:400,upgradePrice:200,upgradeLabel:'200 Titanium',side:'both'};

test('editing sides replaces the original cart line and never duplicates its id',()=>{
 const original={...item,side:'right'};
 const updated={...item,side:'left'};
 assert.deepEqual(upsertCartItem([original],updated),[updated]);
 assert.deepEqual(upsertCartItem([original,{...item,id:'two',side:'left'}],updated),[updated]);
});

test('both ears supersede single lines; adding one ear preserves the other jewelry',()=>{
 const left={...item,id:'left',side:'left',upgradePrice:50};
 const right={...item,id:'right',side:'right'};
 assert.deepEqual(upsertCartItem([left,right],item),[item]);
 const result=upsertCartItem([item],left);
 assert.deepEqual(result,[{...item,side:'right'},left]);
 assert.equal(result.reduce((sum,i)=>sum+itemEstimate(i),0),1050);
 const custom={id:'care',name:'Aftercare Solution',category:'CUSTOM',basePrice:150};
 assert.deepEqual(upsertCartItem([custom],{...custom,id:'new'}),[{...custom,id:'new'}]);
});
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
