import { itemEstimate } from './cartSnapshot';
import { useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { BookingSelectedPiercing } from '../../types';
import { ShoppingBag, X, Trash2, ArrowRight, Pencil } from 'lucide-react';
import { UPGRADES } from '../../constants';
import { useDialogFocus } from './useDialogFocus';

interface BookingCartBarProps {
  items: BookingSelectedPiercing[];
  onRemoveItem: (id: string) => void;
  onEditItem?: (item: BookingSelectedPiercing) => void;
  canEditItem?: (item: BookingSelectedPiercing) => boolean;
  onProceed: () => void;
  hidden?: boolean;
  nextLabel?: string;
}

export function BookingCartBar({ items, onRemoveItem, onEditItem, canEditItem, onProceed, hidden = false, nextLabel = 'Next: Schedule' }: BookingCartBarProps) {
  const [open, setOpen] = useState(false);
  const visible = open && !hidden && items.length > 0;
  const dialogRef = useDialogFocus(visible);

  useLayoutEffect(() => {
    if (!visible) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [visible]);

  useEffect(() => {
    if (open && (hidden || items.length === 0)) setOpen(false);
  }, [open, hidden, items.length]);

  if (hidden || items.length === 0) return null;
  const totalEstimate = items.reduce((sum, item) => sum + itemEstimate(item), 0);
  const quantity = items.reduce((sum, item) => sum + (item.side === 'both' ? 2 : 1), 0);

  return createPortal(<>
    <button data-booking-cart-trigger type="button" aria-label={`View cart — ${quantity} item${quantity !== 1 ? 's' : ''} selected`}
      aria-haspopup="dialog" aria-expanded={visible} onClick={() => setOpen(true)}
      className="booking-cart-trigger fixed flex items-center justify-center rounded-2xl text-white"
      style={{ zIndex: 900, background: 'var(--color-brand)', boxShadow: '0 8px 32px #0006', border: '1px solid #c4b5fd66' }}>
      <ShoppingBag size={20} aria-hidden="true" />
      <span className="text-[12px] font-bold">View cart ({quantity})</span>
      <span className="text-[12px] font-mono border-l border-white/30 pl-3">₱{totalEstimate.toLocaleString()}</span>
    </button>

    {visible && <>
      <div aria-hidden="true" className="fixed inset-0" onClick={() => setOpen(false)}
        style={{ zIndex: 9100, background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(10px)' }} />
      <div className="modal-positioner" style={{ zIndex: 9101 }} onClick={() => setOpen(false)}>
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="booking-cart-title" tabIndex={-1}
          className="booking-dialog rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden w-full"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', maxHeight: 'min(88svh, 88dvh, 88vh)' }}
          onClick={event => event.stopPropagation()}>
          <div className="booking-dialog-header px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <h2 id="booking-cart-title" className="font-bold text-lg text-white">Your cart</h2>
              <p className="text-[12px] text-zinc-400">{quantity} item{quantity !== 1 ? 's' : ''} · review before scheduling</p>
            </div>
            <button type="button" aria-label="Close cart" onClick={() => setOpen(false)} className="px-3 rounded-xl bg-white/5 text-zinc-300"><X size={18}/></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3 space-y-3">
            {items.map(item => <div key={item.id} className="booking-cart-row">
              <div className="min-w-0">
                <p className="font-bold text-white text-[14px] break-words">{item.name}</p>
                {item.side && <p className="text-[12px] text-zinc-300 mt-1 capitalize">{item.side === 'both' ? 'Both ears · 2 piercings' : `${item.side} ear`}</p>}
                {!item.isCustom && !['CUSTOM', 'JEWELRY'].includes(item.category) && <p className="text-[12px] text-violet-300 mt-1">
                  {UPGRADES.find(upgrade => upgrade.price === (item.upgradePrice ?? 0))?.label || item.upgradeLabel}
                  {!item.upgradePrice && ' · included'}
                </p>}
                <p className="text-[11px] text-zinc-400 mt-1">{item.side === 'both' ? '2 × ' : ''}(₱{item.basePrice} service + ₱{item.upgradePrice ?? 0} jewelry)</p>
              </div>
              <span className="font-mono font-bold text-white text-[14px]">₱{itemEstimate(item).toLocaleString()}</span>
              <div className="booking-cart-actions">
                {onEditItem && (!canEditItem || canEditItem(item)) && <button type="button" aria-label={`Edit ${item.name}`} className="flex items-center gap-1.5 hover:bg-white/5"
                  onClick={() => { setOpen(false); onEditItem(item); }}><Pencil size={14}/>Edit</button>}
                <button type="button" aria-label={`Remove ${item.name} from cart`} title="Remove" className="flex items-center gap-1.5 hover:bg-red-500/10"
                  onClick={() => onRemoveItem(item.id)}><Trash2 size={14}/>Remove</button>
              </div>
            </div>)}
          </div>
          <div className="booking-cart-footer shrink-0 px-5 py-4 border-t space-y-3" style={{ borderColor: 'var(--color-border)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <div className="flex justify-between items-center gap-3">
              <span className="text-[12px] text-zinc-300">Estimated Total</span>
              <span className="text-2xl font-bold font-mono text-white">₱{totalEstimate.toLocaleString()}</span>
            </div>
            <p className="text-[11px] text-zinc-400">Adding items does not reserve a slot. Choose a schedule next.</p>
            <button type="button" onClick={() => { setOpen(false); onProceed(); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[14px] text-white" style={{ background: 'var(--color-brand)' }}>
              {nextLabel}<ArrowRight size={17}/>
            </button>
            <button type="button" onClick={() => setOpen(false)} className="w-full text-[12px] text-violet-300">Continue choosing</button>
          </div>
        </div>
      </div>
    </>}
  </>, document.body);
}
