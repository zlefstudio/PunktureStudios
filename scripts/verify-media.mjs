import { readFileSync } from 'node:fs';

const { origin, assets } = JSON.parse(readFileSync('dist/media-manifest.json', 'utf8'));
if (!origin && process.argv.includes('--if-configured')) {
  console.log('Media uses Firebase Hosting; external verification is not needed.');
  process.exit(0);
}
if (!origin) throw new Error('Build with VITE_MEDIA_BASE_URL before checking the external media release.');
for (const asset of assets) {
  const response = await fetch(`${origin}/${asset.file}`, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(15000) });
  const expected = asset.file.endsWith('.mp4') ? 'video/mp4' : asset.file.endsWith('.png') ? 'image/png' : 'image/jpeg';
  await response.body?.cancel();
  // Workers Static Assets may return a complete 200 response rather than honour Range.
  // Short reels play normally with full-file delivery; still require the exact size.
  const lengthMatches = response.status === 206
    ? response.headers.get('content-range') === `bytes 0-0/${asset.bytes}`
    : response.status === 200 && response.headers.get('content-length') === String(asset.bytes);
  if (!lengthMatches ||
      !response.headers.get('content-type')?.startsWith(expected) || !response.headers.get('cache-control')?.includes('immutable')) {
    throw new Error(`Media release is not ready: ${asset.file} (${response.status}). Do not deploy the frontend.`);
  }
}
console.log(`Verified all ${assets.length} media URLs, exact file sizes, content types and immutable caching.`);
