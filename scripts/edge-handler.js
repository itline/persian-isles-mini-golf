// Provider-neutral fetch-event adapter. No origin fetches or account secrets.
export function installEdge(assets, pages, version) {
  const decoded = new Map();
  function bytes(representation) {
    if (representation.text) return representation.body;
    if (!decoded.has(representation.etag)) {
      const binary = atob(representation.body);
      // Avoid the iterable/callback path: it creates per-byte intermediate
      // allocations and is costly under a provider's per-request CPU budget.
      const buffer = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
      decoded.set(representation.etag, buffer);
    }
    return decoded.get(representation.etag);
  }
  function negotiate(header, variants) {
    if (!header) return 'identity';
    const weights = new Map();
    for (const part of header.toLowerCase().split(',')) {
      const [name, ...parameters] = part.trim().split(';');
      const q = parameters.find(p => p.trim().startsWith('q='));
      const value = q ? Number(q.trim().slice(2)) : 1;
      weights.set(name, Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0);
    }
    const quality = name => weights.get(name) ?? (name === 'identity'
      ? (weights.get('*') === 0 ? 0 : 1) : weights.get('*') ?? 0);
    // Prefer an explicitly accepted encoding to implicit identity; otherwise
    // respect explicit identity preference and never send a forbidden encoding.
    const candidates = ['br', 'gzip', 'identity'].filter(name => variants[name] && quality(name) > 0);
    candidates.sort((a, b) => {
      const qa = a === 'identity' && !weights.has('identity') ? 0.001 : quality(a);
      const qb = b === 'identity' && !weights.has('identity') ? 0.001 : quality(b);
      return qb - qa;
    });
    return candidates[0];
  }
  addEventListener('fetch', event => event.respondWith(handle(event.request)));
  async function handle(request) {
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    const url = new URL(request.url);
    const key = url.pathname === '/' ? '/index.html' : url.pathname;
    let asset = assets.get(key);
    if (!asset) return new Response(request.method === 'HEAD' ? null : 'Not Found', { status: 404 });
    if (key === '/index.html') {
      const island = url.searchParams.getAll('island'), hole = url.searchParams.getAll('hole');
      const valid = island.length === 1 && island[0] === 'hormuz' && hole.length <= 1;
      const page = valid && !hole.length ? 'journey'
        : valid && /^[1-9]$/.test(hole[0] ?? '') ? hole[0] : 'generic';
      asset = pages[page];
    }
    const encoding = negotiate(request.headers.get('Accept-Encoding'), asset.variants);
    if (!encoding) return new Response(null, { status: 406, headers: { Vary: 'Accept-Encoding' } });
    const representation = asset.variants[encoding];
    const headers = new Headers({
      'Content-Type': asset.type, 'ETag': representation.etag,
      'Cache-Control': key.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Vary': 'Accept-Encoding', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Game-Version': version,
    });
    if (encoding !== 'identity') headers.set('Content-Encoding', encoding);
    const tags = (request.headers.get('If-None-Match') ?? '').split(',').map(t => t.trim().replace(/^W\//, ''));
    if (tags.includes('*') || tags.includes(representation.etag)) return new Response(null, { status: 304, headers });
    if (request.method === 'HEAD') return new Response(null, { headers });
    // workerd's default is automatic re-encoding; supplied compressed bytes must
    // pass through. Verify this extension on the actual Arvan runtime as well.
    const body = representation.inflate
      ? new Response(bytes(asset.variants.gzip)).body.pipeThrough(new DecompressionStream('gzip'))
      : bytes(representation);
    return new Response(body, { headers, encodeBody: 'manual' });
  }
}
