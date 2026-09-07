import { useState } from 'react';
import { BODY_HOTSPOTS, type PiercingHotspot } from './types';

interface BodyDiagramProps {
  selectedNames: string[];
  onSelectSpot: (spot: PiercingHotspot) => void;
}

export function BodyDiagram({ selectedNames, onSelectSpot }: BodyDiagramProps) {
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
          BODY &amp; TORSO · TAP ANY SPOT
        </span>

        <svg viewBox="0 0 400 500" className="w-full h-full">
          <defs>
            <filter id="bodyGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#8b5cf6" floodOpacity="0.8" />
            </filter>
            <radialGradient id="bodyShade" cx="50%" cy="45%" r="50%">
              <stop offset="0%" stopColor="#1e2436" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#111520" stopOpacity="0.85" />
            </radialGradient>
          </defs>

          {/* ── Minimal Torso Line Art ── */}
          {/* Torso Contour */}
          <path
            d="M 80,60 C 130,90 270,90 320,60 C 300,120 290,170 305,240 C 320,320 310,400 325,480 L 75,480 C 90,400 80,320 95,240 C 110,170 100,120 80,60 Z"
            fill="url(#bodyShade)"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Collarbones */}
          <path
            d="M 120,95 C 160,110 185,115 195,125"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M 280,95 C 240,110 215,115 205,125"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Chest Curves / Placement guides */}
          <path
            d="M 100,180 C 120,195 145,190 160,170"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 300,180 C 280,195 255,190 240,170"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Ribcage Line */}
          <path
            d="M 160,240 C 180,265 200,265 240,240"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Abdominal vertical line */}
          <path
            d="M 200,190 L 200,380"
            fill="none"
            stroke="rgba(168,85,247,0.25)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Belly Button (Navel) Outline */}
          <ellipse
            cx="200"
            cy="260"
            rx="12"
            ry="16"
            fill="#0b0d14"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.5"
          />
          <path
            d="M 194,256 C 200,250 206,256 200,264"
            fill="none"
            stroke="rgba(168,85,247,0.5)"
            strokeWidth="2"
          />

          {/* Hip accents */}
          <path
            d="M 110,410 C 150,440 180,455 200,455 C 220,455 250,440 290,410"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* ── Hotspots ── */}
          {BODY_HOTSPOTS.map((spot) => {
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
                  filter="url(#bodyGlow)"
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
