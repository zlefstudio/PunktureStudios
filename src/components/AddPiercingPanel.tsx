import { useState } from 'react';
import { useStore } from '../store';
import {
  PLACEMENTS,
  UPGRADES,
  JEWELRY_OPTIONS,
  OTHER_SERVICES,
  serviceItemName,
  servicePriceLabel,
  shortUpgradeLabel,
} from '../constants';
import type { Ticket, PlacementCategory } from '../types';

type PanelTab = PlacementCategory | 'SERVICES';

const CATEGORIES: PanelTab[] = ['EAR', 'ORAL', 'FACE', 'BODY', 'SERVICES', 'CUSTOM', 'JEWELRY'];

const TAB_LABELS: Record<PanelTab, string> = {
  EAR: 'EAR',
  ORAL: 'ORAL',
  FACE: 'FACE',
  BODY: 'BODY',
  SERVICES: '🧰 SERVICES',
  CUSTOM: 'CUSTOM',
  JEWELRY: '💍 JEWELRY',
};

interface Props {
  ticket: Ticket;
}

export function AddPiercingPanel({ ticket }: Props) {
  const addItem = useStore((s) => s.addItem);

  const [category, setCategory] = useState<PanelTab>('EAR');
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  const placements = PLACEMENTS.filter((p) => p.category === category);

  async function handleAddPiercing(placementName: string, basePrice: number) {
    await addItem({
      ticketId: ticket.id,
      placementName,
      basePrice,
      upgradeLabel: UPGRADES[0].label,
      upgradePrice: UPGRADES[0].price,
      quantity: 1,
    });
  }

  async function handleAddJewelry(label: string, price: number) {
    await addItem({
      ticketId: ticket.id,
      placementName: 'Jewelry',
      basePrice: 0,
      upgradeLabel: label,
      upgradePrice: price,
      quantity: 1,
    });
  }

  async function handleAddCustom() {
    const name = customName.trim();
    const price = parseInt(customPrice, 10);
    if (!name || isNaN(price) || price < 0) return;
    await handleAddPiercing(name, price);
    setCustomName('');
    setCustomPrice('');
  }

  return (
    <div className="px-5 py-4">
      <p className="text-label-xs mb-2.5" style={{ color: 'var(--color-text-faint)' }}>
        {category === 'JEWELRY' ? 'Add Jewelry' : category === 'SERVICES' ? 'Add Services' : 'Add Piercing'}
      </p>

      {/* ── Category tabs ── */}
      <div
        className="flex gap-1 mb-3.5 p-1 rounded-xl flex-wrap"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = category === cat;
          const isJewelry = cat === 'JEWELRY';
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className="flex-1 py-1.5 rounded-lg text-label-xs whitespace-nowrap"
              style={
                isActive
                  ? {
                    background: isJewelry ? 'var(--color-warn)' : 'var(--color-brand)',
                    color: '#fff',
                    boxShadow: isJewelry
                      ? '0 2px 10px rgba(217,119,6,0.30)'
                      : 'var(--shadow-brand)',
                  }
                  : {
                    background: 'transparent',
                    color: 'var(--color-text-faint)',
                  }
              }
              onMouseEnter={(e) => {
                if (isActive) return;
                const el = e.currentTarget;
                el.style.background = 'rgba(255,255,255,0.08)';
                el.style.color = 'var(--color-text-muted)';
              }}
              onMouseLeave={(e) => {
                if (isActive) return;
                const el = e.currentTarget;
                el.style.background = 'transparent';
                el.style.color = 'var(--color-text-faint)';
              }}
            >
              {TAB_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {/* ── JEWELRY tab ── */}
      {category === 'JEWELRY' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {JEWELRY_OPTIONS.map((j) => (
              <button
                key={j.label}
                onClick={() => handleAddJewelry(j.label, j.price)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-xs font-semibold"
                style={{
                  background: 'rgba(120,53,15,0.30)',
                  border: '1px solid rgba(217,119,6,0.30)',
                  color: 'var(--color-warn-text)',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.background = 'rgba(217,119,6,0.24)';
                  el.style.borderColor = 'rgba(251,191,36,0.60)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.background = 'rgba(120,53,15,0.30)';
                  el.style.borderColor = 'rgba(217,119,6,0.30)';
                }}
              >
                <span>💍</span>
                <span>{shortUpgradeLabel(j.price, j.label)}</span>
                <span style={{ color: 'var(--color-warn)', fontSize: '10px' }}>₱{j.price}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── SERVICES tab ── */}
      {category === 'SERVICES' && (
        <div className="space-y-2.5">
          <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
            Add-on services &amp; aftercare — “My Work” means the piercing or jewelry was originally done here at Punkture.
          </p>
          {OTHER_SERVICES.map((svc) => (
            <div
              key={svc.name}
              className="rounded-xl p-3 space-y-2"
              style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-body-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                  {svc.name}
                </span>
                {svc.startingAt && (
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--color-warn-text)' }}>
                    starts at
                  </span>
                )}
              </div>
              {svc.description && (
                <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
                  {svc.description}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {svc.tiers.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => handleAddPiercing(serviceItemName(svc, t), t.price)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-xs font-semibold transition-all"
                    style={{
                      background: 'var(--color-brand-subtle)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-brand-text)',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.background = 'var(--color-brand)';
                      el.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.background = 'var(--color-brand-subtle)';
                      el.style.color = 'var(--color-brand-text)';
                    }}
                  >
                    {svc.single ? 'Add' : t.label}
                    <span style={{ fontSize: '10px', color: 'inherit' }}>{servicePriceLabel(svc, t)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CUSTOM tab ── */}
      {category === 'CUSTOM' && (
        <div className="flex gap-2">
          <input
            placeholder="Placement name *"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="input flex-1"
          />
          <input
            placeholder="₱ Price"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value.replace(/\D/g, ''))}
            className="input"
            style={{ width: '96px', flex: 'none' }}
          />
          <button
            onClick={handleAddCustom}
            disabled={!customName.trim() || !customPrice}
            className="px-4 rounded-xl text-ui font-bold"
            style={{
              background: 'var(--color-brand)',
              color: '#fff',
              opacity: (!customName.trim() || !customPrice) ? 0.4 : 1,
              border: 'none',
            }}
          >
            Add
          </button>
        </div>
      )}

      {/* ── Standard placement chips ── */}
      {category !== 'CUSTOM' && category !== 'JEWELRY' && (
        <div className="flex flex-wrap gap-1.5">
          {placements.map((p) => (
            <button
              key={p.name}
              onClick={() => handleAddPiercing(p.name, p.basePrice)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-body-xs font-medium transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.background = 'var(--color-brand-subtle)';
                el.style.borderColor = 'var(--color-brand)';
                el.style.color = 'var(--color-brand-text)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.background = 'rgba(255,255,255,0.05)';
                el.style.borderColor = 'var(--color-border)';
                el.style.color = 'var(--color-text-muted)';
              }}
            >
              <span>{p.name}</span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>₱{p.basePrice}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
