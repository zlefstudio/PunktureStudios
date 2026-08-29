import { Trash2, Plus, Minus } from 'lucide-react';
import { useStore } from '../store';
import { UPGRADES } from '../constants';
import { peso } from './utils';
import type { Ticket, PiercingItem } from '../types';

interface Props {
  ticket: Ticket;
  items: PiercingItem[];
  readOnly?: boolean;
}

export function ItemsList({ ticket, items, readOnly = false }: Props) {
  const updateItem = useStore((s) => s.updateItem);
  const deleteItem = useStore((s) => s.deleteItem);
  const deleteItemsByTicket = useStore((s) => s.deleteItemsByTicket);

  if (items.length === 0) {
    return (
      <div className="text-center text-slate-600 text-sm py-8">
        {readOnly ? 'No items recorded.' : 'No piercings added yet — tap a placement above.'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row with Clear All */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
          Items ({items.length})
        </p>
        {!readOnly && (
          <button
            onClick={() => deleteItemsByTicket(ticket.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-500 hover:text-red-300 text-xs font-semibold transition-colors"
          >
            <Trash2 size={11} />
            Clear all
          </button>
        )}
      </div>

      {items.map((item) => {
        const lineTotal = (item.basePrice + item.upgradePrice) * item.quantity;

        return (
          <div
            key={item.id}
            className="rounded-xl border border-white/8 bg-white/3 p-3 space-y-2"
          >
            {/* Row 1: member label + placement + delete */}
            <div className="flex items-center gap-2">
              <input
                placeholder="Member"
                value={item.memberLabel ?? ''}
                readOnly={readOnly}
                onChange={(e) => updateItem(item.id, { memberLabel: e.target.value || undefined })}
                className="w-20 bg-white/6 border border-white/10 rounded-md px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/60"
              />
              <span className="flex-1 font-semibold text-sm text-white">{item.placementName}</span>
              <span className="text-xs text-slate-500">₱{item.basePrice}</span>
              {!readOnly && (
                <button
                  onClick={() => deleteItem(item.id)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Row 2: upgrade chips + qty stepper + line total */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Upgrade selector */}
              <div className="flex gap-1 flex-wrap">
                {UPGRADES.map((u) => (
                  <button
                    key={u.label}
                    disabled={readOnly}
                    onClick={() =>
                      updateItem(item.id, {
                        upgradeLabel: u.label,
                        upgradePrice: u.price,
                      })
                    }
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      item.upgradeLabel === u.label
                        ? 'bg-violet-600 text-white'
                        : 'bg-white/6 text-slate-400 hover:text-white hover:bg-white/12'
                    } ${readOnly ? 'cursor-default opacity-70' : ''}`}
                  >
                    {u.label === 'Free' ? 'Free' : (u.price === 50 ? '+50' : u.label.replace(' Jewelry', ''))}
                  </button>
                ))}
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Qty stepper */}
              {!readOnly && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => item.quantity > 1 && updateItem(item.id, { quantity: item.quantity - 1 })}
                    disabled={item.quantity <= 1}
                    className="w-7 h-7 rounded-lg bg-white/8 hover:bg-white/15 disabled:opacity-30 text-white flex items-center justify-center transition-colors"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-5 text-center text-sm font-bold text-white">{item.quantity}</span>
                  <button
                    onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}
                    className="w-7 h-7 rounded-lg bg-white/8 hover:bg-white/15 text-white flex items-center justify-center transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              )}

              {readOnly && (
                <span className="text-xs text-slate-500">×{item.quantity}</span>
              )}

              {/* Line total */}
              <span className="text-sm font-bold text-white min-w-[4rem] text-right">
                {peso(lineTotal)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
