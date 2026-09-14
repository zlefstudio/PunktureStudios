import { useId, useState, type ReactNode } from 'react';
import type { PiercingHotspot } from './types';
import { hitCell } from './referenceGeometry';

export interface DiagramProps {
  previewId?: string;
  selectedNames: string[];
  onSelectSpot: (spot: PiercingHotspot) => void;
}
export type Jewel = 'stud' | 'ring' | 'vertical' | 'horizontal' | 'industrial' | 'navel' | 'floating' | 'rook' | 'fold' | 'snug' | 'daith' | 'septum' | 'smiley' | 'nipple';
export interface MapPoint { id: string; x: number; y: number; jewel?: Jewel; rotation?: number; size?: number; landmark?: string; offset?: [number, number]; ends?: [[number, number], [number, number]]; }

export function Jewelry({ kind = 'stud', metal, ends = [[-86,-38],[99,44]] }: { kind?: Jewel; metal: string; ends?: [[number, number], [number, number]] }) {
  const ball = (x: number, y: number, r = 4) => <circle cx={x} cy={y} r={r} fill={metal} stroke="#fbf6ee" strokeWidth=".7" />;
  // Hidden shaft sections represent jewelry passing through tissue, not lying on its surface.
  if (kind === 'industrial') {
    const [[ax,ay],[bx,by]] = ends;
    const d = `M${ax} ${ay}L${bx} ${by}`;
    return <><path d={d} stroke="#504956" strokeWidth="4"/><path d={d} stroke={metal} strokeWidth="2.6"/>{ball(ax,ay,4.5)}{ball(bx,by,4.5)}</>;
  }
  if (kind === 'rook') return <><path d="M0-14 1-9M3 8Q4 13 1 16" fill="none" stroke={metal} strokeWidth="2.5" />{ball(0,-14,4)}{ball(1,17,4)}</>;
  if (kind === 'fold') return <><path d="M0-10V-7M0 7V10" stroke={metal} strokeWidth="2.5" />{ball(0,-11,3.5)}{ball(0,11,3.5)}</>;
  if (kind === 'snug') return <><path d="M-14 0H-10M10 0H14" stroke={metal} strokeWidth="2.5" />{ball(-14,0,3.8)}{ball(14,0,3.8)}</>;
  // The upper-left arc disappears into the crus; the visible hoop fills the inner bowl.
  if (kind === 'daith') return <><path d="M-3-22A18 23 0 1 1-17-7" fill="none" stroke="#66596d" strokeWidth="4.5"/><path d="M-3-23A18 23 0 1 1-17-8" fill="none" stroke={metal} strokeWidth="2.8"/>{ball(5,21,3)}</>;
  // A circular barbell opens DOWNWARD. Its upper arc is inside the nose, behind the columella.
  if (kind === 'septum') return <><path d="M-9-1C-14 6-12 12-5 16M9-1C14 6 12 12 5 16" fill="none" stroke="#746878" strokeWidth="4"/><path d="M-9-2C-14 5-12 11-5 15M9-2C14 5 12 11 5 15" fill="none" stroke={metal} strokeWidth="2.6"/>{ball(-5,15,3)}{ball(5,15,3)}</>;
  if (kind === 'smiley') return <><path d="M-6-3A10 13 0 1 0 6-3" fill="none" stroke={metal} strokeWidth="2.5"/>{ball(0,19,3)}</>;
  if (kind === 'ring') return <><path d="M-7-5 A11 12 0 1 0 7-5" fill="none" stroke="#675d68" strokeWidth="5" /><path d="M-7-6 A11 12 0 1 0 7-6" fill="none" stroke={metal} strokeWidth="3" />{ball(-7,-6,3)}{ball(7,-6,3)}</>;
  if (kind === 'vertical' || kind === 'navel' || kind === 'floating') return <><path d="M0-9 Q7 0 0 11" fill="none" stroke={metal} strokeWidth="3" />{ball(0,-9)}{kind === 'floating' ? <ellipse cy="11" rx="4" ry="2" fill={metal} /> : ball(0,11,kind === 'navel' ? 6 : 4)}</>;
  if (kind === 'nipple') return <><path d="M-31 0H-25M25 0H31" stroke={metal} strokeWidth="3.5"/>{ball(-31,0,5.5)}{ball(31,0,5.5)}</>;
  if (kind === 'horizontal') return <><path d="M-10 0 H10" stroke={metal} strokeWidth="3" />{ball(-10,0)}{ball(10,0)}</>;
  return <><circle r="7" fill="#655a68" opacity=".4" cy="2" />{ball(0,0,6)}<path d="m0-4 3 4-3 4-3-4Z" fill="#fffaf1" /><circle cx="-2" cy="-2" r="1.2" fill="white" /></>;
}

