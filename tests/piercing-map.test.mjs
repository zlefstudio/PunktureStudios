import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { EarDiagram } from '../src/components/booking/EarDiagram.tsx';
import { FaceDiagram } from '../src/components/booking/FaceDiagram.tsx';
import { BodyDiagram } from '../src/components/booking/BodyDiagram.tsx';
import { EAR_HOTSPOTS, FACE_HOTSPOTS, BODY_HOTSPOTS } from '../src/components/booking/types.ts';

function setup(t) {
 const dom = new JSDOM('<div id="root"></div>');
 const previous = { window:globalThis.window, document:globalThis.document, IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT };
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const root=createRoot(document.getElementById('root'));
 t.after(()=>{act(()=>root.unmount());Object.assign(globalThis,previous);dom.window.close();});
 return {root, dom};
}
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
test('floating navel shares the upper-rim location and uses a flat lower end',t=>{
 const {root,dom}=setup(t);
 act(()=>root.render(React.createElement(BodyDiagram,{selectedNames:[],onSelectSpot:()=>{}})));
 const position=document.querySelector('[aria-label="Select Navel piercing"]').getAttribute('transform');
 act(()=>document.querySelectorAll('.pm-view-switch button')[1].dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
 const floating=document.querySelector('[aria-label="Select Floating Navel piercing"]');
 assert.equal(floating.getAttribute('transform'),position);
 assert.ok(floating.querySelector('.pm-jewel ellipse'));
 assert.equal(document.querySelector('[aria-label="Select Navel piercing"]'),null);
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
  assert.equal(bytes.readUInt32BE(16),image.width);
  assert.equal(bytes.readUInt32BE(20),image.height);
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
test('industrial has two rim targets, and chest uses a labeled detail rather than an invented torso landmark',t=>{
 const {root,dom}=setup(t);
 act(()=>root.render(React.createElement(EarDiagram,{selectedNames:[],onSelectSpot:()=>{}})));
 assert.equal(document.querySelector('[aria-label="Select Industrial piercing"]').querySelectorAll('.pm-pin').length,2);
 act(()=>root.render(React.createElement(BodyDiagram,{selectedNames:[],onSelectSpot:()=>{}})));
 assert.equal(document.querySelector('[aria-label="Select Nipple (single) piercing"]'),null);
 const detail=[...document.querySelectorAll('.pm-view-switch button')].find(el=>el.textContent==='Chest detail');
 act(()=>detail.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
 assert.ok(document.querySelector('[aria-label="Select Nipple (single) piercing"]'));
 assert.match(document.querySelector('.pm-sculpture').textContent,/SCHEMATIC/);
});
