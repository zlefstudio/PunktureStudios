import { useState } from 'react';
import { FACE_HOTSPOTS, type PiercingHotspot } from './types';

interface FaceDiagramProps {
  selectedNames: string[];
  onSelectSpot: (spot: PiercingHotspot) => void;
}

export function FaceDiagram({ selectedNames, onSelectSpot }: FaceDiagramProps) {
  const [hoveredSpot, setHoveredSpot] = useState<PiercingHotspot | null>(null);

  return (
    <div className="flex flex-col items-center space-y-3 select-none">
      <div
        className="relative w-full max-w-[340px] aspect-[4/5] rounded-3xl p-4 flex items-center justify-center overflow-hidden"
        style={{
          background: 'radial-gradient(circle at 50% 45%, rgba(139,92,246,0.12) 0%, rgba(17,21,32,0.95) 70%)',
          border: '1px solid var(--color-border)',
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6)',
        }}
      >
        <span
          className="absolute top-3 left-4 text-[10px] font-mono tracking-wider uppercase font-semibold pointer-events-none"
          style={{ color: 'var(--color-text-faint)' }}
        >
          FACE &amp; ORAL · TAP ANY SPOT
        </span>

        <svg viewBox="0 0 400 500" className="w-full h-full">
          <defs>
            <filter id="faceGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#8b5cf6" floodOpacity="0.8" />
            </filter>
            <radialGradient id="faceShade" cx="50%" cy="45%" r="48%">
              <stop offset="0%" stopColor="#1e2436" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#111520" stopOpacity="0.85" />
            </radialGradient>
          </defs>

          {/* ── Minimal Face Line Art ── */}
          {/* Head / Jawline Outline */}
          <path
            d="M 120,80 C 180,60 220,60 280,80 C 310,130 315,220 300,310 C 285,390 235,440 200,455 C 165,440 115,390 100,310 C 85,220 90,130 120,80 Z"
            fill="url(#faceShade)"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Eyebrows */}
          <path
            d="M 125,105 C 145,95 170,98 180,108"
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 275,105 C 255,95 230,98 220,108"
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Eyes (sleek minimalist arcs) */}
          <path
            d="M 135,135 C 150,125 170,128 178,138"
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 265,135 C 250,125 230,128 222,138"
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Nose Bridge & Tip */}
          <path
            d="M 200,125 L 196,195 C 193,220 185,228 175,230 C 185,236 215,236 225,230 C 215,228 207,220 204,195"
            fill="none"
            stroke="rgba(168,85,247,0.35)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Nostril Curves */}
          <path
            d="M 165,225 C 160,228 160,236 172,236"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 235,225 C 240,228 240,236 228,236"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Lips Contour */}
          {/* Philtrum line */}
          <path
            d="M 195,240 L 195,280 M 205,240 L 205,280"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1.2"
          />
          {/* Upper Lip */}
          <path
            d="M 155,310 C 180,305 195,290 200,293 C 205,290 220,305 245,310"
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Center Lip Seam */}
          <path
            d="M 150,312 C 180,314 195,310 200,311 C 205,310 220,314 250,312"
            fill="none"
            stroke="rgba(168,85,247,0.4)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Lower Lip */}
          <path
            d="M 160,315 C 180,345 220,345 240,315"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Chin groove */}
          <path
            d="M 185,385 C 195,390 205,390 215,385"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* ── Hotspots ── */}
          {FACE_HOTSPOTS.map((spot) => {
            const isSelected = selectedNames.includes(spot.name);
            const isHovered = hoveredSpot?.id === spot.id;
            const cx = (spot.x / 100) * 400;
            const cy = (spot.y / 100) * 500;

            return (
              <g
                key={spot.id}
                onClick={() => onSelectSpot(spot)}
                onMouseEnter={() => setHoveredSpot(spot)}
                onMouseLeave={() => setHoveredSpot(null)}
                className="cursor-pointer"
                role="button"
                aria-label={`Select ${spot.name} piercing`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectSpot(spot);
                  }
                }}
              >
                <circle cx={cx} cy={cy} r="22" fill="transparent" />

                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? '14' : isHovered ? '13' : '10'}
                  fill={isSelected ? 'rgba(16,185,129,0.25)' : 'rgba(139,92,246,0.2)'}
                  stroke={isSelected ? '#34d399' : '#a78bfa'}
                  strokeWidth="1.5"
                  className={isSelected ? '' : 'animate-pulse'}
                  style={{ transition: 'all 0.2s ease-out' }}
                />

                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? '8' : '6'}
                  fill={isSelected ? '#10b981' : isHovered ? '#c4b5fd' : '#8b5cf6'}
                  filter="url(#faceGlow)"
                  style={{ transition: 'all 0.2s ease-out' }}
                />

                {isSelected ? (
                  <circle cx={cx} cy={cy} r="3" fill="#fff" />
                ) : (
                  <circle cx={cx} cy={cy} r="2" fill="#fff" opacity="0.9" />
                )}
              </g>
            );
          })}
        </svg>

        {hoveredSpot && (
          <div
            className="absolute bottom-3 left-4 right-4 p-2.5 rounded-xl flex items-center justify-between text-body-xs pointer-events-none"
            style={{
              background: 'rgba(17, 21, 32, 0.94)',
              border: '1px solid rgba(168,85,247,0.4)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              animation: 'pk-fade-in 0.15s ease-out both',
            }}
          >
            <div>
              <p className="font-bold text-white leading-tight">{hoveredSpot.name}</p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {hoveredSpot.healingInfo} · {hoveredSpot.painLevel} pain
              </p>
            </div>
            <span
              className="px-2 py-0.5 rounded-lg font-mono font-bold text-xs"
              style={{ background: 'var(--color-brand-bg)', color: 'var(--color-brand-text)' }}
            >
              ₱{hoveredSpot.basePrice}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
