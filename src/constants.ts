import type { PlacementEntry, UpgradeOption } from './types';

// ---------------------------------------------------------------------------
// PLACEMENT CATALOG
// ---------------------------------------------------------------------------

export const PLACEMENTS: PlacementEntry[] = [
  // EAR
  { name: 'Lobe', basePrice: 250, category: 'EAR' },
  { name: 'Auricle', basePrice: 300, category: 'EAR' },
  { name: 'Helix', basePrice: 350, category: 'EAR' },
  { name: 'Forward Helix', basePrice: 350, category: 'EAR' },
  { name: 'Flat', basePrice: 350, category: 'EAR' },
  { name: 'Conch', basePrice: 350, category: 'EAR' },
  { name: 'Faux Rook', basePrice: 400, category: 'EAR' },
  { name: 'Rook', basePrice: 400, category: 'EAR' },
  { name: 'Daith', basePrice: 400, category: 'EAR' },
  { name: 'Snug', basePrice: 400, category: 'EAR' },
  { name: 'Tragus', basePrice: 400, category: 'EAR' },
  { name: 'Anti Tragus', basePrice: 450, category: 'EAR' },
  { name: 'Industrial', basePrice: 600, category: 'EAR' },

  // ORAL
  { name: 'Labret', basePrice: 300, category: 'ORAL' },
  { name: 'Smiley', basePrice: 350, category: 'ORAL' },
  { name: 'Madonna', basePrice: 300, category: 'ORAL' },
  { name: 'Monroe', basePrice: 300, category: 'ORAL' },
  { name: 'Medusa', basePrice: 300, category: 'ORAL' },
  { name: 'Tongue', basePrice: 400, category: 'ORAL' },
  { name: 'Jestrum', basePrice: 450, category: 'ORAL' },
  { name: 'Spider Bites', basePrice: 450, category: 'ORAL' },
  { name: 'Angel Bites', basePrice: 450, category: 'ORAL' },
  { name: 'Snake Bites', basePrice: 450, category: 'ORAL' },
  { name: 'Angel Fangs', basePrice: 450, category: 'ORAL' },

  // FACE
  { name: 'Nostril', basePrice: 350, category: 'FACE' },
  { name: 'Eyebrow', basePrice: 400, category: 'FACE' },
  { name: 'Septum', basePrice: 400, category: 'FACE' },
  { name: 'Dahlia', basePrice: 450, category: 'FACE' },
  { name: 'Dimple', basePrice: 500, category: 'FACE' },

  // BODY
  { name: 'Navel', basePrice: 450, category: 'BODY' },
  { name: 'Floating Navel', basePrice: 500, category: 'BODY' },
  { name: 'Nipple (single)', basePrice: 400, category: 'BODY' },
];

// ---------------------------------------------------------------------------
// UPGRADE OPTIONS
// ---------------------------------------------------------------------------

export const UPGRADES: UpgradeOption[] = [
  { label: 'Free', price: 0 },
  { label: '+50 Titanium Jewelry', price: 50 },
  { label: '150 Titanium Jewelry', price: 150 },
  { label: '200 Titanium Jewelry', price: 200 },
];

// Standalone jewelry sales — same options as upgrades, but Free is excluded
// (you're buying a physical piece, so it must cost something)
export const JEWELRY_OPTIONS: UpgradeOption[] = UPGRADES.filter((u) => u.price > 0);

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

export function lineTotal(basePrice: number, upgradePrice: number, quantity: number): number {
  return (basePrice + upgradePrice) * quantity;
}

export function ticketTotal(items: { basePrice: number; upgradePrice: number; quantity: number }[]): number {
  return items.reduce((sum, i) => sum + lineTotal(i.basePrice, i.upgradePrice, i.quantity), 0);
}

export function peso(amount: number): string {
  return `₱${amount}`;
}
