import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'vite';
import { mediaAssets } from '../scripts/media-assets.ts';

test('production packaging preserves every media byte and uses hashed URLs for the optional media host', async () => {
  const origin = 'https://media.example.com';
  const result = await build({ configFile: false, logLevel: 'silent', plugins: [mediaAssets(origin)],
    build: { write: false, rollupOptions: { input: 'src/components/home/mediaItems.js', preserveEntrySignatures: 'strict' } } });
  const manifest = JSON.parse(result.output.find(item => item.fileName === 'media-manifest.json').source);
  assert.equal(manifest.assets.length, 28);
  assert.equal(manifest.assets.filter(asset => asset.file.endsWith('.mp4')).length, 12);
  const code = result.output.find(item => item.type === 'chunk').code;
  for (const asset of manifest.assets) {
    const original = readFileSync(`public${asset.source}`);
    const emitted = result.output.find(item => item.fileName === asset.file);
    assert.deepEqual(Buffer.from(emitted.source), original);
    assert.equal(asset.bytes, original.length);
    assert.ok(code.includes(`${origin}/${asset.file}`));
    assert.ok(!code.includes(`"${asset.source}"`));
  }
});

test('media host configuration rejects insecure URLs and paths', () => {
  for (const value of ['http://media.example.com', 'https://media.example.com/', 'https://media.example.com/path', 'https://user:secret@media.example.com']) {
    assert.throws(() => mediaAssets(value));
  }
});
