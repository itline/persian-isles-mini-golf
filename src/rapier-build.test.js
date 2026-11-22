import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const packageDir = dirname(require.resolve('@dimforge/rapier3d-compat/package.json'));
const source = readFileSync(join(packageDir, 'rapier.es.js'), 'utf8');
const wasm = readFileSync(join(packageDir, 'rapier_wasm3d_bg.wasm'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

describe('pinned Rapier build transport', () => {
  it('externalizes the unique byte-identical embedded binary and keeps all wrappers', async () => {
    const { externalizeRapier } = await import('../scripts/rapier-build.mjs');
    const result = externalizeRapier({ version: '0.11.2', source, wasm, assetExpression: 'WASM_ASSET_URL' });
    expect(hash(wasm)).toBe('425749aa8b9c239ffd1958ac5c9c1184590278b53c1c676c7509a1511bc8b7d2');
    expect(result).toContain('yield EA(WASM_ASSET_URL)');
    const expression = /OI\.toByteArray\("[A-Za-z0-9+/=]+"\)\.buffer/g;
    expect([...source.matchAll(expression)]).toHaveLength(1);
    expect(result).toBe(source.replace(expression, 'WASM_ASSET_URL'));
    expect(result).not.toContain('AGFzbQEAAAABrwuT');
  });

  it('fails closed for version, source, binary and embedded-literal drift', async () => {
    const { externalizeRapier } = await import('../scripts/rapier-build.mjs');
    const valid = { version: '0.11.2', source, wasm, assetExpression: 'url' };
    expect(() => externalizeRapier({ ...valid, version: '0.11.3' })).toThrow(/exact version/);
    expect(() => externalizeRapier({ ...valid, source: source + '\n' })).toThrow(/source hash/);
    expect(() => externalizeRapier({ ...valid, wasm: Buffer.from('wrong') })).toThrow(/binary hash/);
    expect(() => externalizeRapier({ ...valid, source: source.replace('AGFzbQEAAAABrwuT', 'BGFzbQEAAAABrwuT') })).toThrow(/binary hash/);
    const literal = source.match(/OI\.toByteArray\("[A-Za-z0-9+/=]+"\)\.buffer/)[0];
    expect(() => externalizeRapier({ ...valid, source: source.replace(literal, 'null') })).toThrow(/unique embedded/);
    expect(() => externalizeRapier({ ...valid, source: source + literal })).toThrow(/unique embedded/);
  });

  it.each(['/nested/game/', './'])('emits the exact binary with base %s, omits auditions and preserves originals/notices', async (base) => {
    const { rapierBuild, gameplayBuild } = await import('../scripts/rapier-build.mjs');
    const { build } = await import('vite');
    const { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const root = mkdtempSync(join(tmpdir(), 'rapier-build-test-'));
    try {
      mkdirSync(join(root, 'public/music-audition'), { recursive: true });
      writeFileSync(join(root, 'public/music-audition/keep.txt'), 'original audition');
      writeFileSync(join(root, 'public/NOTICE.txt'), 'original notice');
      writeFileSync(join(root, 'index.html'), '<script type="module" src="/entry.js"></script>');
      writeFileSync(join(root, 'entry.js'), `import R from ${JSON.stringify(join(packageDir, 'rapier.es.js'))}; await R.init(); console.log(R.version(), new R.World({x:0,y:-9.81,z:0}));`);
      await build({ root, configFile: false, base, logLevel: 'silent', plugins: [rapierBuild(), gameplayBuild()] });
      const assets = readdirSync(join(root, 'dist/assets'));
      const emitted = assets.filter(name => name.endsWith('.wasm'));
      expect(emitted).toHaveLength(1);
      expect(readFileSync(join(root, 'dist/assets', emitted[0]))).toEqual(wasm);
      const js = assets.filter(name => name.endsWith('.js')).map(name => readFileSync(join(root, 'dist/assets', name), 'utf8')).join('\n');
      if (base === './') {
        expect(js).toContain('new URL(`' + emitted[0] + '`,import.meta.url).href');
      } else expect(js).toContain(base + 'assets/' + emitted[0]);
      expect(js).not.toContain('AGFzbQEAAAABrwuT');
      expect(readdirSync(join(root, 'dist'))).not.toContain('music-audition');
      expect(readFileSync(join(root, 'public/music-audition/keep.txt'), 'utf8')).toBe('original audition');
      expect(readFileSync(join(root, 'dist/NOTICE.txt'), 'utf8')).toBe('original notice');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('retains the original runtime exports, version and deterministic fixed-step trajectory', async () => {
    const { externalizeRapier } = await import('../scripts/rapier-build.mjs');
    const external = externalizeRapier({ version: '0.11.2', source, wasm, assetExpression: JSON.stringify('data:application/wasm;base64,' + wasm.toString('base64')) });
    const originalRuntime = await import(/* @vite-ignore */ 'data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    const externalRuntime = await import(/* @vite-ignore */ 'data:text/javascript;base64,' + Buffer.from(external).toString('base64'));
    expect(Object.keys(externalRuntime).sort()).toEqual(Object.keys(originalRuntime).sort());
    async function simulate(module) {
      const R = module.default;
      await R.init();
      expect(R.version()).toBe('0.11.2');
      const world = new R.World({ x: 0, y: -9.81, z: 0 });
      try {
        world.timestep = 1 / 120;
        world.createCollider(R.ColliderDesc.cuboid(10, 0.1, 10));
        const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 1, 0));
        world.createCollider(R.ColliderDesc.ball(0.145).setRestitution(0.5), body);
        body.applyImpulse({ x: 0.03, y: 0, z: 0.02 }, true);
        const samples = [];
        for (let i = 0; i < 240; i++) {
          world.step();
          if (i % 20 === 0) samples.push({ ...body.translation() });
        }
        return samples;
      } finally { world.free(); }
    }
    expect(await simulate(externalRuntime)).toEqual(await simulate(originalRuntime));
  });

  it('reports a useful missing dependency error before building', async () => {
    const { rapierBuild } = await import('../scripts/rapier-build.mjs');
    expect(() => rapierBuild({ dependencyDir: '/nonexistent/rapier-build-fixture' })).toThrow(/Rapier build.*missing.*npm ci/i);
  });
});
