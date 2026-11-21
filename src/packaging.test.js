import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

const roots = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

async function fixture() {
  const root = await mkdtemp(join(process.env.TMPDIR || tmpdir(), 'hormuz-packaging-test-'));
  roots.push(root);
  const dist = join(root, 'dist');
  await mkdir(join(dist, 'music-audition'), { recursive: true });
  await mkdir(join(dist, 'assets'));
  await mkdir(join(dist, 'empty'));
  const files = {
    'index.html': '<!doctype html><script src="assets/game.js"></script>',
    'assets/game.js': 'console.log("island");\n'.repeat(100),
    'assets/game.css': 'body { color: blue; }\n'.repeat(100),
    'LICENSE.txt': 'Original license\n',
    'THIRD_PARTY_NOTICES.txt': 'Original notices\n',
    'assets/image.png': Buffer.from([0, 255, 1, 2]),
    'assets/data.constructor': Buffer.from([0, 255, 128, 1]),
    'assets/data.__proto__': Buffer.from([254, 0, 129, 2]),
    'music-audition/index.html': '<h1>Audition archive</h1>',
    'music-audition/track.wav': Buffer.from([1, 2, 3, 4]),
    'music-audition/LICENSE.txt': 'Music license',
  };
  await Promise.all(Object.entries(files).map(([path, data]) => writeFile(join(dist, path), data)));
  return { root, dist, files, out: join(root, 'release') };
}

