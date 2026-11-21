import { lstat, mkdir, mkdtemp, open, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const TEXT_TYPES = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8', map: 'application/json; charset=utf-8',
  webmanifest: 'application/manifest+json; charset=utf-8',
  txt: 'text/plain; charset=utf-8', md: 'text/markdown; charset=utf-8',
  svg: 'image/svg+xml', xml: 'application/xml; charset=utf-8',
};

const ZIP_WRITER = `
import sys,json,zipfile,pathlib
root=pathlib.Path(sys.argv[1])
entries=json.load(sys.stdin)
with zipfile.ZipFile(sys.argv[2], 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for entry in entries:
        name=entry['path']
        info=zipfile.ZipInfo(name, (1980,1,1,0,0,0))
        info.create_system=3
        directory=name.endswith('/')
        info.external_attr=((0o40755 if directory else 0o100644)<<16) | (0x10 if directory else 0)
        info.compress_type=zipfile.ZIP_STORED if directory else zipfile.ZIP_DEFLATED
        archive.writestr(info, b'' if directory else (root/name).read_bytes(), compresslevel=9)
`;

async function collect(root, prefix = '') {
  const entries = [];
  for (const item of (await readdir(join(root, prefix), { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const path = prefix + item.name;
    if (/[\\:\u0000-\u001f\u007f]/u.test(item.name)) throw new Error(`Unsafe archive path: ${path}`);
    if (item.isSymbolicLink()) throw new Error(`Source symlink is not allowed: ${path}`);
    if (item.isDirectory()) entries.push({ path: path + '/' }, ...await collect(root, path + '/'));
    else if (item.isFile()) entries.push({ path });
    else throw new Error(`Unsupported source entry: ${path}`);
  }
  return entries;
}

function zip(stage, target, entries) {
  const result = spawnSync('python3', ['-c', ZIP_WRITER, stage, target], { input: JSON.stringify(entries), encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ZIP writer failed: ${result.stderr.trim()}`);
}

function contains(parent, child) {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

async function validatePaths(dist, out) {
  if (typeof dist !== 'string' || !dist || typeof out !== 'string' || !out) throw new Error('Explicit dist and out paths are required');
  const source = resolve(dist);
  const target = resolve(out);
  if (contains(source, target) || contains(target, source)) throw new Error('Source/output paths must not overlap or be nested');
  const stat = await lstat(source);
  if (stat.isSymbolicLink()) throw new Error('Source root symlink is not allowed');
  if (!stat.isDirectory()) throw new Error('Source must be a directory');
  const canonicalSource = await realpath(source);
  // The parent must already exist; resolve aliases before checking boundaries.
  const canonicalTarget = join(await realpath(dirname(target)), basename(target));
  if (contains(canonicalSource, canonicalTarget) || contains(canonicalTarget, canonicalSource)) throw new Error('Source/output paths must not overlap or be nested');
  return { source: canonicalSource, target: canonicalTarget };
}

export async function packageWeb({ dist, out } = {}) {
  const { source, target } = await validatePaths(dist, out);
  dist = source;
  out = target;
  const entries = await collect(dist);
  const names = new Set(entries.map(entry => entry.path.replace(/\/$/, '')));
  for (const entry of entries) {
    if (entry.path.startsWith('music-audition/') || entry.path.endsWith('/') || !Object.hasOwn(TEXT_TYPES, entry.path.split('.').at(-1).toLowerCase())) continue;
    for (const suffix of ['br', 'gz']) if (names.has(`${entry.path}.${suffix}`)) throw new Error(`Generated sidecar collision: ${entry.path}.${suffix}`);
  }
  // Atomic exclusive directory creation: existing releases are never opened.
  await mkdir(out);
  const stage = await mkdtemp(join(out, '.staging-'));
  try {
    for (const entry of entries) {
      const directory = entry.path.endsWith('/');
      const sourcePath = resolve(dist, entry.path);
      const canonicalPath = await realpath(sourcePath);
      if (!contains(dist, canonicalPath) || canonicalPath !== sourcePath) throw new Error(`Source changed or symlink encountered: ${entry.path}`);
      let bytes = Buffer.alloc(0);
      if (!directory) {
        const file = await open(sourcePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
        try {
          if (!(await file.stat()).isFile()) throw new Error(`Unsupported source entry: ${entry.path}`);
          bytes = await file.readFile();
        } finally { await file.close(); }
      }
      if (directory) await mkdir(join(stage, entry.path), { recursive: true });
      else await writeFile(join(stage, entry.path), bytes, { flag: 'wx' });
      Object.assign(entry, { bytes: bytes.length, sha256: sha256(bytes), kind: directory ? 'directory' : 'file' });
    }
    const gameplay = entries.filter(entry => !entry.path.startsWith('music-audition/'));
    for (const entry of [...gameplay]) {
      const extension = entry.path.split('.').at(-1).toLowerCase();
      const contentType = Object.hasOwn(TEXT_TYPES, extension) ? TEXT_TYPES[extension] : undefined;
      if (entry.kind !== 'file' || !contentType) continue;
      const bytes = await readFile(join(stage, entry.path));
      const encodings = [
        ['br', 'br', brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })],
        ['gz', 'gzip', gzipSync(bytes, { level: 9 })],
      ];
      for (const [suffix, encoding, encoded] of encodings) {
        const path = `${entry.path}.${suffix}`;
        await writeFile(join(stage, path), encoded, { flag: 'wx' });
        gameplay.push({ path, kind: 'file', bytes: encoded.length, sha256: sha256(encoded), source: entry.path, encoding, contentType, vary: 'Accept-Encoding' });
      }
    }
    const manifest = {
      schemaVersion: 1,
      compression: { brotli: { quality: 11 }, gzip: { level: 9 }, requiresServerConfiguration: true },
      artifacts: {},
    };
    for (const [key, path, archiveEntries] of [['full', 'full-archive.zip', entries], ['gameplay', 'gameplay-web.zip', gameplay]]) {
      archiveEntries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
      zip(stage, join(out, path), archiveEntries);
      const bytes = await readFile(join(out, path));
      manifest.artifacts[key] = { path, bytes: bytes.length, sha256: sha256(bytes), entryCount: archiveEntries.length, entries: archiveEntries };
    }
    await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    return manifest;
  } finally {
    // Remove only our own fresh staging directory, never the source or output root.
    await rm(stage, { recursive: true, force: true });
  }
}

const USAGE = 'Usage: node scripts/package-web.mjs --dist <existing-directory> --out <new-directory>';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') {
      process.stdout.write(USAGE + '\n');
    } else {
      const options = {};
      for (let index = 0; index < args.length; index += 2) {
        const option = args[index];
        if (!['--dist', '--out'].includes(option) || options[option.slice(2)] !== undefined || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Invalid or duplicate option. ${USAGE}`);
        options[option.slice(2)] = args[index + 1];
      }
      if (!options.dist || !options.out) throw new Error(`Both options are required. ${USAGE}`);
      process.stdout.write(JSON.stringify(await packageWeb(options), null, 2) + '\n');
    }
  } catch (error) {
    process.stderr.write(`Packaging failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
