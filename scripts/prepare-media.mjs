import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

const manifest = JSON.parse(readFileSync('dist/media-manifest.json', 'utf8'));
const destination = resolve('dist-media');
// Additive staging retains older hashed files when staging successive releases locally.
for (const asset of manifest.assets) {
  const source = resolve('dist', asset.file);
  const target = resolve(destination, asset.file);
  if (!source.startsWith(resolve('dist') + sep) || !target.startsWith(destination + sep)) throw new Error('Invalid media path');
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
writeFileSync(resolve(destination, '_headers'), '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n  Access-Control-Allow-Origin: *\n  X-Content-Type-Options: nosniff\n');
console.log(`Staged ${manifest.assets.length} public media files (${(manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0) / 1e6).toFixed(2)} MB).`);
