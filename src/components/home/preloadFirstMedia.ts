import type { MediaItem } from './mediaItems.js';
import { INTRO } from './introTimeline';
import { mediaPoster } from './mediaUtils';

export type PreloadResult = 'ready' | 'failed' | 'timeout' | 'aborted';
/** Decode the first visible poster. The playing video owns its only media request. */
export function preloadFirstMedia(item: MediaItem, signal: AbortSignal): Promise<PreloadResult> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve('aborted'); return; }
    const asset = new Image();
    let settled = false;
    const finish = (result: PreloadResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      asset.onload = null; asset.onerror = null;
      resolve(result);
    };
    const abort = () => finish('aborted');
    const timer = setTimeout(() => finish('timeout'), INTRO.preloadCapMs);
    signal.addEventListener('abort', abort, { once: true });
    asset.onerror = () => finish('failed');
    asset.decoding = 'async'; asset.fetchPriority = 'high';
    asset.onload = () => {
      if (typeof asset.decode === 'function') void asset.decode().then(() => finish('ready'), () => finish('failed'));
      else finish('ready');
    };
    asset.src = mediaPoster(item);
  });
}
