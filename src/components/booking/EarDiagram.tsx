import { useState } from 'react';
import { EAR_HOTSPOTS, type PiercingHotspot } from './types';

interface EarDiagramProps {
  selectedNames: string[];
  onSelectSpot: (spot: PiercingHotspot) => void;
}

export function EarDiagram({ selectedNames, onSelectSpot }: EarDiagramProps) {
  const [hoveredSpot, setHoveredSpot] = useState<PiercingHotspot | null>(null);

  return (
    <div className="flex flex-col items-center space-y-3 select-none">
      {/* SVG Container */}
      <div
        className="relative w-full max-w-[340px] aspect-[4/5] rounded-3xl p-4 flex items-center justify-center overflow-hidden"
        style={{
          background: 'radial-gradient(circle at 50% 45%, rgba(139,92,246,0.12) 0%, rgba(17,21,32,0.95) 70%)',
          border: '1px solid var(--color-border)',
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6)',
        }}
      >
        {/* Subtle background guide text */}
        <span
          className="absolute top-3 left-4 text-[10px] font-mono tracking-wider uppercase font-semibold pointer-events-none"
          style={{ color: 'var(--color-text-faint)' }}
        >
          EAR ANATOMY · TAP ANY SPOT
        </span>

        <svg
          viewBox="0 0 400 500"
          className="w-full h-full"
        >
          <defs>
            <filter id="violetGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#8b5cf6" floodOpacity="0.8" />
            </filter>
            <radialGradient id="earShade" cx="45%" cy="40%" r="50%">
              <stop offset="0%" stopColor="#1e2436" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#111520" stopOpacity="0.9" />
            </radialGradient>
          </defs>

          {/* ── Minimalist Ear Contour Paths ── */}
          {/* Outer Ear Silhouette */}
          <path
            d="M 140,80 C 220,50 330,80 340,190 C 350,280 310,340 280,380 C 260,410 240,460 190,470 C 150,475 140,430 150,390 C 160,350 170,330 150,310 C 120,280 100,240 105,210 C 110,180 130,170 145,170 C 130,140 120,100 140,80 Z"
            fill="url(#earShade)"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="3.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Helix inner fold */}
          <path
            d="M 145,95 C 210,75 305,95 315,185 C 325,260 290,310 260,345"
            fill="none"
            stroke="rgba(168,85,247,0.35)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Anti-helix upper fork */}
          <path
            d="M 270,160 C 240,150 200,165 190,190 C 180,210 190,240 210,250 C 240,265 255,300 245,340"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Conch inner ridge */}
          <path
            d="M 195,225 C 235,215 250,245 240,285 C 230,320 200,325 180,310"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Tragus flap */}
          <path
            d="M 130,225 C 150,230 155,250 140,270 C 130,280 125,270 125,250 Z"
            fill="rgba(139,92,246,0.15)"
            stroke="rgba(168,85,247,0.4)"
            strokeWidth="2"
          />

          {/* Ear canal opening */}
          <ellipse
            cx="170"
            cy="260"
            rx="14"
            ry="18"
            fill="#0a0c12"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1.5"
          />

          {/* Lobe contour accent */}
          <path
            d="M 175,390 C 185,425 210,445 235,420"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* ── Interactive Hotspots ── */}
          {EAR_HOTSPOTS.map((spot) => {
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
                {/* Hitbox expander */}
                <circle cx={cx} cy={cy} r="22" fill="transparent" />

                {/* Animated pulsing outer ring */}
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

                {/* Inner Core Gem */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? '8' : '6'}
                  fill={isSelected ? '#10b981' : isHovered ? '#c4b5fd' : '#8b5cf6'}
                  filter="url(#violetGlow)"
                  style={{ transition: 'all 0.2s ease-out' }}
                />

                {/* Center dot or checkmark indicator */}
                {isSelected ? (
                  <circle cx={cx} cy={cy} r="3" fill="#fff" />
                ) : (
                  <circle cx={cx} cy={cy} r="2" fill="#fff" opacity="0.9" />
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip info on hover / active */}
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
