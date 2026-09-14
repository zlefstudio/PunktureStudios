import { useState } from 'react';
import { FACE_HOTSPOTS } from './types';
import { PiercingMap, type DiagramProps } from './PiercingMap';
import { ORAL_POINTS } from './mapGeometry';
import { FACE_IMAGE, FACE_POINTS } from './referenceGeometry';
import { ReferenceImage } from './ReferenceImage';
export function FaceDiagram(props: DiagramProps) {
  const [oral, setOral] = useState(props.previewId === 'smiley' || props.previewId === 'tongue');
  return <PiercingMap {...props} title={oral ? 'Inside the smile' : 'The face'} subtitle={oral ? 'Inner-lip & tongue detail' : 'A little self-expression.'} spots={FACE_HOTSPOTS} points={oral ? ORAL_POINTS : FACE_POINTS}
    onDetail={id => setOral(id === 'smiley' || id === 'tongue')}
    detail={<div className="pm-view-switch"><button type="button" aria-pressed={!oral} onClick={() => setOral(false)}>Face</button><button type="button" aria-pressed={oral} onClick={() => setOral(true)}>Inside the smile</button></div>}>
    {p => oral ? <>
      <rect x="85" y="100" width="230" height="313" rx="110" fill={p.skin}/>
      <path d="M114 232C136 160 261 162 286 232L279 331C253 378 150 378 121 331Z" fill={p.shadow}/>
      <path d="M114 220C148 182 247 182 286 220" fill="none" stroke={p.ridge} strokeWidth="28"/>
      <path d="M200 195V218" stroke="#a18b9f" strokeWidth="7"/>
      <path d="M126 242Q200 221 274 242L271 267Q200 249 129 267Z" fill="#eee5dc"/>
      <path d="M148 258V239M174 254V235M200 253V234M226 254V235M252 258V239" stroke="#c3b3bf" strokeWidth="1.5"/>
      <path d="M158 346C146 309 161 282 200 280C243 278 270 301 257 347Q213 380 158 346Z" fill={p.skin} stroke="#dccbd5" strokeWidth="2"/>
      <path d="M200 292Q200 320 200 344" fill="none" stroke="#ab93ab" strokeWidth="2"/>
      <text x="200" y="153" textAnchor="middle" className="pm-svg-label">INNER UPPER LIP</text>
      <path d="M200 161V186" stroke="#eadfe8" opacity=".5"/>
      <text x="200" y="398" textAnchor="middle" className="pm-svg-label">TONGUE · TOP VIEW</text>
    </> : <ReferenceImage image={FACE_IMAGE} />}

  </PiercingMap>;
}
