import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { buildEdge } from '../scripts/build-edge.mjs';

const origin = 'https://game.example';
function fixture(compact = false, BinaryArray = Uint8Array) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'golf-edge-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<html><head><title>Game</title><meta name="description" content="Play three original holes."></head><body>unchanged</body></html>');
  fs.writeFileSync(path.join(dir, 'assets/game-abc.js'), '/* game */'.repeat(200));
  fs.writeFileSync(path.join(dir, 'assets/physics-abc.wasm'), Buffer.from([0,97,115,109,1,0,0,0]));
  const output = path.join(dir, 'output/worker.js');
  buildEdge({ compact, dist: dir, output, origin, cover: new URL('../docs/images/hormuz-cover.png', import.meta.url).pathname });
  let handler;
  vm.runInNewContext(fs.readFileSync(output, 'utf8'), {
    Request, Response, Headers, URL, Uint8Array: BinaryArray, atob, DecompressionStream,
    addEventListener: (_, fn) => { handler = fn; },
  });
  const request = async (p = '/', headers = {}, method = 'GET') => {
    let response;
    handler({ request: new Request(origin + p, { method, headers }), respondWith: r => { response = r; } });
    return await response;
  };
  return { dir, request };
}

describe('Edge delivery and existing invitation previews', () => {
  it('decodes binary assets without the allocation-heavy iterable callback path', async () => {
    class BudgetArray extends Uint8Array {
      static from() { throw Error('Per-byte iterable callback exceeds request budget'); }
    }
    const { dir, request } = fixture(true, BudgetArray);
    const response = await request('/assets/physics-abc.wasm', { 'Accept-Encoding': 'gzip' });
    expect(gunzipSync(Buffer.from(await response.arrayBuffer()))).toEqual(fs.readFileSync(path.join(dir, 'assets/physics-abc.wasm')));
  });
  it('compact mode stores WASM once and retains identity fallback and link metadata', async () => {
    const { dir, request } = fixture(true);
    const script = fs.readFileSync(path.join(dir, 'output/worker.js'), 'utf8');
    const assets = JSON.parse(script.split('const ASSETS=new Map(')[1].split(');\nconst PAGES=')[0]);
    const wasm = assets.find(([name]) => name.endsWith('.wasm'))[1];
    expect(wasm.variants.br).toBeUndefined();
    expect(wasm.variants.identity.body).toBeUndefined();
    const original = fs.readFileSync(path.join(dir, 'assets/physics-abc.wasm'));
    for (const headers of [{}, { 'Accept-Encoding': 'br' }, { 'Accept-Encoding': 'identity' }]) {
      const r = await request('/assets/physics-abc.wasm', headers);
      expect(r.status).toBe(200);
      expect(Buffer.from(await r.arrayBuffer())).toEqual(original);
    }
    const gzip = await request('/assets/physics-abc.wasm', { 'Accept-Encoding': 'gzip' });
    expect(gzip.headers.get('content-encoding')).toBe('gzip');
    expect(gunzipSync(Buffer.from(await gzip.arrayBuffer()))).toEqual(original);
    expect(await (await request('/?island=hormuz&hole=5')).text()).toContain('Ochre Switchback');
  });
  it('serves original asset bytes and correctly negotiated WASM encodings', async () => {
    const { dir, request } = fixture();
    for (const name of ['game-abc.js', 'physics-abc.wasm']) {
      const original = fs.readFileSync(path.join(dir, 'assets', name));
      const identity = await request('/assets/' + name);
      expect(Buffer.from(await identity.arrayBuffer())).toEqual(original);
      for (const [encoding, decode] of [['br', brotliDecompressSync], ['gzip', gunzipSync]]) {
        const response = await request('/assets/' + name, { 'Accept-Encoding': encoding });
        expect(response.headers.get('content-encoding')).toBe(encoding);
        expect(response.headers.get('vary')).toBe('Accept-Encoding');
        expect(decode(Buffer.from(await response.arrayBuffer()))).toEqual(original);
      }
    }
    const wasm = await request('/assets/physics-abc.wasm');
    expect(wasm.headers.get('content-type')).toBe('application/wasm');
    expect(wasm.headers.get('cache-control')).toContain('immutable');
  });
  it('respects quality weights, exclusions, ETags, HEAD and unsupported methods', async () => {
    const { request } = fixture();
    const p = '/assets/game-abc.js';
    const identity = await request(p, { 'Accept-Encoding': 'br;q=0, gzip;q=0' });
    expect(identity.headers.get('content-encoding')).toBeNull();
    const gzip = await request(p, { 'Accept-Encoding': 'br;q=0.2, gzip;q=0.8' });
    expect(gzip.headers.get('content-encoding')).toBe('gzip');
    expect(gzip.headers.get('etag')).not.toBe(identity.headers.get('etag'));
    const head = await request(p, { 'Accept-Encoding': 'gzip' }, 'HEAD');
    expect(await head.text()).toBe('');
    expect(head.headers.get('etag')).toBe(gzip.headers.get('etag'));
    const cached = await request(p, { 'If-None-Match': `"other", W/${gzip.headers.get('etag')}`, 'Accept-Encoding': 'gzip' });
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe('');
    expect((await request(p, { 'Accept-Encoding': 'identity;q=0,*;q=0' })).status).toBe(406);
    expect((await request('/', {}, 'POST')).status).toBe(405);
    expect((await request('/assets/missing.wasm')).status).toBe(404);
  });
  it('selects bounded hole metadata without changing the app body or trusting raw query input', async () => {
    const { request } = fixture();
    const r = await request('/?island=hormuz&hole=5');
    const html = await r.text();
    expect(html).toContain('Hole 5: Ochre Switchback');
    expect(html).toContain('property="og:image"');
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html).not.toContain('Play three original holes.');
    expect(html).toContain('https://game.example/?island=hormuz&amp;hole=5');
    expect(html).toContain('<body>unchanged</body>');
    expect(r.headers.get('cache-control')).toBe('no-cache');
    const generic = await (await request('/')).text();
    for (const query of ['?island=hormuz&hole=10', '?island=hormuz&hole=5&hole=6', '?island=qeshm', '?island=hormuz&hole=%3Cscript%3E']) {
      expect(await (await request('/' + query)).text()).toBe(generic);
    }
    const other = await request('/?island=hormuz&hole=6', { 'If-None-Match': r.headers.get('etag') });
    expect(other.status).toBe(200);
  });
});