export function PiercingMap({ title, subtitle, spots, points, selectedNames, onSelectSpot, children, detail, onDetail, previewId, artHeight = 500 }: DiagramProps & {
  title: string; subtitle: string; spots: PiercingHotspot[]; points: MapPoint[];
  children: (paint: { skin: string; shadow: string; ridge: string; metal: string }) => ReactNode;
  artHeight?: number; detail?: ReactNode; onDetail?: (id: string) => void;
}) {
  const uid = useId().replace(/:/g, '');
  const [active, setActive] = useState<string | null>(null);
  const targets = points.flatMap(point => (point.jewel === 'industrial' && point.ends ? point.ends : [[0,0]]).map(([x,y], index) => ({id: `${point.id}-${index}`, x: point.x + x!, y: point.y + y!})));
  const current = spots.find(spot => spot.id === active);
  const currentPoint = points.find(point => point.id === active);
  const paint = { skin: `url(#${uid}-skin)`, shadow: `url(#${uid}-shadow)`, ridge: `url(#${uid}-ridge)`, metal: `url(#${uid}-metal)` };
  function choose(spot: PiercingHotspot) { setActive(spot.id); onSelectSpot(spot); }
  return <section className={`piercing-map ${previewId ? 'pm-preview' : ''}`} aria-label={`${title} piercing map`}>
    <div className="pm-stage">
      <div className="pm-heading"><span>PLACEMENT ATELIER</span><span>{title}</span></div>
      {!previewId && detail}
      <svg viewBox={`0 0 400 ${artHeight}`} className="pm-sculpture" aria-label={`${title}, sculpted placement guide`}>
        <defs>
          <linearGradient id={`${uid}-skin`} x1="0" y1="0" x2="1" y2=".8"><stop stopColor="#f4f3f1"/><stop offset=".32" stopColor="#dbdad8"/><stop offset=".7" stopColor="#bab9b7"/><stop offset="1" stopColor="#92918f"/></linearGradient>
          <radialGradient id={`${uid}-shadow`} cx="65%" cy="45%" r="65%"><stop stopColor="#8b8987"/><stop offset=".55" stopColor="#b1aeab"/><stop offset="1" stopColor="#dedbd8"/></radialGradient>
          <linearGradient id={`${uid}-ridge`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fffefa"/><stop offset=".4" stopColor="#e5e2df"/><stop offset="1" stopColor="#aaa6a2"/></linearGradient>
          <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset=".24" stopColor="#eae2d3"/><stop offset=".5" stopColor="#817a89"/><stop offset=".68" stopColor="#fffaf0"/><stop offset="1" stopColor="#b6a7bb"/></linearGradient>
        </defs>
        <g className="pm-anatomy" strokeLinecap="round" strokeLinejoin="round">{children(paint)}</g>
        {points.filter(point => !previewId || point.id === previewId).map(point => {
          const spot = spots.find(s => s.id === point.id)!;
          const selected = selectedNames.includes(spot.name);
          return <g key={point.id} transform={`translate(${point.x} ${point.y})`} className={`pm-spot ${selected ? 'is-selected' : ''} ${active === point.id ? 'is-active' : ''}`}
            role={previewId ? undefined : "button"} tabIndex={previewId ? undefined : 0} aria-label={`Select ${spot.name} piercing`} aria-pressed={selected}
            onPointerEnter={() => setActive(point.id)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(point.id)} onBlur={() => setActive(null)}
            onClick={previewId ? undefined : () => choose(spot)} onKeyDown={e => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(spot); } }}>
            <title>{spot.name}</title>
            {(point.jewel === 'industrial' && point.ends ? point.ends : [[0,0]]).map(([x,y], index) => <g key={index} transform={`translate(${x} ${y})`}>
              <polygon className="pm-hit" points={hitCell({id: `${point.id}-${index}`, x: point.x + x!, y: point.y + y!},targets)} fill="transparent" />
              <g className="pm-pin" pointerEvents="none"><circle r="6.5" fill="#fff" fillOpacity=".85" stroke="#695681" strokeWidth="1"/><circle r="2.5" fill="#5e427e"/></g>
              <circle className="pm-aura" r="15" fill="none" stroke="currentColor" strokeWidth="1" />
            </g>)}
            <g className="pm-jewel" pointerEvents="none"><g transform={`translate(${point.offset?.[0] ?? 0} ${point.offset?.[1] ?? 0}) rotate(${point.rotation ?? 0}) scale(${point.size ?? 1})`}><Jewelry kind={point.jewel} metal={paint.metal} ends={point.ends}/></g></g>
            {selected && <path className="pm-check" d="m10-16 3 3 5-6" fill="none" stroke="#b6f4d7" strokeWidth="2" />}
          </g>;
        })}
      </svg>
      <div className="pm-caption" aria-live="polite"><span>{current?.name || subtitle}{currentPoint?.landmark && <small>{currentPoint.landmark}</small>}</span><span>{current ? `₱${current.basePrice}` : 'TAP TO EXPLORE ↗'}</span></div>
    </div>
    {!previewId && <><div className="pm-directory" aria-label={`${title} placements`}>
      {spots.map((spot, index) => <button type="button" key={spot.id} className={selectedNames.includes(spot.name) ? 'is-selected' : ''}
        onPointerEnter={() => { setActive(spot.id); onDetail?.(spot.id); }} onPointerLeave={() => setActive(null)}
        onFocus={() => { setActive(spot.id); onDetail?.(spot.id); }} onBlur={() => setActive(null)}
        onClick={() => choose(spot)} aria-pressed={selectedNames.includes(spot.name)}>
        <span>{selectedNames.includes(spot.name) ? '✓' : String(index + 1).padStart(2,'0')}</span>{spot.name}<span className="pm-arrow">↗</span>
      </button>)}
    </div>
    <p className="pm-note">A placement preview, made for exploring. Your piercer confirms the exact position and jewelry fit with your anatomy.</p></>}
  </section>;
}
