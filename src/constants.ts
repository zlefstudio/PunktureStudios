import type { PlacementEntry, UpgradeOption } from './types';

// ---------------------------------------------------------------------------
// PLACEMENT CATALOG — POP-UP RATE CARD (staff cashier)
// The staff POS always charges the POP-UP column of the rate sheet. The public
// booking page keeps its own studio-priced catalog in booking/types.ts.
// ---------------------------------------------------------------------------

export const PLACEMENTS: PlacementEntry[] = [
  // EAR
  { name: 'Lobe', basePrice: 250, category: 'EAR' },
  { name: 'Stack Lobe', basePrice: 300, category: 'EAR' },
  { name: 'Auricle', basePrice: 300, category: 'EAR' },
  { name: 'Helix', basePrice: 350, category: 'EAR' },
  { name: 'Hidden Helix', basePrice: 350, category: 'EAR' },
  { name: 'Forward Helix', basePrice: 350, category: 'EAR' },
  { name: 'Flat', basePrice: 350, category: 'EAR' },
  { name: 'Conch', basePrice: 350, category: 'EAR' },
  { name: 'Contra Conch', basePrice: 400, category: 'EAR' },
  { name: 'Faux Rook', basePrice: 400, category: 'EAR' },
  { name: 'Rook', basePrice: 400, category: 'EAR' },
  { name: 'Hidden Rook', basePrice: 400, category: 'EAR' },
  { name: 'Daith', basePrice: 400, category: 'EAR' },
  { name: 'Snug', basePrice: 400, category: 'EAR' },
  { name: 'Tragus', basePrice: 400, category: 'EAR' },
  { name: 'Anti Tragus', basePrice: 450, category: 'EAR' },
  { name: 'Industrial', basePrice: 600, category: 'EAR' },

  // ORAL
  { name: 'Labret', basePrice: 300, category: 'ORAL' },
  { name: 'Vertical Labret', basePrice: 350, category: 'ORAL' },
  { name: 'Ashley', basePrice: 350, category: 'ORAL' },
  { name: 'Smiley', basePrice: 350, category: 'ORAL' },
  { name: 'Madonna', basePrice: 300, category: 'ORAL' },
  { name: 'Monroe', basePrice: 300, category: 'ORAL' },
  { name: 'Medusa', basePrice: 300, category: 'ORAL' },
  { name: 'Tongue', basePrice: 400, category: 'ORAL' },
  { name: 'Jestrum', basePrice: 450, category: 'ORAL' },
  { name: 'Spider Bites', basePrice: 550, category: 'ORAL' },
  { name: 'Snake Bites', basePrice: 550, category: 'ORAL' },
  { name: 'Angel Fangs', basePrice: 600, category: 'ORAL' },

  // FACE
  { name: 'Nostril', basePrice: 350, category: 'FACE' },
  { name: 'Eyebrow', basePrice: 400, category: 'FACE' },
  { name: 'Septum', basePrice: 400, category: 'FACE' },
  { name: 'Dahlia', basePrice: 450, category: 'FACE' },
  { name: 'Dimple', basePrice: 500, category: 'FACE' },
  { name: 'Anti Eyebrow', basePrice: 800, category: 'FACE' },

  // BODY
  { name: 'Navel', basePrice: 450, category: 'BODY' },
  { name: 'Floating Navel', basePrice: 500, category: 'BODY' },
  { name: 'Nipple (single)', basePrice: 400, category: 'BODY' },
];

// ---------------------------------------------------------------------------
// UPGRADE OPTIONS (initial jewelry material)
// ---------------------------------------------------------------------------

export const UPGRADES: UpgradeOption[] = [
  { label: 'Free Stainless Studs', price: 0 },
  { label: '+50 Rhinestone Stainless', price: 50 },
  { label: '150 Titanium', price: 150 },
  { label: '200 Titanium', price: 200 },
];

// Standalone jewelry sales — same options as upgrades, but the free studs are
// excluded (you're buying a physical piece, so it must cost something)
export const JEWELRY_OPTIONS: UpgradeOption[] = UPGRADES.filter((u) => u.price > 0);

/** Compact label for tight upgrade/jewelry buttons (ItemsList, staff chips). */
export function shortUpgradeLabel(price: number, label: string): string {
  if (price === 0) return 'Stainless Studs';
  if (price === 50) return '+50 Rhinestone';
  return label; // e.g. "150 Titanium" / "200 Titanium"
}

// ---------------------------------------------------------------------------
// OTHER SERVICES (add-on services + aftercare)
// Shown in the staff cashier (SERVICES tab) and the public booking funnel
// (Others tab). "My Work" = piercing/jewelry originally done at Punkture.
// ---------------------------------------------------------------------------

export interface ServiceTier {
  label: string;
  price: number;
  /** true when the price shown is a floor (e.g. embedded removal: ₱100+). */
  plus?: boolean;
}

export interface OtherService {
  name: string;
  description: string;
  /** Single fixed-price service (no My Work / Not My Work split). */
  single?: boolean;
  /** When true, prices are starting rates confirmed at the studio. */
  startingAt?: boolean;
  tiers: ServiceTier[];
}

export const OTHER_SERVICES: OtherService[] = [
  {
    name: 'Downsizing',
    description: 'Swap to a shorter, more comfortable fit once healed.',
    tiers: [
      { label: 'My Work', price: 100 },
      { label: 'Not My Work', price: 150 },
    ],
  },
  {
    name: 'Upsizing',
    description: 'Change into a longer or roomier piece when needed.',
    tiers: [
      { label: 'My Work', price: 100 },
      { label: 'Not My Work', price: 150 },
    ],
  },
  {
    name: 'Jewelry Installation',
    description: 'We put in new or existing jewelry for you.',
    tiers: [
      { label: 'My Work', price: 100 },
      { label: 'Not My Work', price: 150 },
    ],
  },
  {
    name: 'Jewelry Removal',
    description: 'Safe removal of old or no-longer-wanted jewelry.',
    startingAt: true,
    tiers: [
      { label: 'My Work', price: 100 },
      { label: 'Not My Work', price: 150 },
      { label: 'Embedded', price: 100, plus: true },
    ],
  },
  {
    name: 'Piercing Cleaning (Per Ear)',
    description: 'Deep clean and check-up for an irritated or crusty piercing.',
    tiers: [
      { label: 'My Work', price: 200 },
      { label: 'Not My Work', price: 250 },
    ],
  },
  {
    name: 'Aftercare Solution',
    description: 'Sterile saline solution for everyday aftercare.',
    single: true,
    tiers: [{ label: 'Standard', price: 150 }],
  },
];

/** Line-item name recorded for a chosen service (tier is included when relevant). */
export function serviceItemName(service: OtherService, tier: ServiceTier): string {
  return service.single ? service.name : `${service.name} (${tier.label})`;
}

/** Human price text, e.g. "₱150", "from ₱100", "from ₱100+". */
export function servicePriceLabel(service: OtherService, tier: ServiceTier): string {
  const prefix = service.startingAt ? 'from ' : '';
  const suffix = tier.plus ? '+' : '';
  return `${prefix}₱${tier.price}${suffix}`;
}

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
