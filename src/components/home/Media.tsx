import { useRef, useEffect, useState } from 'react';
import type { MediaItem } from './mediaItems.js';
import { mediaPoster } from './mediaUtils';

export function Media({ item, playing = false, viewer = false }: { item: MediaItem; playing?: boolean; viewer?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [requested, setRequested] = useState(playing || viewer);
  useEffect(() => { if (playing) setRequested(true); }, [playing]);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (playing) void el.play().catch(() => { /* Muted autoplay may be blocked by device power policy. Poster remains available. */ });
    else el.pause();
  }, [playing, requested]);
  return <>
    <img className="pk-media-poster" src={mediaPoster(item)} alt="" loading={viewer ? 'eager' : 'lazy'} decoding="async" draggable={false}
      onError={e => { e.currentTarget.style.opacity = '0'; }} />
    {item.type === 'video' && requested && !failed && <video ref={video} src={item.src} muted loop playsInline
      autoPlay={playing} preload={viewer ? 'auto' : 'none'} poster={mediaPoster(item)} onError={() => setFailed(true)} aria-hidden="true" />}
    {failed && viewer && <span className="pk-media-error">Preview unavailable — sample poster shown</span>}
  </>;
}
