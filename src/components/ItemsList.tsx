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
  const updateItem          = useStore((s) => s.updateItem);
  const deleteItem          = useStore((s) => s.deleteItem);
  const deleteItemsByTicket = useStore((s) => s.deleteItemsByTicket);

  if (items.length === 0) {
    return (
      <div className="text-center text-body-sm py-10" style={{ color: 'var(--color-text-faint)' }}>
        {readOnly ? 'No items recorded.' : 'No piercings added yet — tap a placement above.'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-label-xs" style={{ color: 'var(--color-text-faint)' }}>
          Items ({items.length})
        </p>
        {!readOnly && (
          <button
            onClick={() => deleteItemsByTicket(ticket.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-body-xs font-semibold"
            style={{
              background: 'var(--color-error-bg)',
              color: 'var(--color-error-text)',
              border: '1px solid rgba(185,28,28,0.20)',
            }}
          >
            <Trash2 size={11} />
            Clear all
          </button>
        )}
      </div>

      {/* Items */}
      {items.map((item) => {
        const lineTotal = (item.basePrice + item.upgradePrice) * item.quantity;

        return (
          <div
            key={item.id}
            className="rounded-xl p-3 space-y-2.5"
            style={{
              background: 'var(--color-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* Row 1: member label + placement name + base price + delete */}
            <div className="flex items-center gap-2">
              <input
                placeholder="Member"
                value={item.memberLabel ?? ''}
                readOnly={readOnly}
                onChange={(e) =>
                  updateItem(item.id, { memberLabel: e.target.value || undefined })
                }
                className="input"
                style={{
                  width: '80px',
                  flex: 'none',
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '8px',
                  cursor: readOnly ? 'default' : undefined,
                }}
              />
              <span
                className="flex-1 font-semibold text-body"
                style={{ color: 'var(--color-text)' }}
              >
                {item.placementName}
              </span>
              <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
                ₱{item.basePrice}
              </span>
              {!readOnly && (
                <button
                  onClick={() => deleteItem(item.id)}
                  className="p-1.5 rounded-lg"
                  style={{
                    background: 'transparent',
                    color: 'var(--color-text-faint)',
                    border: 'none',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.background = 'var(--color-error-bg)';
                    el.style.color      = 'var(--color-error-text)';
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.background = 'transparent';
                    el.style.color      = 'var(--color-text-faint)';
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Row 2: upgrade chips + spacer + qty stepper + line total */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Upgrade chips */}
              <div className="flex gap-1 flex-wrap">
                {UPGRADES.map((u) => {
                  const isSelected = item.upgradeLabel === u.label;
                  return (
                    <button
                      key={u.label}
                      disabled={readOnly}
                      onClick={() =>
                        updateItem(item.id, {
                          upgradeLabel: u.label,
                          upgradePrice: u.price,
                        })
                      }
                      className="rounded-md font-semibold"
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        cursor: readOnly ? 'default' : 'pointer',
                        opacity: readOnly ? 0.7 : 1,
                        background: isSelected ? 'var(--color-brand)' : 'rgba(255,255,255,0.06)',
                        color: isSelected ? '#fff' : 'var(--color-text-muted)',
                        border: isSelected
                          ? '1px solid var(--color-brand)'
                          : '1px solid var(--color-border)',
                      }}
                    >
                      {u.label === 'Free' ? 'Free' : (u.price === 50 ? '+50' : u.label.replace(' Jewelry', ''))}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1" />

              {/* Qty stepper */}
              {!readOnly && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      item.quantity > 1 &&
                      updateItem(item.id, { quantity: item.quantity - 1 })
                    }
                    disabled={item.quantity <= 1}
                    className="w-7 h-7 rounded-lg flex items-center justify-center font-bold"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                      opacity: item.quantity <= 1 ? 0.3 : 1,
                      fontSize: '16px',
                    }}
                  >
                    <Minus size={12} />
                  </button>
                  <span
                    className="w-6 text-center font-bold"
                    style={{ fontSize: '14px', color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
                  >
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              )}

              {readOnly && (
                <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
                  ×{item.quantity}
                </span>
              )}

              {/* Line total */}
              <span
                className="font-black text-right"
                style={{
                  fontSize: '14px',
                  minWidth: '4rem',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {peso(lineTotal)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
