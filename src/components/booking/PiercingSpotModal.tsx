import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { PiercingHotspot } from './types';
import type { BookingSelectedPiercing } from '../../types';
import { X, Sparkles, Shield, Clock, Plus, Trash2, Check, AlertTriangle } from 'lucide-react';
import { UPGRADES } from '../../constants';

interface PiercingSpotModalProps {
  spot: PiercingHotspot;
  initialSide?: 'left' | 'right' | 'both';
  existingSelection?: BookingSelectedPiercing;
  onAdd: (item: BookingSelectedPiercing) => void;
  onRemove?: (id: string) => void;
  onClose: () => void;
}

function SpotLocationGraphic({ spot }: { spot: PiercingHotspot }) {
  const cx = (spot.x / 100) * 200;
  const cy = (spot.y / 100) * 250;

  if (spot.category === 'EAR') {
    return (
      <div
        className="spot-location-graphic relative w-full rounded-2xl overflow-hidden flex items-center justify-center p-2 select-none"
        style={{
          height: '112px',
          background: 'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.14) 0%, rgba(17,21,32,0.95) 75%)',
          border: '1px solid var(--color-border)',
        }}
      >
        <span className="absolute top-2.5 left-3 text-[10px] font-mono tracking-wider text-zinc-400 font-semibold uppercase">
          Anatomical Ear Map
        </span>
        <svg viewBox="0 0 200 250" className="h-full max-w-[130px]">
          <path
            d="M 70,40 C 110,25 165,40 170,95 C 175,140 155,170 140,190 C 130,205 120,230 95,235 C 75,238 70,215 75,195 C 80,175 85,165 75,155 C 60,140 50,120 53,105 C 55,90 65,85 72,85 C 65,70 60,50 70,40 Z"
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="2"
          />
          <path
            d="M 72,48 C 105,38 152,48 157,92 C 162,130 145,155 130,172"
            fill="none"
            stroke="rgba(168,85,247,0.3)"
            strokeWidth="1.5"
          />
          <circle cx={cx} cy={cy} r="14" fill="rgba(168,85,247,0.3)" className="animate-ping" />
          <circle cx={cx} cy={cy} r="8" fill="rgba(139,92,246,0.5)" stroke="#a78bfa" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r="3.5" fill="#34d399" />
        </svg>
        <div className="absolute bottom-2 right-2.5 px-2 py-0.5 rounded-lg bg-zinc-900/90 border border-zinc-700/70 text-[10px] font-mono font-bold text-emerald-300 shadow">
          📍 {spot.name}
        </div>
      </div>
    );
  }

  if (spot.category === 'FACE' || spot.category === 'ORAL') {
    return (
      <div
        className="spot-location-graphic relative w-full rounded-2xl overflow-hidden flex items-center justify-center p-2 select-none"
        style={{
          height: '112px',
          background: 'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.14) 0%, rgba(17,21,32,0.95) 75%)',
          border: '1px solid var(--color-border)',
        }}
      >
        <span className="absolute top-2.5 left-3 text-[10px] font-mono tracking-wider text-zinc-400 font-semibold uppercase">
          Facial Placement Map
        </span>
        <svg viewBox="0 0 200 250" className="h-full max-w-[130px]">
          <path
            d="M 60,40 C 90,30 110,30 140,40 C 155,65 158,110 150,155 C 142,195 117,220 100,228 C 83,220 58,195 50,155 C 42,110 45,65 60,40 Z"
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="2"
          />
          <path d="M 65,70 Q 75,66 85,72" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" fill="none" />
          <path d="M 115,72 Q 125,66 135,70" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" fill="none" />
          <path d="M 100,85 L 96,115 L 104,115" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" fill="none" />
          <path d="M 85,140 Q 100,146 115,140" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" fill="none" />
          <circle cx={cx} cy={cy} r="14" fill="rgba(168,85,247,0.3)" className="animate-ping" />
          <circle cx={cx} cy={cy} r="8" fill="rgba(139,92,246,0.5)" stroke="#a78bfa" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r="3.5" fill="#34d399" />
        </svg>
        <div className="absolute bottom-2 right-2.5 px-2 py-0.5 rounded-lg bg-zinc-900/90 border border-zinc-700/70 text-[10px] font-mono font-bold text-emerald-300 shadow">
          📍 {spot.name}
        </div>
      </div>
    );
  }

  // BODY
  return (
    <div
      className="spot-location-graphic relative w-full rounded-2xl overflow-hidden flex items-center justify-center p-2 select-none"
      style={{
        height: '112px',
        background: 'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.14) 0%, rgba(17,21,32,0.95) 75%)',
        border: '1px solid var(--color-border)',
      }}
    >
      <span className="absolute top-2.5 left-3 text-[10px] font-mono tracking-wider text-zinc-400 font-semibold uppercase">
        Torso &amp; Body Map
      </span>
      <svg viewBox="0 0 200 250" className="h-full max-w-[130px]">
        <path
          d="M 40,30 C 65,45 135,45 160,30 C 150,60 145,85 152,120 C 160,160 155,200 162,240 L 38,240 C 45,200 40,160 48,120 C 55,85 50,60 40,30 Z"
          fill="rgba(255,255,255,0.03)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="2"
        />
        <ellipse cx="100" cy="122" rx="4" ry="6" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <circle cx={cx} cy={cy} r="14" fill="rgba(168,85,247,0.3)" className="animate-ping" />
        <circle cx={cx} cy={cy} r="8" fill="rgba(139,92,246,0.5)" stroke="#a78bfa" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r="3.5" fill="#34d399" />
      </svg>
      <div className="absolute bottom-2 right-2.5 px-2 py-0.5 rounded-lg bg-zinc-900/90 border border-zinc-700/70 text-[10px] font-mono font-bold text-emerald-300 shadow">
        📍 {spot.name}
      </div>
    </div>
  );
}

