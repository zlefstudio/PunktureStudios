import { useId } from 'react';
import { BODY_HOTSPOTS } from './types';
import { PiercingMap, type DiagramProps } from './PiercingMap';
import { BODY_IMAGE, BODY_CROP_HEIGHT, NAVEL_POINTS, NIPPLE_POINT } from './referenceGeometry';
import { ReferenceImage } from './ReferenceImage';

/**
 * One shared body graphic: chest placement, navel and floating navel all live on
 * the same torso reference, so the customer never switches views to find a spot.
 */
export function BodyDiagram(props: DiagramProps) {
  const clip = useId().replace(/:/g,'');
  return <PiercingMap {...props} title="The body" subtitle="Chest and navel on one view." spots={BODY_HOTSPOTS} points={[...NAVEL_POINTS, NIPPLE_POINT]} artHeight={BODY_CROP_HEIGHT}>
    {() => <>
      {/* Clip only the reference screenshot's bottom UI; retain the complete navel. */}
      <defs><clipPath id={clip}><rect x="0" y="0" width="400" height={BODY_CROP_HEIGHT}/></clipPath></defs>
      <g clipPath={`url(#${clip})`}><ReferenceImage image={BODY_IMAGE}/></g>
    </>}
  </PiercingMap>;
}
