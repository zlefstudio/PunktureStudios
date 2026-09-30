import { useId } from 'react';
import { FORCEPS_BOX, VIEW, WINDOW } from './forcepsGeometry';

/**
 * Cartoon piercing forceps drawn as two rigid arms that swing around the pivot screw.
 * Opening or closing rotates whole arms, so the jaws and the finger rings always move
 * together (the old four-frame stack only moved the jaws and popped between pictures).
 *
 * Geometry is in "units": the screw is (0, 0), the jaws point up and the finger rings
 * hang down (forcepsGeometry.ts holds the scale and jaw-window position). Colours come from the studio's sprites.
 */

const INK = '#283848';
const STEEL = '#c8d8e8';
const SHINE = '#eaf7fa';
const SHADE = '#8ea4bd';
const LINE = 6.5;   // outline width in units (~1px on stage)

/** Move a point sideways from the line p1→p2, for highlight strokes. */
function beside(p1: [number, number], p2: [number, number], d: number): [number, number, number, number] {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1], len = Math.hypot(dx, dy);
  const nx = -dy / len * d, ny = dx / len * d;
  return [p1[0] + nx, p1[1] + ny, p2[0] + nx, p2[1] + ny];
}

function Tube({ from, to, width, shine = true }: { from: [number, number]; to: [number, number]; width: number; shine?: boolean }) {
  const [x1, y1, x2, y2] = beside(from, to, -width * 0.2);
  return <g strokeLinecap="round">
    <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={INK} strokeWidth={width + LINE} />
    <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={STEEL} strokeWidth={width} />
    {shine && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={SHINE} strokeWidth={width * 0.24} />}
  </g>;
}

/** One arm in the closed pose. `catchArm` swaps the ratchet comb for the small catch it locks onto. */
function Arm({ catchArm = false }: { catchArm?: boolean }) {
  const ring = { x: -82, y: 312, r: 60, w: 22 };
  const loop = 'M -27 -262 a 27 72 0 1 0 54 0 a 27 72 0 1 0 -54 0 Z M -13 -262 a 13 52 0 1 0 26 0 a 13 52 0 1 0 -26 0 Z';
  return <g strokeLinejoin="round">
    {/* Finger ring and the shank that carries it (bent so the two rings sit side by side when closed) */}
    <Tube from={[-6, 30]} to={[-64, 262]} width={26} />
    <circle cx={ring.x} cy={ring.y} r={ring.r} fill="none" stroke={INK} strokeWidth={ring.w + LINE} />
    <circle cx={ring.x} cy={ring.y} r={ring.r} fill="none" stroke={STEEL} strokeWidth={ring.w} />
    <circle cx={ring.x} cy={ring.y} r={ring.r - 3} fill="none" stroke={SHINE} strokeWidth={5} pathLength={100} strokeDasharray="24 76" transform={`rotate(-165 ${ring.x} ${ring.y})`} strokeLinecap="round" />
    <circle cx={ring.x} cy={ring.y} r={ring.r + 4} fill="none" stroke={SHADE} strokeWidth={4} pathLength={100} strokeDasharray="20 80" transform={`rotate(20 ${ring.x} ${ring.y})`} strokeLinecap="round" />
    {catchArm
      ? <Tube from={[-40, 210]} to={[-14, 208]} width={12} shine={false} />
      : <>
        <path d="M -50 194 Q -4 234 48 214" fill="none" stroke={INK} strokeWidth={13 + LINE} strokeLinecap="round" />
        <path d="M -50 194 Q -4 234 48 214" fill="none" stroke={STEEL} strokeWidth={13} strokeLinecap="round" />
        {/* Ratchet teeth */}
        <path d="M -30 213 Q -4 234 46 214" fill="none" stroke={INK} strokeWidth={13} strokeDasharray="2.6 7" />
      </>}

    {/* Jaw: slotted loop with the shaft running down to the joint */}
    <path d={loop} fill={STEEL} stroke={INK} strokeWidth={LINE} fillRule="evenodd" />
    <path d="M -19 -262 C -19 -290 -17 -305 -8 -318" fill="none" stroke={SHINE} strokeWidth={5} strokeLinecap="round" />
    <path d="M -12 -198 L 12 -198 L 17 -46 L -17 -46 Z" fill={STEEL} />
    <line x1={-12} y1={-192} x2={-17} y2={-46} stroke={INK} strokeWidth={LINE} strokeLinecap="round" />
    <line x1={12} y1={-192} x2={17} y2={-46} stroke={INK} strokeWidth={LINE} strokeLinecap="round" />
    <line x1={-6} y1={-186} x2={-9} y2={-56} stroke={SHINE} strokeWidth={5} strokeLinecap="round" />

    {/* Box joint */}
    <rect x={-30} y={-58} width={60} height={104} rx={15} fill={STEEL} stroke={INK} strokeWidth={LINE} />
    <path d="M -21 -44 L -21 26" fill="none" stroke={SHINE} strokeWidth={5} strokeLinecap="round" />
  </g>;
}

export interface ForcepsProps {
  /** 0 = closed, 1 = fully open. */
  open: number;
  /** Degrees each arm swings at open = 1. */
  openAngle: number;
  /** Show the gold stud held in the jaws (hidden once it is released onto the ear). */
  stud?: boolean;
}

export function Forceps({ open, openAngle, stud = false }: ForcepsProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const phi = Math.max(0, open) * openAngle;
  return <svg width={FORCEPS_BOX.width} height={FORCEPS_BOX.height} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
    style={{ display: 'block', overflow: 'visible' }} aria-hidden="true" focusable="false">
    {stud && <defs>
      <radialGradient id={`gold-${id}`} cx="35%" cy="32%" r="75%">
        <stop offset="0" stopColor="#fffbeb" />
        <stop offset="0.55" stopColor="#fbbf24" />
        <stop offset="1" stopColor="#b45309" />
      </radialGradient>
    </defs>}
    {/* Back arm first, then the front arm, then the screw that pins them */}
    <g transform={`rotate(${-phi}) scale(-1 1)`}><Arm catchArm /></g>
    <g transform={`rotate(${phi})`}><Arm /></g>
    <circle cx={0} cy={0} r={15} fill="#dfe9f2" stroke={INK} strokeWidth={LINE} />
    <line x1={-8} y1={-3} x2={8} y2={3} stroke={INK} strokeWidth={5} strokeLinecap="round" />
    {stud && <g>
      <line x1={WINDOW.x} y1={WINDOW.y} x2={WINDOW.x} y2={WINDOW.y + 66} stroke="#7c4a03" strokeWidth={13} strokeLinecap="round" />
      <line x1={WINDOW.x} y1={WINDOW.y} x2={WINDOW.x} y2={WINDOW.y + 66} stroke="#f2b632" strokeWidth={7} strokeLinecap="round" />
      <circle cx={WINDOW.x} cy={WINDOW.y} r={33} fill={`url(#gold-${id})`} stroke="#7c4a03" strokeWidth={4} />
      <circle cx={WINDOW.x - 11} cy={WINDOW.y - 12} r={7} fill="#fffef5" opacity={0.85} />
    </g>}
  </svg>;
}
