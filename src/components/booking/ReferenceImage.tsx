export function ReferenceImage({ image }: { image: {src: string; width: number; height: number; x: number; y: number; scale: number} }) {
  return <image className="pm-reference-image" href={image.src} x={image.x} y={image.y} width={image.width * image.scale} height={image.height * image.scale} preserveAspectRatio="xMidYMid meet" />;
}
