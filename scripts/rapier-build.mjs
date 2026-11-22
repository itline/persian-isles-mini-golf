import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);

const SOURCE_SHA256 = '9f8ba0f4fca4b7f8993e293466db484eef1874ae6f0cec23f6d2cc06aa96c275';
const WASM_SHA256 = '425749aa8b9c239ffd1958ac5c9c1184590278b53c1c676c7509a1511bc8b7d2';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// Transport-only change to the installed upstream file, never a vendored wrapper.
// Fail closed on dependency drift; deliberately do not support other versions.
export function externalizeRapier({ version, source, wasm, assetExpression }) {
  if (version !== '0.11.2') throw new Error('Rapier build requires exact version 0.11.2');
  const embedded = [...source.matchAll(/OI\.toByteArray\("([A-Za-z0-9+/=]+)"\)\.buffer/g)];
  if (embedded.length !== 1) throw new Error('Rapier build requires one unique embedded binary');
  const decoded = Buffer.from(embedded[0][1], 'base64');
  if (sha256(wasm) !== WASM_SHA256 || !decoded.equals(wasm)) throw new Error('Rapier build binary hash/equality mismatch');
  if (sha256(source) !== SOURCE_SHA256) throw new Error('Rapier build source hash mismatch');
  return source.replace(embedded[0][0], assetExpression);
}

export function rapierBuild({ dependencyDir } = {}) {
  let directory, version, source, wasm;
  try {
    directory = dependencyDir ?? dirname(require.resolve('@dimforge/rapier3d-compat/package.json'));
    version = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).version;
    source = readFileSync(join(directory, 'rapier.es.js'), 'utf8');
    wasm = readFileSync(join(directory, 'rapier_wasm3d_bg.wasm'));
  } catch (cause) {
    throw new Error('Rapier build dependency missing or unreadable; run npm ci', { cause });
  }
  const modulePath = resolve(directory, 'rapier.es.js');
  // Validate even if tree-shaking happens to omit the package from an entry.
  externalizeRapier({ version, source, wasm, assetExpression: 'url' });
  return {
    name: 'pinned-rapier-external-wasm',
    apply: 'build',
    enforce: 'pre',
    load(id) {
      if (id !== modulePath) return null;
      const reference = this.emitFile({ type: 'asset', name: 'rapier-0.11.2.wasm', source: wasm });
      this.addWatchFile(modulePath);
      this.addWatchFile(join(directory, 'rapier_wasm3d_bg.wasm'));
      return {
        code: externalizeRapier({ version, source, wasm, assetExpression: `import.meta.ROLLUP_FILE_URL_${reference}` }),
        map: null,
      };
    },
  };
}

// Vite's automatic public copy has no exclude option. Copy the remaining public
// files as build assets instead: no deletion, staging tree, or outDir cleanup.
export function gameplayBuild() {
  let publicDir;
  return {
    name: 'gameplay-public-assets',
    apply: 'build',
    config: () => ({ build: { copyPublicDir: false } }),
    configResolved(config) { publicDir = config.publicDir; },
    buildStart() {
      if (!publicDir) return;
      const visit = (directory, prefix = '') => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const fileName = prefix + entry.name;
          if (fileName === 'music-audition') continue;
          const path = join(directory, entry.name);
          if (entry.isDirectory()) visit(path, fileName + '/');
          else if (entry.isFile()) {
            this.addWatchFile(path);
            this.emitFile({ type: 'asset', fileName, source: readFileSync(path) });
          }
        }
      };
      visit(publicDir);
    },
  };
}
