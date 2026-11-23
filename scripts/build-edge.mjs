import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import { installEdge } from './edge-handler.js';
import { LEVELS } from '../src/journey.js';

const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'], ['.woff2', 'font/woff2'], ['.wasm', 'application/wasm'],
  ['.txt', 'text/plain; charset=utf-8'], ['.md', 'text/plain; charset=utf-8'],
]);
const textTypes = new Set(['.html', '.js', '.css', '.svg', '.txt', '.md']);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function representation(bytes, text = false) {
  return { body: bytes.toString(text ? 'utf8' : 'base64'), text, etag: `"${hash(bytes)}"`, bytes: bytes.length };
}
function asset(bytes, ext) {
  const text = textTypes.has(ext);
  if (text && !Buffer.from(bytes.toString('utf8')).equals(bytes)) throw Error('Invalid UTF-8');
  const variants = { identity: representation(bytes, text) };
  if (text || ext === '.wasm') {
    variants.br = representation(brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
    variants.gzip = representation(gzipSync(bytes, { level: 9 }));
  }
  return { type: types.get(ext) ?? 'application/octet-stream', variants };
}
export function buildEdge({ dist, output, origin, cover, previousDist, compact = false }) {
  const input = fs.realpathSync(dist), out = path.resolve(output);
  if (fs.existsSync(out)) throw Error('Output must not exist');
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash)
    throw Error('Expected canonical HTTPS origin');
  // Snapshot file names before writing output, including when tests use a child directory.
  const entries = new Map();
  function addTree(directory, previous = false) {
    for (const rel of fs.readdirSync(directory, { recursive: true }).sort()) {
      const file = path.join(directory, rel), stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw Error('Symlinks are not deployable');
      if (!stat.isFile() || /\.(br|gz)$/.test(rel) || rel.startsWith('music-audition' + path.sep)) continue;
      if (previous && !rel.startsWith('assets' + path.sep)) continue;
      const key = '/' + rel.split(path.sep).join('/');
      const value = asset(fs.readFileSync(file), path.extname(rel));
      if (entries.has(key)) {
        if (entries.get(key).variants.identity.etag !== value.variants.identity.etag) throw Error('Asset collision: ' + key);
      } else entries.set(key, value);
    }
  }
  addTree(input);
  if (previousDist) addTree(fs.realpathSync(previousDist), true);
  const image = fs.readFileSync(cover), imagePath = `/assets/share-${hash(image).slice(0, 16)}.png`;
  entries.set(imagePath, asset(image, '.png'));
  const html = fs.readFileSync(path.join(input, 'index.html'), 'utf8')
    .replace(/<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*>/gi, '');
  const pages = {};
  for (const key of ['generic', 'journey', ...LEVELS.map(level => String(level.id))]) {
    const level = LEVELS.find(value => String(value.id) === key);
    const title = level ? `Hormuz · Hole ${level.id}: ${level.name} | Persian Isles Mini Golf`
      : key === 'journey' ? 'Hormuz · Nine-hole journey | Persian Isles Mini Golf' : 'Persian Isles Mini Golf';
    const description = level ? `${level.lesson} Play the same hole on Hormuz.` : 'A little golf. A world away. Play nine holes on Hormuz.';
    const canonical = new URL(base);
    if (key !== 'generic') {
      canonical.searchParams.set('island', 'hormuz');
      if (level) canonical.searchParams.set('hole', level.id);
    }
    const meta = `<meta name="description" content="${escape(description)}"><link rel="canonical" href="${escape(canonical.href)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Persian Isles Mini Golf"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical.href)}"><meta property="og:image" content="${escape(new URL(imagePath, base).href)}"><meta name="twitter:card" content="summary_large_image">`;
    if (!html.includes('</head>')) throw Error('HTML head missing');
    pages[key] = asset(Buffer.from(html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(title)}</title>`).replace('</head>', meta + '</head>')), '.html');
  }
  if (compact) {
    for (const value of [...entries.values(), ...Object.values(pages)]) {
      if (value.type === 'application/wasm') {
        // Keep gzip once; stream-decompress only for identity-only clients.
        const { etag, bytes } = value.variants.identity;
        value.variants = { gzip: value.variants.gzip, identity: { etag, bytes, inflate: true } };
      } else {
        // Let the hosting HTTP layer compress text, rather than embedding copies.
        value.variants = { identity: value.variants.identity };
      }
    }
  }
  const version = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url))).version;
  const script = `// Persian Isles Mini Golf ${version}: static assets and bounded link metadata.\nconst ASSETS=new Map(${JSON.stringify([...entries])});\nconst PAGES=${JSON.stringify(pages)};\n(${installEdge.toString()})(ASSETS,PAGES,${JSON.stringify(version)});\n`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, script, { flag: 'wx' });
  return { output: out, version, files: entries.size, scriptBytes: Buffer.byteLength(script), sha256: hash(script), origin: base.origin };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dist, output, origin, previousDist] = process.argv.slice(2);
  if (!dist || !output || !origin) throw Error('Usage: node scripts/build-edge.mjs <dist> <new-output.js> <https-origin> [previous-dist]');
  console.log(JSON.stringify(buildEdge({ dist, output, origin, previousDist,
    cover: fileURLToPath(new URL('../docs/images/hormuz-cover.png', import.meta.url)) }), null, 2));
}
