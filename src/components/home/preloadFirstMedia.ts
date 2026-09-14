import type { MediaItem } from './mediaItems.js';
import { INTRO } from './introTimeline';

export type PreloadResult = 'ready' | 'failed' | 'timeout' | 'aborted';
/** Only the first actual media asset is a readiness dependency. No simulated progress. */
export function preloadFirstMedia(item: MediaItem, signal: AbortSignal): Promise<PreloadResult> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve('aborted'); return; }
    const asset = item.type === 'video' ? document.createElement('video') : new Image();
    let settled = false;
    const finish = (result: PreloadResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      asset.onload = null; asset.onerror = null;
      if (asset instanceof HTMLVideoElement) {
        asset.onloadeddata = null;
        asset.removeAttribute('src'); asset.load();
      }
      resolve(result);
    };
    const abort = () => finish('aborted');
    const timer = setTimeout(() => finish('timeout'), INTRO.preloadCapMs);
    signal.addEventListener('abort', abort, { once: true });
    asset.onerror = () => finish('failed');
    if (asset instanceof HTMLVideoElement) {
      asset.muted = true; asset.playsInline = true; asset.preload = 'auto';
      asset.onloadeddata = () => finish('ready');
      asset.src = item.src;
    } else {
      asset.decoding = 'async'; asset.fetchPriority = 'high';
      asset.onload = () => {
        // Decode before exposing the first card, within the same hard cap.
        if (typeof asset.decode === 'function') void asset.decode().then(() => finish('ready'), () => finish('failed'));
        else finish('ready');
      };
      asset.src = item.src;
    }
  });
}
