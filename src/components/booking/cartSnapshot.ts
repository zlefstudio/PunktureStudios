import type { BookingSelectedPiercing } from '../../types';

export const CART_DRAFT_KEY = 'punkture.booking-cart.v1';
export const MAX_BOOKING_NOTES = 20000;
export const itemEstimate = (item: BookingSelectedPiercing) =>
  (item.basePrice + (item.upgradePrice ?? 0)) * (item.side === 'both' ? 2 : 1);

export function bookingCartNotes(items: BookingSelectedPiercing[], notes: string): string {
  const lines = items.length ? [
    `Selected items (${items.length}):`,
    ...items.map((item, index) => [
      `${index + 1}. ${item.name}${item.side ? ` (${item.side === 'both' ? 'both ears · 2×' : item.side})` : ''}`,
      `Piercing/service: ₱${item.basePrice} · Jewelry: ${item.upgradeLabel || 'No paid upgrade'} (₱${item.upgradePrice ?? 0}) · Line estimate: ₱${itemEstimate(item)}`,
      ...[item.notes, item.customNotes].filter(Boolean),
    ].join('\n')),
    `Total estimate: ₱${items.reduce((sum, item) => sum + itemEstimate(item), 0)}`,
  ] : ['No items selected — consultation only.'];
  if (notes.trim()) lines.push(`Client notes: ${notes.trim()}`);
  const result = lines.join('\n');
  if (result.length > MAX_BOOKING_NOTES) throw new Error('Your selection details are too long. Please shorten your notes before continuing; no items have been removed.');
  return result;
}

export function readCartDraft(): BookingSelectedPiercing[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(CART_DRAFT_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is BookingSelectedPiercing => !!item &&
      typeof item.id === 'string' && typeof item.name === 'string' &&
      ['EAR','ORAL','FACE','BODY','CUSTOM','JEWELRY'].includes(item.category) &&
      Number.isFinite(item.basePrice) && item.basePrice >= 0 &&
      (item.upgradePrice === undefined || (Number.isFinite(item.upgradePrice) && item.upgradePrice >= 0)) &&
      (item.side === undefined || ['left','right','both'].includes(item.side)));
  } catch { return []; }
}
export function saveCartDraft(items: BookingSelectedPiercing[]) {
  try { sessionStorage.setItem(CART_DRAFT_KEY, JSON.stringify(items)); } catch { /* Storage may be unavailable in private browsing. */ }
}
export function clearCartDraft() {
  try { sessionStorage.removeItem(CART_DRAFT_KEY); } catch { /* No persisted draft. */ }
}
