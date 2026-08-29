import { useState } from 'react';
import { useStore } from '../store';
import { PLACEMENTS, UPGRADES, JEWELRY_OPTIONS } from '../constants';
import type { Ticket, PlacementCategory } from '../types';

const CATEGORIES: PlacementCategory[] = ['EAR', 'ORAL', 'FACE', 'BODY', 'CUSTOM', 'JEWELRY'];

const TAB_LABELS: Record<PlacementCategory, string> = {
  EAR: 'EAR',
  ORAL: 'ORAL',
  FACE: 'FACE',
  BODY: 'BODY',
  CUSTOM: 'CUSTOM',
  JEWELRY: '💍 JEWELRY',
};

interface Props {
  ticket: Ticket;
}

export function AddPiercingPanel({ ticket }: Props) {
  const addItem = useStore((s) => s.addItem);

  const [category, setCategory] = useState<PlacementCategory>('EAR');

  // Custom form state
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  const placements = PLACEMENTS.filter((p) => p.category === category);

  /** Add a standard piercing (basePrice from catalog, default upgrade = Free, qty 1) */
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

  /** Add a standalone jewelry item (basePrice = 0, price comes from the jewelry option) */
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
      <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-2">
        {category === 'JEWELRY' ? 'Add Jewelry' : 'Add Piercing'}
      </p>

      {/* Category tabs */}
      <div className="flex gap-1 mb-3 bg-white/5 p-1 rounded-lg flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
              category === cat
                ? cat === 'JEWELRY'
                  ? 'bg-amber-600 text-white'
                  : 'bg-violet-600 text-white'
                : 'text-slate-500 hover:text-white'
            }`}
          >
            {TAB_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* JEWELRY tab — shows paid jewelry options as one-tap chips */}
      {category === 'JEWELRY' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600">
            Standalone jewelry purchase — no piercing service included.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {JEWELRY_OPTIONS.map((j) => (
              <button
                key={j.label}
                onClick={() => handleAddJewelry(j.label, j.price)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 border border-amber-800/50 hover:border-amber-600/60 text-amber-200 hover:text-amber-100 text-xs font-semibold transition-all active:scale-95"
              >
                <span>💍</span>
                <span>{j.label.replace(' Jewelry', '')}</span>
                <span className="text-amber-500 text-[10px]">₱{j.price}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CUSTOM tab */}
      {category === 'CUSTOM' && (
        <div className="flex gap-2">
          <input
            placeholder="Placement name *"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="flex-1 bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500"
          />
          <input
            placeholder="₱ Price"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value.replace(/\D/g, ''))}
            className="w-24 bg-white/6 border border-white/12 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={handleAddCustom}
            disabled={!customName.trim() || !customPrice}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            Add
          </button>
        </div>
      )}

      {/* Standard placement chips (EAR / ORAL / FACE / BODY) */}
      {category !== 'CUSTOM' && category !== 'JEWELRY' && (
        <div className="flex flex-wrap gap-1.5">
          {placements.map((p) => (
            <button
              key={p.name}
              onClick={() => handleAddPiercing(p.name, p.basePrice)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/6 hover:bg-violet-900/50 hover:border-violet-600/60 border border-white/10 hover:text-violet-200 text-slate-300 text-xs font-medium transition-all active:scale-95"
            >
              <span>{p.name}</span>
              <span className="text-slate-500 text-[10px]">₱{p.basePrice}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
