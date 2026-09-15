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
  {id:'helix',x:515,y:612,landmark:'Outer cartilage rim'},
  {id:'hidden_helix',x:399,y:444,landmark:'Tucked beneath the upper helix rim'},
  {id:'forward_helix',x:289,y:490,landmark:'Front-facing upper helix rim'},
  {id:'flat',x:410,y:512,landmark:'Flat cartilage inside the upper rim'},
  {id:'conch',x:422,y:648,landmark:'Central cartilage bowl'},
  {id:'tragus',x:276,y:688,landmark:'Flap immediately in front of the ear canal'},
  {id:'anti_tragus',x:339,y:770,jewel:'fold',size:.8,rotation:-35,landmark:'Raised cartilage opposite the tragus'},
  {id:'rook',x:344,y:545,jewel:'rook',size:.72,rotation:-24,landmark:'Upper inner cartilage shelf'},
  // Center the tap marker inside the hoop; compensate the offset to keep jewelry fixed.
  {id:'daith',x:367,y:616,offset:[-7,-1],jewel:'daith',size:1.35,rotation:-12,landmark:'Innermost fold, above the ear canal'},
  {id:'snug',x:421,y:705,jewel:'snug',size:.8,rotation:18,landmark:'Across the lower antihelix ridge'},
  {id:'industrial',x:400,y:487,jewel:'industrial',landmark:'Two upper-rim contacts',ends:[[-85,-32.5],[89.2,35.8]]},
].map(point => onReference(EAR_IMAGE, point as MapPoint));
export const FACE_POINTS: MapPoint[] = [
  {id:'nostril',x:129,y:258,size:.54,landmark:'Nostril wing, above the opening'},
  {id:'septum',x:145,y:273,jewel:'septum',size:.48,landmark:'Inside the nose; jewelry emerges below the tip'},
  // Raised to sit on the brow itself (was y:184, which landed just under the brow hair).
  {id:'eyebrow',x:76,y:173,jewel:'fold',size:.72,rotation:18,landmark:'Across the outer third of the brow ridge'},
  {id:'anti_eyebrow',x:75,y:208,size:.5,landmark:'Cheekbone beneath the outer brow'},
  {id:'medusa',x:145,y:288,size:.54,landmark:'Philtrum, above the Cupid’s bow'},
  {id:'madonna',x:115,y:291,size:.5,landmark:'Above the upper lip, on the wearer’s right'},
  {id:'jestrum',x:145,y:300,jewel:'vertical',size:.42,landmark:'Straight through the centre of the upper lip'},
  {id:'angel_fangs',x:127,y:300,jewel:'vertical',size:.42,landmark:'Upper lip, mirrored on both sides'},
  {id:'dahlia',x:110,y:318,size:.5,landmark:'Below the mouth corner, on the jaw line'},
  // Ashley and Vertical Labret share the lower-lip centre; the markers are nudged
  // apart so each keeps its own tappable cell while both stay centred.
  {id:'ashley',x:145,y:311,size:.5,landmark:'Through the lower lip, exiting inside the mouth'},
  {id:'vertical_labret',x:146,y:321,jewel:'vertical',size:.4,landmark:'Straight through the centre of the lower lip'},
  {id:'snake_bites',x:129,y:320,size:.5,landmark:'Two piercings, one on each side of the lower lip'},
  {id:'spider_bites',x:162,y:316,size:.5,landmark:'Two piercings along one side of the lower lip'},
  {id:'labret',x:145,y:331,size:.54,landmark:'Centered below the lower lip'},
  {id:'monroe',x:175,y:289,size:.54,landmark:'Above the upper lip, on the wearer’s left'},
  {id:'dimple',x:94,y:306,size:.54,landmark:'Cheek, outside the mouth corner'},
].map(point => onReference(FACE_IMAGE, point as MapPoint));
// Chest and navel share ONE torso graphic: the navel marker, the floating-navel
// marker just below it, and the nipple-line marker on the chest. All are drawn
// on the supplied torso reference so customers never switch views.
export const NAVEL_POINTS: MapPoint[] = [
  {id:'navel',x:393,y:611,jewel:'navel',size:.65,landmark:'Upper navel rim'},
  {id:'floating_navel',x:393,y:627,jewel:'floating',size:.6,landmark:'Upper rim · flat lower end inside the navel'},
].map(point => onReference(BODY_IMAGE, point as MapPoint));
// The supplied torso has no individually photographed nipple landmark, so this is
// a labelled chest-line guide (with the modal's left/right picker) rather than an
// invented anatomical mark; the piercer confirms the exact position in person.
export const NIPPLE_POINT: MapPoint = onReference(BODY_IMAGE,{id:'nipple_single',x:340,y:205,jewel:'nipple',size:.8,landmark:'Chest, nipple line · mirrored on the other side'});

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
