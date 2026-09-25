import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { EarDiagram } from '../src/components/booking/EarDiagram.tsx';
import { FaceDiagram } from '../src/components/booking/FaceDiagram.tsx';
import { BodyDiagram } from '../src/components/booking/BodyDiagram.tsx';
import { PiercingSpotModal } from '../src/components/booking/PiercingSpotModal.tsx';
import { EAR_HOTSPOTS, FACE_HOTSPOTS, BODY_HOTSPOTS } from '../src/components/booking/types.ts';

function setup(t) {
 const dom = new JSDOM('<div id="root"></div>');
 const previous = { window:globalThis.window, document:globalThis.document, IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT };
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const root=createRoot(document.getElementById('root'));
 t.after(()=>{act(()=>root.unmount());Object.assign(globalThis,previous);dom.window.close();});
 return {root, dom};
}
test('Hidden Helix offers only the required 200 jewelry tier and saves a 600 single-ear selection', t=>{
 const {root,dom}=setup(t);
 dom.window.scrollTo=()=>{};
 const spot=EAR_HOTSPOTS.find(s=>s.id==='hidden_helix');
 let saved;
 act(()=>root.render(React.createElement(PiercingSpotModal,{spot,onAdd:item=>saved=item,onClose:()=>{}})));
 const buttons=[...document.querySelectorAll('button')];
 assert.equal(buttons.filter(b=>b.textContent.includes('200 Titanium')).length,1);
 for(const label of ['Surgical Steel','Rhinestone Jewelry','150 Titanium']) assert.ok(!buttons.some(b=>b.textContent.includes(label)));
 act(()=>buttons.find(b=>b.textContent.includes('Add to cart')).dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
 assert.equal(saved.name,'Hidden Helix');
 assert.equal(saved.basePrice,400);
 assert.equal(saved.upgradePrice,200);
 assert.equal(saved.basePrice+saved.upgradePrice,600);
});
test('all map directories keep original catalog records and selected state', t=>{
 const {root,dom}=setup(t);
 for(const [Component,spots] of [[EarDiagram,EAR_HOTSPOTS],[FaceDiagram,FACE_HOTSPOTS],[BodyDiagram,BODY_HOTSPOTS]]) {
  const calls=[];
  act(()=>root.render(React.createElement(Component,{selectedNames:[spots[0].name],onSelectSpot:s=>calls.push(s)})));
  const buttons=[...document.querySelectorAll('.pm-directory button')];
  assert.equal(buttons.length,spots.length);
  assert.equal(buttons[0].getAttribute('aria-pressed'),'true');
  for(const button of buttons) act(()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  assert.deepEqual(calls,spots);
 }
});
test('ear jewelry accepts keyboard selection and industrial spans two cartilage ends',t=>{
 const {root,dom}=setup(t);let selected;
 act(()=>root.render(React.createElement(EarDiagram,{selectedNames:[],onSelectSpot:s=>selected=s})));
 const industrial=document.querySelector('[aria-label="Select Industrial piercing"]');
 act(()=>industrial.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
 assert.equal(selected.id,'industrial');
 assert.equal(industrial.querySelectorAll('.pm-jewel circle').length,2);
});
test('oral placements are inside a dedicated mouth view, never marked on facial skin',t=>{
 const {root,dom}=setup(t);
 act(()=>root.render(React.createElement(FaceDiagram,{selectedNames:[],onSelectSpot:()=>{}})));
 assert.equal(document.querySelector('[aria-label="Select Smiley piercing"]'),null);
 assert.equal(document.querySelector('[aria-label="Select Tongue piercing"]'),null);
 const inside=[...document.querySelectorAll('.pm-view-switch button')][1];
 act(()=>inside.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
 assert.equal(document.querySelector('[aria-label="Select Smiley piercing"]').getAttribute('transform'),'translate(200 220)');
 assert.equal(document.querySelector('[aria-label="Select Tongue piercing"]').getAttribute('transform'),'translate(200 318)');
});
test('floating navel sits on the same upper rim and uses a flat lower end',t=>{
 const {root}=setup(t);
 act(()=>root.render(React.createElement(BodyDiagram,{selectedNames:[],onSelectSpot:()=>{}})));
 // Both navel placements now share one graphic, so both markers exist at once.
 const navel=document.querySelector('[aria-label="Select Navel piercing"]');
 const floating=document.querySelector('[aria-label="Select Floating Navel piercing"]');
 assert.ok(navel&&floating,'navel and floating navel markers are both drawn');
 assert.ok(floating.querySelector('.pm-jewel ellipse'),'floating navel uses the flat lower end');
 assert.equal(document.querySelectorAll('.pm-view-switch').length,0,'no view switch on the body graphic');
});

test('modal previews reuse the selected anatomical detail without booking controls', t=>{
 const {root}=setup(t);
 for(const [Component,id,name] of [[EarDiagram,'rook','Rook'],[FaceDiagram,'septum','Septum'],[FaceDiagram,'smiley','Smiley'],[BodyDiagram,'floating_navel','Floating Navel']]) {
  act(()=>root.render(React.createElement(Component,{key:id,previewId:id,selectedNames:[name],onSelectSpot:()=>assert.fail('Preview must be inert')})));
  assert.equal(document.querySelectorAll('.pm-spot').length,1);
  assert.equal(document.querySelector('.pm-spot').getAttribute('aria-label'),`Select ${name} piercing`);
  assert.equal(document.querySelectorAll('button,[tabindex="0"]').length,0);
 }
});

test('reference transforms preserve source pixels and original asset dimensions', async()=>{
 const { readFileSync } = await import('node:fs');
 const { EAR_IMAGE,FACE_IMAGE,BODY_IMAGE,onReference }=await import('../src/components/booking/referenceGeometry.ts');
 for(const image of [EAR_IMAGE,FACE_IMAGE,BODY_IMAGE]) {
  const bytes=readFileSync(new URL(`../public${image.src}`,import.meta.url));
  if (image.src.endsWith('.jpg')) {
   let offset=2, dimensions;
   while(offset<bytes.length) {
    const marker=bytes.readUInt16BE(offset);offset+=2;
    if ([0xffc0,0xffc1,0xffc2].includes(marker)) { dimensions=[bytes.readUInt16BE(offset+5),bytes.readUInt16BE(offset+3)];break; }
    offset+=bytes.readUInt16BE(offset);
   }
   assert.deepEqual(dimensions,[image.width,image.height]);
  } else {
   assert.equal(bytes.readUInt32BE(16),image.width);
   assert.equal(bytes.readUInt32BE(20),image.height);
  }
  const mapped=onReference(image,{id:'anchor',x:123,y:234,offset:[7,11]});
  assert.ok(Math.abs((mapped.x-image.x)/image.scale-123)<.0001);
  assert.ok(Math.abs((mapped.y-image.y)/image.scale-234)<.0001);
  assert.deepEqual(mapped.offset,[7*image.scale,11*image.scale]);
 }
});
test('dense facial tap regions stay within their nearest landmark cells', async()=>{
 const { FACE_POINTS,hitCell }=await import('../src/components/booking/referenceGeometry.ts');
 for(const point of FACE_POINTS) {
  const vertices=hitCell(point,FACE_POINTS).split(' ').map(pair=>pair.split(',').map(Number));
  assert.ok(vertices.length>=3);
  for(const [x,y] of vertices) for(const other of FACE_POINTS) {
   const own=x*x+y*y;
   const otherDistance=(point.x+x-other.x)**2+(point.y+y-other.y)**2;
   assert.ok(own<=otherDistance+.00001,`${point.id} target crossed into ${other.id}`);
  }
 }
});
test('every face & oral placement has exactly one marker on a mapped view', async()=>{
 const { FACE_POINTS }=await import('../src/components/booking/referenceGeometry.ts');
 const { ORAL_POINTS }=await import('../src/components/booking/mapGeometry.ts');
 const markerIds=new Set([...FACE_POINTS,...ORAL_POINTS].map(point=>point.id));
 for(const spot of FACE_HOTSPOTS) assert.ok(markerIds.has(spot.id),`${spot.name} has no map marker on the face or inner-mouth view`);
 // PiercingMap looks the catalog entry up by point id, so a stray marker would crash the map.
 const catalogIds=new Set(FACE_HOTSPOTS.map(spot=>spot.id));
 for(const id of markerIds) assert.ok(catalogIds.has(id),`${id} has a marker but no catalog entry`);
});
test('body markers keep their own tap cells on the shared torso graphic', async()=>{
 const { NAVEL_POINTS,NIPPLE_POINT,hitCell }=await import('../src/components/booking/referenceGeometry.ts');
 const points=[...NAVEL_POINTS,NIPPLE_POINT];
 assert.equal(points.length,3,'navel, floating navel and the chest placement are all mapped');
 for(const point of points) {
  const vertices=hitCell(point,points).split(' ').map(pair=>pair.split(',').map(Number));
  assert.ok(vertices.length>=3,`${point.id} needs its own tap cell`);
  for(const [x,y] of vertices) for(const other of points) {
   const own=x*x+y*y;
   const otherDistance=(point.x+x-other.x)**2+(point.y+y-other.y)**2;
   assert.ok(own<=otherDistance+.00001,`${point.id} target crossed into ${other.id}`);
  }
 }
});

test('navel callouts keep a shared upper-rim anchor on the new torso', async()=>{
 const { BODY_IMAGE,NAVEL_POINTS,NIPPLE_POINT }=await import('../src/components/booking/referenceGeometry.ts');
 for(const point of NAVEL_POINTS) {
  assert.ok(Math.abs((point.x+point.offset[0])/BODY_IMAGE.scale-266)<.001);
  assert.ok(Math.abs((point.y+point.offset[1])/BODY_IMAGE.scale-452)<.001);
 }
 assert.ok(NIPPLE_POINT.y<NAVEL_POINTS[0].y);
 assert.equal(NAVEL_POINTS[0].y,NAVEL_POINTS[1].y,'floating is not a lower navel placement');
});
test('the studio rate list is fully bookable on the face & oral tab', ()=>{
 const names=new Set(FACE_HOTSPOTS.map(spot=>spot.name));
 for(const name of ['Nostril','Eyebrow','Septum','Dahlia','Dimple','Anti Eyebrow','Labret','Vertical Labret','Ashley','Smiley','Madonna','Monroe','Medusa','Tongue','Jestrum','Spider Bites','Snake Bites','Angel Fangs']) {
  assert.ok(names.has(name),`${name} is missing from the face & oral tab`);
 }
});
test('industrial has two rim targets and every body placement shares one graphic',t=>{
 const {root}=setup(t);
 act(()=>root.render(React.createElement(EarDiagram,{selectedNames:[],onSelectSpot:()=>{}})));
 assert.equal(document.querySelector('[aria-label="Select Industrial piercing"]').querySelectorAll('.pm-pin').length,2);
 act(()=>root.render(React.createElement(BodyDiagram,{selectedNames:[],onSelectSpot:()=>{}})));
 // Chest placement, navel and floating navel are drawn on the same torso image.
 for(const name of ['Navel','Floating Navel','Nipple (single)']) {
  assert.ok(document.querySelector(`[aria-label="Select ${name} piercing"]`),`${name} must share the body graphic`);
 }
 assert.equal(document.querySelectorAll('.pm-view-switch').length,0,'the body graphic has no view switch');
});
