import type { MapPoint } from './PiercingMap';

// Pixel coordinates refer to the supplied originals. The SAME affine transform
// places the image and its points, avoiding aspect-ratio/crop drift on resize.
export const EAR_IMAGE = { src: '/media/anatomy/ear-reference.png', width: 736, height: 1199, x: -140 * 5 / 6, y: -345 * 5 / 6, scale: 5 / 6 };
export const FACE_IMAGE = { src: '/media/anatomy/face-reference.png', width: 286, height: 463, x: (400 - 286 * 500 / 463) / 2, y: 0, scale: 500 / 463 };
export const BODY_IMAGE = { src: '/media/anatomy/body-reference.png', width: 802, height: 688, x: -80 * 2 / 3, y: 0, scale: 2 / 3 };
export const BODY_CROP_HEIGHT = 638 * BODY_IMAGE.scale;
export function onReference(image: {x: number; y: number; scale: number}, point: MapPoint): MapPoint {
  return {...point, x: image.x + point.x * image.scale, y: image.y + point.y * image.scale, offset: point.offset ? [point.offset[0] * image.scale, point.offset[1] * image.scale] : undefined};
}
export const EAR_POINTS: MapPoint[] = [
  {id:'lobe',x:337,y:851,landmark:'Soft lower lobe'},
  {id:'auricle',x:477,y:746,landmark:'Middle-to-lower outer cartilage rim'},
  {id:'helix',x:518,y:559,landmark:'Upper outer cartilage rim'},
  {id:'forward_helix',x:289,y:490,landmark:'Front-facing upper helix rim'},
  {id:'flat',x:410,y:512,landmark:'Flat cartilage inside the upper rim'},
  {id:'conch',x:370,y:687,landmark:'Central cartilage bowl'},
  {id:'tragus',x:276,y:688,landmark:'Flap immediately in front of the ear canal'},
  {id:'anti_tragus',x:339,y:770,jewel:'fold',size:.8,rotation:-35,landmark:'Raised cartilage opposite the tragus'},
  {id:'rook',x:344,y:545,jewel:'rook',size:.72,rotation:-24,landmark:'Upper inner cartilage shelf'},
  {id:'daith',x:324,y:640,offset:[12,29],jewel:'daith',size:.8,rotation:-12,landmark:'Innermost fold, above the ear canal'},
  {id:'snug',x:421,y:705,jewel:'snug',size:.8,rotation:18,landmark:'Across the lower antihelix ridge'},
  {id:'industrial',x:400,y:487,jewel:'industrial',landmark:'Two upper-rim contacts',ends:[[-85,-32.5],[89.2,35.8]]},
].map(point => onReference(EAR_IMAGE, point as MapPoint));
export const FACE_POINTS: MapPoint[] = [
  {id:'nostril',x:129,y:258,size:.54,landmark:'Nostril wing, above the opening'},
  {id:'septum',x:145,y:273,jewel:'septum',size:.48,landmark:'Inside the nose; jewelry emerges below the tip'},
  {id:'eyebrow',x:76,y:184,jewel:'fold',size:.72,rotation:18,landmark:'Across the outer third of the brow ridge'},
  {id:'medusa',x:145,y:288,size:.54,landmark:'Philtrum, above the Cupid’s bow'},
  {id:'labret',x:145,y:330,size:.54,landmark:'Centered below the lower lip'},
  {id:'monroe',x:175,y:289,size:.54,landmark:'Above the upper lip, on the wearer’s left'},
  {id:'dimple',x:94,y:306,size:.54,landmark:'Cheek, outside the mouth corner'},
].map(point => onReference(FACE_IMAGE, point as MapPoint));
export const NAVEL_POINT = onReference(BODY_IMAGE,{id:'navel',x:393,y:611,jewel:'navel',size:.65,landmark:'Upper navel rim'});
export const NIPPLE_POINT: MapPoint = {id:'nipple_single',x:200,y:224,jewel:'nipple',size:1,landmark:'Through the base of the nipple · detail view'};

/** Voronoi partition clipped to a square hit target. Close facial spots cannot
 * steal one another's taps. Coordinates returned are local to the current point. */
export function hitCell(point: MapPoint, others: MapPoint[], radius = 22): string {
  let polygon = [[-radius,-radius],[radius,-radius],[radius,radius],[-radius,radius]];
  for (const other of others) {
    if (other.id === point.id) continue;
    const dx=other.x-point.x, dy=other.y-point.y, limit=(dx*dx+dy*dy)/2;
    const next: number[][]=[];
    for(let i=0;i<polygon.length;i++) {
      const a=polygon[i]!, b=polygon[(i+1)%polygon.length]!;
      const da=a[0]!*dx+a[1]!*dy-limit, db=b[0]!*dx+b[1]!*dy-limit;
      if(da<=0) next.push(a);
      if((da<=0)!==(db<=0)) { const t=da/(da-db);next.push([a[0]!+t*(b[0]!-a[0]!),a[1]!+t*(b[1]!-a[1]!)]); }
    }
    polygon=next;
  }
  return polygon.map(p=>p.join(',')).join(' ');
}
