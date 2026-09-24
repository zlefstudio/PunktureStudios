import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Preserve source filenames for studio editing; emit content-hashed production URLs. */
export function mediaAssets(origin = ''): Plugin {
  if (origin && (new URL(origin).origin !== origin || !origin.startsWith('https://'))) {
    throw new Error('VITE_MEDIA_BASE_URL must be an HTTPS origin without a trailing slash or path.');
  }
  let publicDir: string;
  const assets = new Map<string, { source: string; bytes: number }>();
  return {
    name: 'punkture-media-assets',
    apply: 'build',
    configResolved(config) { publicDir = config.publicDir; },
    buildStart() { assets.clear(); },
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/components/home/mediaItems.js')) return;
      return {
        code: code.replace(/"(src|poster)":\s*"(\/(?:videos|media)\/[^"?#]+)"/g, (_match, key: string, path: string) => {
          const file = resolve(publicDir, path.slice(1));
          this.addWatchFile(file);
          const source = readFileSync(file);
          if (source.length > 25 * 1024 * 1024) throw new Error(`Media exceeds the free host's 25 MiB file limit: ${path}`);
          const reference = this.emitFile({ type: 'asset', name: basename(path), source });
          assets.set(reference, { source: path, bytes: source.length });
          return `"${key}": import.meta.ROLLUP_FILE_URL_${reference}`;
        }),
        map: null,
      };
    },
    resolveFileUrl({ referenceId, fileName }) {
      if (origin && assets.has(referenceId)) return JSON.stringify(`${origin}/${fileName}`);
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'media-manifest.json', source: JSON.stringify({
        origin, assets: [...assets].map(([ref, value]) => ({ ...value, file: this.getFileName(ref) })),
      }, null, 2) });
    },
  };
}
