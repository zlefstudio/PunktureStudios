import { BODY_HOTSPOTS } from './types';
import { PiercingMap, type DiagramProps } from './PiercingMap';
import { BODY_IMAGE, BODY_CROP_HEIGHT, NAVEL_POINTS, NIPPLE_POINT } from './referenceGeometry';
import { ReferenceImage } from './ReferenceImage';

/**
 * One shared body graphic: chest placement, navel and floating navel all live on
 * the same torso reference, so the customer never switches views to find a spot.
 */
export function BodyDiagram(props: DiagramProps) {
  const previewFrame = props.previewId === 'nipple_single' ? '35 70 330 200' : '65 265 275 130';
  return <PiercingMap {...props} title="The body" subtitle="Choose a placement to see jewelry and pricing." spots={BODY_HOTSPOTS} points={[...NAVEL_POINTS, NIPPLE_POINT]} artHeight={BODY_CROP_HEIGHT} previewFrame={previewFrame}>
    {() => <ReferenceImage image={BODY_IMAGE}/>}
  </PiercingMap>;
}
