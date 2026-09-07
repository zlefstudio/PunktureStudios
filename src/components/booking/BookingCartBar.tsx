import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { BookingSelectedPiercing } from '../../types';
import { ShoppingBag, X, Trash2, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

interface BookingCartBarProps {
  items: BookingSelectedPiercing[];
  onRemoveItem: (id: string) => void;
  onProceed: () => void;
}

export function BookingCartBar({ items, onRemoveItem, onProceed }: BookingCartBarProps) {
  const [open, setOpen] = useState(false);

  // Close modal on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (items.length === 0) return null;

  const totalEstimate = items.reduce(
    (sum, item) => sum + item.basePrice + (item.upgradePrice ?? 0),
    0
  );

  return createPortal(
    <>
      {/* ── Floating Cart FAB (bottom-right, always visible) ── */}
      <button
        type="button"
        aria-label={`View cart — ${items.length} piercing${items.length !== 1 ? 's' : ''} selected`}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-5 sm:bottom-8 sm:right-8 flex items-center justify-center rounded-2xl transition-transform active:scale-90 hover:scale-105"
        style={{
          zIndex: 900,
          width: 58,
          height: 58,
          background: 'var(--color-brand)',
          boxShadow: '0 8px 32px rgba(139,92,246,0.55), 0 2px 8px rgba(0,0,0,0.5)',
          border: '1.5px solid rgba(196,181,253,0.35)',
          animation: 'pk-modal-up 0.3s cubic-bezier(0.16,1,0.3,1) both',
        }}
      >
        <ShoppingBag size={22} color="#fff" />
        {/* Item count badge */}
        <span
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-black font-black text-[10px] flex items-center justify-center shadow-lg"
          style={{ border: '2px solid var(--color-bg)' }}
        >
          {items.length}
        </span>
      </button>

      {/* ── Cart Modal ── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            aria-hidden="true"
            className="fixed inset-0"
            style={{
              zIndex: 9100,
              background: 'rgba(0,0,0,0.78)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              animation: 'pk-fade-in 0.18s ease-out both',
            }}
            onClick={() => setOpen(false)}
          />

          {/* Panel — bottom-sheet on mobile, centered on desktop */}
          <div
            className="modal-positioner"
            style={{ zIndex: 9101 }}
            onClick={() => setOpen(false)}
          >
            <div
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
              {/* Drag pill (mobile) */}
              <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-zinc-600/50" />
              </div>

              {/* Header */}
              <div
                className="px-5 pt-3 pb-4 border-b flex items-center justify-between gap-3 flex-shrink-0"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--color-brand)', boxShadow: 'var(--shadow-brand)' }}
                  >
                    <ShoppingBag size={16} color="#fff" />
                  </div>
                  <div>
                    <p className="font-black text-white text-[15px] leading-tight">Your Session Cart</p>
                    <p className="text-[11px] text-zinc-400">
                      {items.length} piercing{items.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close cart"
                  className="p-2 rounded-xl text-zinc-400 hover:text-white bg-white/5 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable item list */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 space-y-2">
                <div className="flex items-center gap-1.5 pb-1">
                  <Sparkles size={12} className="text-violet-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Selected Piercings
                  </span>
                </div>

                {items.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center gap-3 p-3 rounded-2xl"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {/* Check icon */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white text-[13px] truncate">{it.name}</span>
                        {it.side && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 capitalize">
                            {it.side}
                          </span>
                        )}
                        {it.isCustom && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300">
                            Custom
                          </span>
                        )}
                      </div>
                      {it.upgradeLabel && (
                        <p className="text-[10px] text-violet-300 mt-0.5">+{it.upgradeLabel}</p>
                      )}
                    </div>

                    {/* Price + Remove */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-mono font-bold text-white text-[13px]">
                        ₱{it.basePrice + (it.upgradePrice ?? 0)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(it.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sticky footer — Total + CTA */}
              <div
                className="flex-shrink-0 px-5 py-4 border-t space-y-3"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
                }}
              >
                {/* Total row */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-400">Estimated Total</span>
                  <span className="font-black text-2xl font-mono text-white leading-none">
                    ₱{totalEstimate}
                    <span className="text-[11px] font-normal text-zinc-400 ml-1">est.</span>
                  </span>
                </div>

                {/* Next: Schedule CTA */}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onProceed();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[14px] text-white transition-transform active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-light))',
                    boxShadow: 'var(--shadow-brand)',
                    border: 'none',
                  }}
                >
                  <span>Next: Schedule</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>,
    document.body
  );
}