function unzip(path) {
  const result = spawnSync('python3', ['-c', 'import sys,zipfile,json,base64; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({i.filename:base64.b64encode(z.read(i)).decode() for i in z.infolist()}))', path], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return Object.fromEntries(Object.entries(JSON.parse(result.stdout)).map(([name, bytes]) => [name, Buffer.from(bytes, 'base64')]));
}

async function pack(options) {
  const { packageWeb } = await import('../scripts/package-web.mjs');
  return packageWeb(options);
}

describe('web release packaging', () => {
  it('provides an explicit CLI that rejects omitted, duplicate, and unknown options', async () => {
    const { root, dist, out } = await fixture();
    const script = resolve('scripts/package-web.mjs');
    for (const args of [[], ['--dist', dist], ['--dist', dist, '--out', out, '--force'], ['--dist', dist, '--out', out, '--out', out]]) {
      const invalid = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
      expect(invalid.status).toBe(1);
      expect(invalid.stderr).toMatch(/usage|option|required/i);
    }
    expect(await readdir(root)).not.toContain('release');
    const help = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('--dist');
    const result = spawnSync(process.execPath, [script, '--dist', dist, '--out', out], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8')));
  });

  it('produces byte-identical ZIPs and manifests for repeated identical inputs', async () => {
    const { root, dist, out } = await fixture();
    await pack({ dist, out });
    const second = join(root, 'release-2');
    await pack({ dist, out: second });
    for (const name of ['full-archive.zip', 'gameplay-web.zip', 'manifest.json']) {
      expect(await readFile(join(out, name))).toEqual(await readFile(join(second, name)));
    }
  });

  it('cleans only generated staging data when Python cannot be started', async () => {
    const { root, dist, out } = await fixture();
    const result = spawnSync(process.execPath, [resolve('scripts/package-web.mjs'), '--dist', dist, '--out', out], { encoding: 'utf8', env: { ...process.env, PATH: join(root, 'no-executables') } });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/python3|ENOENT/i);
    expect(await readdir(out)).toEqual([]);
    expect(await readFile(join(dist, 'LICENSE.txt'), 'utf8')).toBe('Original license\n');
  });

  it('requires explicit source/output arguments and an existing output parent', async () => {
    const { root, dist } = await fixture();
    await expect(pack({ dist })).rejects.toThrow(/required/i);
    await expect(pack({ out: join(root, 'release') })).rejects.toThrow(/required/i);
    await expect(pack({ dist, out: join(root, 'missing', 'release') })).rejects.toThrow(/ENOENT|parent/i);
    expect(await readdir(root)).toEqual(['dist']);
  });
  it.each(['equal', 'inside', 'ancestor', 'symlink-parent'])('rejects overlapping source/output paths (%s) before writing', async kind => {
    const { root, dist } = await fixture();
    let out = kind === 'equal' ? dist : kind === 'inside' ? join(dist, 'release') : root;
    if (kind === 'symlink-parent') {
      await symlink(dist, join(root, 'alias'));
      out = join(root, 'alias', 'release');
    }
    await expect(pack({ dist, out })).rejects.toThrow(/overlap|nested/i);
    expect(await readFile(join(dist, 'LICENSE.txt'), 'utf8')).toBe('Original license\n');
    expect(await readdir(dist)).not.toContain('release');
  });

  it.each(['file', 'directory', 'root'])('rejects source symlinks (%s) instead of archiving their targets', async kind => {
    const { root, dist, out } = await fixture();
    if (kind === 'root') await symlink(dist, join(root, 'source-alias'));
    else await symlink(kind === 'file' ? join(dist, 'LICENSE.txt') : join(dist, 'assets'), join(dist, 'link'));
    await expect(pack({ dist: kind === 'root' ? join(root, 'source-alias') : dist, out })).rejects.toThrow(/symlink/i);
    expect(await readdir(root)).not.toContain('release');
  });

  it('rejects backslash archive paths and conflicting generated sidecars before writing', async () => {
    const { root, dist, out } = await fixture();
    await writeFile(join(dist, '..\\escape.txt'), 'unsafe');
    await expect(pack({ dist, out })).rejects.toThrow(/unsafe|path/i);
    await rm(join(dist, '..\\escape.txt'));
    await writeFile(join(dist, 'index.html.br'), 'existing sidecar');
    await expect(pack({ dist, out })).rejects.toThrow(/collision|sidecar/i);
    expect(await readdir(root)).not.toContain('release');
  });

  it('refuses all existing output directories without touching sentinel release files', async () => {
    const { dist, out } = await fixture();
    await mkdir(out);
    await writeFile(join(out, 'full-archive.zip'), 'published release');
    await expect(pack({ dist, out })).rejects.toThrow(/exist/i);
    expect(await readFile(join(out, 'full-archive.zip'), 'utf8')).toBe('published release');
    expect(await readdir(out)).toEqual(['full-archive.zip']);
  });
  it.each(['constructor', '__proto__'])('preserves unknown .%s files without generated text sidecars', async extension => {
    const { dist, out, files } = await fixture();
    await pack({ dist, out });
    const manifest = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8'));
    const name = `assets/data.${extension}`;
    for (const key of ['full', 'gameplay']) {
      const metadata = manifest.artifacts[key];
      const archive = unzip(join(out, metadata.path));
      expect(archive[name]).toEqual(files[name]);
      expect(metadata.entries.find(entry => entry.path === name)).not.toHaveProperty('contentType');
      for (const suffix of ['br', 'gz']) {
        expect(archive[`${name}.${suffix}`]).toBeUndefined();
        expect(metadata.entries.some(entry => entry.path === `${name}.${suffix}`)).toBe(false);
      }
      for (const entry of metadata.entries.filter(entry => entry.encoding)) {
        expect(entry.contentType).toBeTypeOf('string');
        expect(entry.contentType).toMatch(/^(text\/|application\/)/);
      }
    }
  });

  it.each(['constructor', '__proto__'])('does not reserve sidecar names for unknown .%s files', async extension => {
    const { dist, out, files } = await fixture();
    const name = `assets/data.${extension}`;
    for (const suffix of ['br', 'gz']) {
      files[`${name}.${suffix}`] = Buffer.from([255, 0, 127]);
      await writeFile(join(dist, `${name}.${suffix}`), files[`${name}.${suffix}`]);
    }
    const manifest = await pack({ dist, out });
    for (const key of ['full', 'gameplay']) {
      const archive = unzip(join(out, manifest.artifacts[key].path));
      for (const path of [name, `${name}.br`, `${name}.gz`]) {
        expect(archive[path]).toEqual(files[path]);
        const entry = manifest.artifacts[key].entries.find(entry => entry.path === path);
        expect(entry).not.toHaveProperty('encoding');
        expect(entry).not.toHaveProperty('contentType');
      }
    }
  });

  it('adds reversible text encodings only to gameplay with verifiable manifest metadata', async () => {
    const { dist, out, files } = await fixture();
    const result = await pack({ dist, out });
    const manifest = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8'));
    expect(result).toEqual(manifest);
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.compression).toMatchObject({ brotli: { quality: 11 }, gzip: { level: 9 }, requiresServerConfiguration: true });
    const gameplay = unzip(join(out, 'gameplay-web.zip'));
    const full = unzip(join(out, 'full-archive.zip'));
    for (const name of ['index.html', 'assets/game.js', 'assets/game.css', 'LICENSE.txt', 'THIRD_PARTY_NOTICES.txt']) {
      expect(brotliDecompressSync(gameplay[name + '.br'])).toEqual(Buffer.from(files[name]));
      expect(gunzipSync(gameplay[name + '.gz'])).toEqual(Buffer.from(files[name]));
      expect(full[name + '.br']).toBeUndefined();
      expect(full[name + '.gz']).toBeUndefined();
    }
    expect(gameplay['assets/image.png.br']).toBeUndefined();
    for (const [key, archive] of [['gameplay', gameplay], ['full', full]]) {
      const metadata = manifest.artifacts[key];
      const bytes = await readFile(join(out, metadata.path));
      expect(metadata.bytes).toBe(bytes.length);
      expect(metadata.sha256).toBe(sha256(bytes));
      expect(metadata.entryCount).toBe(Object.keys(archive).length);
      expect(metadata.entries.map(entry => entry.path).sort()).toEqual(Object.keys(archive).sort());
      for (const entry of metadata.entries) {
        expect(entry.bytes).toBe(archive[entry.path].length);
        expect(entry.sha256).toBe(sha256(archive[entry.path]));
        if (entry.encoding) {
          expect(entry).toMatchObject({ source: entry.path.replace(/\.(br|gz)$/, ''), vary: 'Accept-Encoding' });
          expect(entry.contentType).toMatch(/^(text\/|application\/)/);
        }
      }
    }
    expect(manifest.artifacts.gameplay.entries.find(entry => entry.path === 'assets/game.js.br')).toMatchObject({ encoding: 'br', contentType: 'text/javascript; charset=utf-8' });
    expect(manifest.artifacts.gameplay.entries.find(entry => entry.path === 'assets/game.css.gz')).toMatchObject({ encoding: 'gzip', contentType: 'text/css; charset=utf-8' });
  });
  it('splits gameplay from a lossless full archive without changing source files', async () => {
    const { dist, out, files } = await fixture();
    await pack({ dist, out });
    const full = unzip(join(out, 'full-archive.zip'));
    const gameplay = unzip(join(out, 'gameplay-web.zip'));
    expect(Object.keys(full).filter(name => !name.endsWith('/')).sort()).toEqual(Object.keys(files).sort());
    expect(full['empty/']).toEqual(Buffer.alloc(0));
    expect(Object.keys(gameplay).some(name => name.startsWith('music-audition/'))).toBe(false);
    for (const [name, bytes] of Object.entries(files)) {
      expect(full[name]).toEqual(Buffer.from(bytes));
      expect(await readFile(join(dist, name))).toEqual(Buffer.from(bytes));
      if (!name.startsWith('music-audition/')) expect(gameplay[name]).toEqual(Buffer.from(bytes));
    }
    expect((await readdir(out)).sort()).toEqual(['full-archive.zip', 'gameplay-web.zip', 'manifest.json']);
  });
});
