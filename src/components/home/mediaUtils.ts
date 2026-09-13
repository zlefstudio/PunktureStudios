import type { MediaItem } from './mediaItems.js';
// Real films can supply a poster in the same manifest; demos use seeded stills.
export function mediaPoster(item: MediaItem) {
  return item.type === 'image' ? item.src : item.poster || `https://picsum.photos/seed/punkture-${item.id}/640/800`;
}
