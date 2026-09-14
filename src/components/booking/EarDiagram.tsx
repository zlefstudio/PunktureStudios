import { EAR_HOTSPOTS } from './types';
import { PiercingMap, type DiagramProps } from './PiercingMap';
import { EAR_IMAGE, EAR_POINTS } from './referenceGeometry';
import { ReferenceImage } from './ReferenceImage';
export function EarDiagram(props: DiagramProps) {
  return <PiercingMap {...props} title="The ear" subtitle="Explore your ear." spots={EAR_HOTSPOTS} points={EAR_POINTS}>
    {() => <ReferenceImage image={EAR_IMAGE} />}
  </PiercingMap>;
}