export function PiercingSpotModal({
  spot,
  initialSide = 'right',
  existingSelection,
  onAdd,
  onRemove,
  onClose,
}: PiercingSpotModalProps) {
  const [selectedUpgrade, setSelectedUpgrade] = useState<number>(
    existingSelection?.upgradePrice ?? 0
  );
  const [side, setSide] = useState<'left' | 'right' | 'both'>(
    existingSelection?.side ?? initialSide
  );

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const upgradeObj = UPGRADES.find((u) => u.price === selectedUpgrade) ?? UPGRADES[0];
  const sideMultiplier = side === 'both' ? 2 : 1;
  const totalPrice = (spot.basePrice + selectedUpgrade) * sideMultiplier;

  function handleSave() {
    const newItem: BookingSelectedPiercing = {
      id: existingSelection?.id ?? crypto.randomUUID(),
      name: spot.name,
      category: spot.category,
      basePrice: spot.basePrice,
      upgradeLabel: upgradeObj.price > 0 ? upgradeObj.label : undefined,
      upgradePrice: upgradeObj.price > 0 ? upgradeObj.price : undefined,
      side: spot.category === 'EAR' ? side : undefined,
      anatomyDependent: spot.anatomyDependent,
    };
    onAdd(newItem);
    onClose();
  }

  // ─────────────────────────────────────────────────────────────────────
  // WHY createPortal?
  // PublicShell's content wrapper has `animation: pk-fade-in ... both`.
  // The pk-fade-in keyframe ends on `transform: translateY(0)`.
  // Even an identity transform creates a new CSS "containing block" for
  // position:fixed descendants — the modal ends up fixed to the content
  // column, not the viewport. Portalling to <body> bypasses this entirely.
  // ─────────────────────────────────────────────────────────────────────
  // ─── Responsive layout helpers ────────────────────────────────────────────
  // We split the modal into TWO layers:
  //   1. A POSITIONING wrapper – handles placement (bottom on mobile, centered
  //      on desktop). It is NEVER animated so its transforms are never overridden.
  //   2. An ANIMATED inner panel – runs pk-modal-up. Because it doesn't carry
  //      centering transforms, the fill-mode:both doesn't conflict with anything.
  //
  // Previously both concerns lived on one element. The animation fill-mode left
  // `transform: translateY(0)` persisting which silently overwrote Tailwind's
  // `sm:-translate-x-1/2 sm:-translate-y-1/2` → modal appeared off-screen on desktop.

  return createPortal(
    <>
      {/* ── Backdrop (click-outside closes) ── */}
      <div
        aria-hidden="true"
        className="fixed inset-0"
        style={{
          zIndex: 9998,
          background: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          animation: 'pk-fade-in 0.18s ease-out both',
        }}
        onClick={onClose}
      />

      {/* ── POSITIONING wrapper (never animated, uses .modal-positioner CSS class) ── */}
      {/* Mobile: bottom-sheet. Desktop: centered. Positioning lives in CSS, not here. */}
      <div
        className="modal-positioner"
        style={{ zIndex: 9999 }}
        onClick={onClose}
      >
        {/* ── ANIMATED inner panel ── */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="piercing-spot-title"
          className="rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden w-full"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-strong)',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(139,92,246,0.12)',
            maxHeight: 'min(88svh, 88dvh, 88vh)',
            animation: 'pk-modal-up 0.28s cubic-bezier(0.16,1,0.3,1) both',
          }}
          onClick={(e) => e.stopPropagation()}
        >
        {/* Drag-handle pill (mobile only) */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-zinc-600/50" />
        </div>

        {/* ── Sticky Header ── */}
        <div
          className="px-5 pt-2 pb-3 border-b flex items-start justify-between gap-3 flex-shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(139,92,246,0.2)', color: 'var(--color-brand-text)' }}
              >
                {spot.category} PIERCING
              </span>
              <span className="text-[10px] font-semibold text-emerald-400">
                Single-use sterile needle
              </span>
              {existingSelection && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 uppercase">
                  ✓ Active
                </span>
              )}
            </div>
            <h3 id="piercing-spot-title" className="font-bold text-xl sm:text-2xl text-white tracking-tight">
              {spot.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 p-2 rounded-xl text-zinc-400 hover:text-white bg-white/5 transition-transform active:scale-90"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable Content Body ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 space-y-3">
          {/* Anatomical Locator Graphic */}
          <SpotLocationGraphic spot={spot} />

          {/* Anatomy Dependent Alert (if applicable) */}
          {spot.anatomyDependent && (
            <div
              className="p-3 rounded-2xl flex items-start gap-2.5"
              style={{
                background: 'rgba(217,119,6,0.12)',
                border: '1px solid rgba(217,119,6,0.35)',
                color: '#fde68a',
              }}
            >
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-400" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-300 text-[11px]">Anatomy Dependent Placement</p>
                <p className="text-amber-200/90 text-[10px] leading-relaxed">
                  {spot.anatomyNote || 'Not everyone has suitable anatomy for this piercing. Our piercer will inspect your tissue in-person.'}
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          <p className="text-[12px] leading-relaxed text-zinc-300">
            {spot.description}
          </p>

          {/* Quick Stats — compact inline row */}
          <div className="flex items-stretch gap-2">
            <div
              className="flex-1 flex items-center gap-1.5 p-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}
            >
              <Clock size={11} className="text-zinc-400 flex-shrink-0" />
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block leading-none mb-0.5">Healing</span>
                <span className="font-bold text-white text-[12px]">{spot.healingInfo}</span>
              </div>
            </div>
            <div
              className="flex-1 flex items-center gap-1.5 p-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}
            >
              <Shield size={11} className="text-zinc-400 flex-shrink-0" />
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block leading-none mb-0.5">Pain Level</span>
                <span className="font-bold text-white text-[12px]">{spot.painLevel}</span>
              </div>
            </div>
          </div>

          {/* Side Selector (Ear piercings only) */}
          {spot.category === 'EAR' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Placement Side
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['left', 'right', 'both'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSide(s)}
                    className="py-2 px-2 rounded-xl text-[12px] font-bold transition-all text-center capitalize"
                    style={{
                      background: side === s ? 'var(--color-brand)' : 'rgba(255,255,255,0.04)',
                      color: side === s ? '#fff' : 'var(--color-text-muted)',
                      border: side === s ? '1px solid var(--color-brand-light)' : '1px solid var(--color-border)',
                    }}
                  >
                    {s === 'both' ? 'Both (2×)' : `${s} Ear`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Jewelry Upgrade Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Initial Jewelry Material
              </label>
              <span className="text-[10px] font-bold text-violet-400 flex items-center gap-1">
                <Sparkles size={10} /> Implant grade
              </span>
            </div>
            <div className="space-y-1.5">
              {UPGRADES.map((u) => {
                const isSelected = selectedUpgrade === u.price;
                return (
                  <button
                    key={u.price}
                    type="button"
                    onClick={() => setSelectedUpgrade(u.price)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all text-left"
                    style={{
                      background: isSelected ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.03)',
                      border: isSelected ? '1px solid var(--color-brand-light)' : '1px solid var(--color-border)',
                      color: isSelected ? '#fff' : 'var(--color-text-muted)',
                    }}
                  >
                    <span>{u.label}</span>
                    <span className="font-mono font-bold text-violet-300">
                      {u.price === 0 ? 'Included' : `+₱${u.price}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Sticky Bottom Action Bar ── */}
        <div
          className="flex-shrink-0 px-5 py-3 border-t"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            // Respect iOS home indicator safe area
            paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-semibold text-zinc-400 block">Est. Total</span>
              <span className="font-black text-2xl font-mono text-white leading-none">₱{totalPrice}</span>
            </div>

            <div className="flex items-center gap-2">
              {existingSelection && onRemove && (
                <button
                  type="button"
                  onClick={() => {
                    onRemove(existingSelection.id);
                    onClose();
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl font-bold text-[12px] transition-colors"
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: 'var(--color-error-text)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                  }}
                  title="Remove from session"
                >
                  <Trash2 size={15} />
                  <span className="hidden sm:inline">Remove</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSave}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-[13px] transition-transform active:scale-95 text-white"
                style={{
                  background: 'var(--color-brand)',
                  boxShadow: 'var(--shadow-brand)',
                  border: 'none',
                }}
              >
                {existingSelection ? <Check size={15} /> : <Plus size={15} />}
                <span>{existingSelection ? 'Update Selection' : 'Add to Session'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>,
    document.body
  );
}
