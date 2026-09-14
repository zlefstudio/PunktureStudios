import { useId, useState } from 'react';
import { BODY_HOTSPOTS } from './types';
import { PiercingMap, type DiagramProps, type MapPoint } from './PiercingMap';
import { BODY_IMAGE, BODY_CROP_HEIGHT, NAVEL_POINT, NIPPLE_POINT } from './referenceGeometry';
import { ReferenceImage } from './ReferenceImage';
export function BodyDiagram(props: DiagramProps) {
  const [view, setView] = useState(props.previewId || 'navel');
  const clip = useId().replace(/:/g,'');
  const chest = view === 'nipple_single';
  const floating = view === 'floating_navel';
  const points: MapPoint[] = chest ? [NIPPLE_POINT] : [{...NAVEL_POINT,id:floating ? 'floating_navel' : 'navel',jewel:floating ? 'floating' : 'navel',landmark:floating ? 'Upper rim · flat lower end inside the navel' : 'Upper navel rim'}];
  return <PiercingMap {...props} title="The body" subtitle={chest ? 'Nipple placement detail' : 'Explore your placement.'} spots={BODY_HOTSPOTS} points={points} artHeight={chest ? 400 : BODY_CROP_HEIGHT}
    onDetail={setView}
    detail={<div className="pm-view-switch"><button type="button" aria-pressed={!chest && !floating} onClick={() => setView('navel')}>Navel</button><button type="button" aria-pressed={floating} onClick={() => setView('floating_navel')}>Floating navel</button><button type="button" aria-pressed={chest} onClick={() => setView('nipple_single')}>Chest detail</button></div>}>
    {p => chest ? <>
      <text x="200" y="76" textAnchor="middle" className="pm-svg-label">NIPPLE · FRONT DETAIL</text>
      <ellipse cx="200" cy="224" rx="122" ry="114" fill={p.skin}/>
      <ellipse cx="200" cy="224" rx="64" ry="61" fill={p.shadow} opacity=".55"/>
      <ellipse cx="200" cy="224" rx="25" ry="24" fill={p.ridge} stroke="#a6a4a2"/>
      <text x="200" y="365" textAnchor="middle" className="pm-svg-label">SCHEMATIC · INDIVIDUAL POSITION VARIES</text>
    </> : <>
      {/* Clip only the reference screenshot's bottom UI; retain the complete navel. */}
      <defs><clipPath id={clip}><rect x="0" y="0" width="400" height={BODY_CROP_HEIGHT}/></clipPath></defs>
      <g clipPath={`url(#${clip})`}><ReferenceImage image={BODY_IMAGE}/></g>
    </>}
  </PiercingMap>;
}
