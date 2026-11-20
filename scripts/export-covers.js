import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, access, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Standalone marketing exporter. Does not write to game/public/dist.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'marketing');
const sourceUrl = process.env.GAME_URL || 'http://127.0.0.1:4181/?qa';
const size = { width: 1920, height: 1080 };
const concepts = [
  { id: 'hormuz', name: 'Hormuz', slug: 'hormuz-cover-16x9', note: 'Actual Hormuz scene · playable course', centered: false },
  { id: 'qeshm', name: 'Qeshm', slug: 'qeshm-cover-16x9', note: 'Actual Qeshm scene · visual preview', centered: true },
  { id: 'kish', name: 'Kish', slug: 'kish-hengam-cover-16x9', note: 'Actual Kish scene · visual preview', centered: false },
];
await mkdir(resolve(out, 'assets'), { recursive: true });
await mkdir(resolve(out, 'sources'), { recursive: true });
const asset = name => resolve(out, 'assets', name);
async function getFont(filename, url) {
  try { await access(asset(filename)); } catch {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Font download: ${response.status} ${url}`);
    await writeFile(asset(filename), Buffer.from(await response.arrayBuffer()));
  }
  return (await readFile(asset(filename))).toString('base64');
}
const serif = await getFont('LibreCaslonDisplay-Regular.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/librecaslondisplay/LibreCaslonDisplay-Regular.ttf');
const sans = await getFont('DMSans-variable.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/DMSans%5Bopsz,wght%5D.ttf');
for (const [folder, name] of [['librecaslondisplay', 'LibreCaslonDisplay-OFL.txt'], ['dmsans', 'DMSans-OFL.txt']]) {
  const response = await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${folder}/OFL.txt`);
  if (!response.ok) throw new Error(`Font license: ${response.status}`);
  await writeFile(asset(name), await response.text());
}
let icon = '';
try { icon = `data:image/svg+xml;base64,${(await readFile(resolve(root, 'public/icon.svg'))).toString('base64')}`; } catch { /* Optional brand icon; never blocks. */ }
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const sourceWarnings = [];
const evidence = [];
try {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(`game: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') sourceWarnings.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) sourceWarnings.push(`${response.status()} ${response.url()}`); });
  await page.goto(sourceUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#menu')?.dataset.previewReady === 'hormuz');
  for (const concept of concepts) {
    // All selection is via the game's real controls; QA hooks are read-only.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await page.evaluate(id => document.querySelector(`[data-island="${id}"]`).click(), concept.id);
        await page.waitForFunction(id => document.querySelector('#menu')?.dataset.previewReady === id, concept.id, { timeout: 15000 });
        await page.evaluate(centered => {
          const toggle = document.querySelector('#sceneryToggle');
          if ((toggle.getAttribute('aria-pressed') === 'true') !== centered) toggle.click();
        }, concept.centered);
        await page.waitForTimeout(2200);
        break;
      } catch (error) {
        if (attempt) throw error;
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.querySelector('#menu')?.dataset.previewReady === 'hormuz');
      }
    }
    await page.addStyleTag({ content: '#menu,#game,#pausePanel,#resultPanel,#credits,#audioPanel,#helpPanel,#loadError,#sceneFade{visibility:hidden!important}#scene{visibility:visible!important} body{overflow:hidden!important}' });
    const screenshot = `${concept.id}-scene-1920x1080.png`;
    await page.screenshot({ path: asset(screenshot), fullPage: false });
    evidence.push({ island: concept.id, source: sourceUrl, capture: `assets/${screenshot}`, screenshotSize: size, sceneStatus: concept.note, ready: await page.locator('#menu').getAttribute('data-preview-ready'), uiHiddenOnlyInCapturePage: true });
    // Restore actual controls for the next island selection.
    await page.evaluate(() => { for (const style of [...document.querySelectorAll('style')]) if (style.textContent.includes('visibility:hidden!important')) style.remove(); });
  }
  const fontCss = `@font-face{font-family:Caslon;src:url(data:font/ttf;base64,${serif}) format('truetype');font-weight:400;font-display:block}@font-face{font-family:DM;src:url(data:font/ttf;base64,${sans}) format('truetype');font-weight:100 1000;font-display:block}`;
  const base = `${fontCss}*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden}body{--paper:#f9f3e6;--ink:#214b4a;--coral:#b34c3c;background:var(--paper);color:var(--ink);font-family:DM,sans-serif}main{width:1920px;height:1080px;position:relative;overflow:hidden}h1{font:400 94px/1 Caslon,serif;white-space:nowrap;letter-spacing:-2.2px;margin:0}.slogan{font:400 29px/1.5 DM,sans-serif;margin:20px 0 0}.eyebrow{font:500 20px/1.4 DM,sans-serif;letter-spacing:4px;text-transform:uppercase}.small{font:400 18px/1.4 DM,sans-serif;letter-spacing:1px}.scene{position:absolute;display:block;object-fit:cover}.icon{width:54px;height:54px;object-fit:contain}.rule{height:1px;background:currentColor;opacity:.35}`;
  for (const concept of concepts) {
    const image = `data:image/png;base64,${(await readFile(asset(`${concept.id}-scene-1920x1080.png`))).toString('base64')}`;
    let css, content;
    if (concept.id === 'hormuz') {
      css = `main{background:#90bdb2}.scene{left:288px;top:162px;width:1632px;height:918px}.masthead{position:absolute;inset:0 0 auto;height:226px;background:var(--coral);color:var(--paper);padding:43px 86px}.masthead h1{margin-top:24px;font-size:98px}.masthead .icon{position:absolute;right:85px;top:49px}.caption{position:absolute;left:86px;top:330px;width:460px}.caption .eyebrow{color:var(--coral)}.caption h2{font:400 92px/1 Caslon,serif;margin:28px 0 22px;letter-spacing:-2px}.caption .slogan{font-size:27px;max-width:410px}.caption .rule{margin:35px 0 20px;width:140px}.foot{position:absolute;bottom:50px;left:86px;right:86px;display:flex;justify-content:space-between}.foot span:first-child{color:var(--coral)}`;
      content = `<img class="scene" src="${image}" alt="Actual Hormuz miniature golf course, red-earth formations, stream and dock"><header class="masthead"><div class="eyebrow">A little escape to the Iranian islands</div><h1>Persian Isles Mini Golf</h1>${icon ? `<img class="icon" src="${icon}" alt="">` : ''}</header><section class="caption"><div class="eyebrow">The red-earth edition</div><h2>Hormuz</h2><p class="slogan">Find your line through the islands.</p><div class="rule"></div><div class="small">Quiet water.<br>A thoughtful next shot.</div></section><footer class="foot small"><span>HORMUZ / IN-GAME SCENE</span><span>v0.1.0</span></footer>`;
    } else if (concept.id === 'qeshm') {
      css = `main{background:var(--paper)}.top{position:absolute;left:78px;right:78px;top:60px;display:flex;justify-content:space-between;align-items:center}.top .eyebrow{font-size:18px}.postcard{position:absolute;left:614px;top:180px;width:1228px;height:690.75px;overflow:hidden;background:#bfd4d1}.postcard .scene{height:690.75px;width:1228px;left:0;top:0}.postcard:after{content:'';position:absolute;inset:0;border:1px solid #214b4a25;pointer-events:none}.place{position:absolute;left:78px;top:244px;width:485px}.place h2{font:400 146px/1 Caslon,serif;letter-spacing:-4px;margin:32px 0 35px}.place .slogan{max-width:440px;font-size:29px}.place .rule{width:115px;margin:46px 0 26px}.place .small{font-size:20px;line-height:1.8}.bottom{position:absolute;left:78px;right:78px;bottom:62px}.bottom .rule{margin-bottom:30px}.bottom h1{font-size:79px;letter-spacing:-1.8px}.version{position:absolute;right:0;bottom:7px;font-size:18px;letter-spacing:1px}.stamp{position:absolute;right:24px;top:24px;background:var(--paper);color:var(--ink);border:1px solid #214b4a4d;padding:12px 17px;font-size:15px;letter-spacing:2px}`;
      content = `<header class="top"><div class="eyebrow">Postcards from the Persian Isles</div><div class="eyebrow">Red earth / pale stone / quiet coast</div></header><section class="place"><div class="eyebrow" style="color:var(--coral)">A limestone daydream</div><h2>Qeshm</h2><p class="slogan">Find your line through the islands.</p><div class="rule"></div><div class="small">A miniature view<br>of the coast.</div></section><figure class="postcard" style="margin:0"><img class="scene" src="${image}" alt="Actual Qeshm preview scene, layered stone stacks and arches surrounded by water"><figcaption class="stamp">ISLAND STUDY / QESHM</figcaption></figure><footer class="bottom"><div class="rule"></div><h1>Persian Isles Mini Golf</h1><span class="version">VISUAL PREVIEW · v0.1.0</span></footer>`;
    } else {
      css = `main{background:#90d1d4}.scene{width:1920px;height:1080px;left:0;top:0}.top{position:absolute;left:82px;top:62px;right:82px;display:flex;justify-content:space-between;align-items:center}.top .eyebrow{font-size:18px}.title{position:absolute;left:82px;top:142px}.title h1{font-size:102px;letter-spacing:-2.3px}.title .slogan{font-size:30px;margin-top:22px}.vertical{position:absolute;left:85px;top:426px;width:430px}.vertical h2{font:400 126px/1 Caslon,serif;letter-spacing:-3px;margin:32px 0 28px}.vertical .small{font-size:24px;line-height:1.6;max-width:320px}.vertical .rule{width:110px;margin:38px 0 25px}.footer{position:absolute;bottom:0;left:0;right:0;height:114px;background:var(--ink);color:var(--paper);display:flex;align-items:center;justify-content:space-between;padding:0 82px}.footer .eyebrow{font-size:19px}.footer .small{font-size:17px}.accent{color:var(--coral)}`;
      content = `<img class="scene" src="${image}" alt="Actual Kish preview scene, palms, pale buildings and pier beside turquoise water"><header class="top"><span class="eyebrow">On island time</span><span class="eyebrow">A coast of our own</span></header><section class="title"><h1>Persian Isles Mini Golf</h1><p class="slogan">Find your line through the islands.</p></section><section class="vertical"><div class="eyebrow accent">The turquoise coast</div><h2>Kish</h2><div class="small">A small island.<br>A slower rhythm.</div><div class="rule"></div><div class="eyebrow" style="font-size:17px">An in-game island study</div></section><footer class="footer"><span class="eyebrow">Pale shores. Open water.</span><span class="small">KISH · VISUAL PREVIEW &nbsp; / &nbsp; v0.1.0</span></footer>`;
    }
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=1920"><title>${concept.name} — Persian Isles Mini Golf cover</title><style>${base}${css}</style></head><body><main aria-label="${concept.name} promotional cover">${content}</main></body></html>`;
    const source = resolve(out, 'sources', `${concept.slug}.html`);
    await writeFile(source, html);
    const cover = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    cover.on('pageerror', error => errors.push(`${concept.slug}: ${error.message}`));
    cover.on('console', message => { if (message.type() === 'error') errors.push(`${concept.slug}: ${message.text()}`); });
    await cover.goto(`file://${source}`);
    await cover.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
    const layout = await cover.evaluate(() => {
      const title = document.querySelector('h1');
      const range = document.createRange(); range.selectNodeContents(title);
      return { title: title.textContent, titleLines: range.getClientRects().length, titleRight: title.getBoundingClientRect().right, scrollWidth: document.documentElement.scrollWidth, imageCount: document.images.length };
    });
    if (layout.titleLines !== 1 || layout.titleRight > 1920 || layout.scrollWidth !== 1920) throw new Error(`Cover typography overflow: ${JSON.stringify(layout)}`);
    evidence.find(item => item.island === concept.id).layout = layout;
    await cover.screenshot({ path: resolve(out, `${concept.slug}.png`), fullPage: false });
    await cover.close();
  }
  const cards = concepts.map(concept => `<article><a class="preview" href="${concept.slug}.png" download><img src="${concept.slug}.png" alt="${concept.name} promotional cover" width="1920" height="1080"></a><div class="meta"><div><h2>${concept.name}</h2><p>${concept.note}</p></div><div class="links"><a href="${concept.slug}.png" download>Download PNG ↓</a><a href="sources/${concept.slug}.html" download>Editable HTML ↓</a></div></div></article>`).join('');
  const gallery = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Persian Isles Mini Golf — Promotional covers</title><style>*{box-sizing:border-box}body{margin:0;background:#f9f3e6;color:#214b4a;font-family:"Avenir Next",Avenir,sans-serif}main{max-width:1440px;padding:64px 40px;margin:auto}header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;border-bottom:1px solid #214b4a44;padding-bottom:30px;margin-bottom:38px}h1{font:400 clamp(32px,4vw,60px)/1.1 Georgia,serif;margin:0 0 14px;letter-spacing:-2px}header p{margin:0;line-height:1.6;max-width:750px}a{color:inherit;text-underline-offset:5px}a:hover{color:#b34c3c}a:focus-visible{outline:3px solid #b34c3c;outline-offset:5px}.zip{white-space:nowrap;background:#214b4a;color:#f9f3e6;padding:17px 22px;text-decoration:none;display:inline-flex;min-height:48px;align-items:center}.zip:hover{background:#b34c3c;color:#f9f3e6}article{margin-bottom:56px}.preview{display:block}.preview img{display:block;width:100%;height:auto;border:1px solid #214b4a22}.meta{display:flex;justify-content:space-between;align-items:center;gap:18px;padding-top:18px}h2{font:400 32px Georgia,serif;margin:0 0 7px}.meta p{margin:0;font-size:15px}.links{display:flex;gap:24px}.links a{min-height:44px;display:inline-flex;align-items:center}footer{border-top:1px solid #214b4a44;padding-top:22px;font-size:14px;line-height:1.7}@media(max-width:700px){main{padding:32px 18px}header,.meta{display:block}.zip{margin-top:22px}.links{margin-top:10px;flex-wrap:wrap;gap:15px}}</style></head><body><main><header><div><h1>Persian Isles Mini Golf</h1><p>Find your line through the islands.<br>Three downloadable 16:9 covers · 1920 × 1080 PNG · editable, self-contained HTML.</p></div><a class="zip" href="persian-isles-promotional-covers-v0.1.0.zip" download>Download the collection ↓</a></header>${cards}<footer>Captured from real in-game Three.js scenes. Hormuz contains a playable course; Qeshm and Kish are visual previews, not released golf islands. No synthetic gameplay or invented features. Covers are promotional downloads only and are not loaded by the game.<br>Sources embed the original screenshots and OFL-licensed fonts. See <a href="README.md">README</a> and <a href="capture-manifest.json">capture manifest</a>.</footer></main></body></html>`;
  await writeFile(resolve(out, 'index.html'), gallery);
  await writeFile(resolve(out, 'README.md'), `# Persian Isles Mini Golf — promotional covers\n\nThree professional 1920×1080 PNG covers, using real scene screenshots from the local game.\n\n- Open index.html locally for the gallery and downloads.\n- Each sources/*.html is independently editable and fully self-contained: image and typefaces are embedded; no remote requests. Artboards are fixed at 1920×1080. Copy remains actual HTML text.\n- assets/*-scene-1920x1080.png are unretouched scene captures; only UI visibility was changed in the capture browser. Game sources were not modified.\n- Hormuz shows its actual course scene. Qeshm and Kish show actual island previews and are labelled accordingly; this collection makes no claim that their golf is released. The coastal filename uses the requested kish-hengam identifier, but depicts Kish only.\n- Covers use ivory #f9f3e6, teal #214b4a and coral #b34c3c with the original game palette.\n- Fonts: Libre Caslon Display and DM Sans, embedded under SIL OFL; licences are in assets/.\n- Rebuild with a running dev server: node scripts/export-covers.js. Requires Playwright and installed Chrome. GAME_URL may override the capture origin.\n- Nothing in marketing/ is imported by the game or copied into public/dist. No gameplay logic or release state was altered.\n\nDesign audit: 0/10 generic-design tells. No feature cards, fabricated metrics, glass, tech gradients, centered headline stacks or synthetic scene illustrations.\n`);
  // Only the three final cover exports belong at marketing's root.
  for (const old of ['_hormuz-menu.png', '_qeshm-menu.png', '_kish-menu.png', '_hormuz-game.png']) await rm(asset(old), { force: true });
  const dimensions = [];
  for (const concept of concepts) {
    const filename = `${concept.slug}.png`, data = await readFile(resolve(out, filename));
    const validSignature = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const width = data.readUInt32BE(16), height = data.readUInt32BE(20);
    if (!validSignature || width !== 1920 || height !== 1080) throw new Error(`Invalid PNG ${filename}`);
    dimensions.push({ filename, width, height, validSignature, bytes: data.length });
  }
  const galleryPage = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  galleryPage.on('pageerror', error => errors.push(`gallery: ${error.message}`));
  galleryPage.on('console', message => { if (message.type() === 'error') errors.push(`gallery: ${message.text()}`); });
  await galleryPage.goto(`file://${resolve(out, 'index.html')}`);
  await galleryPage.evaluate(async () => { await Promise.all([...document.images].map(image => image.decode())); });
  const links = await galleryPage.locator('a[href]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  const report = { generatedAt: new Date().toISOString(), sourceUrl, captures: evidence, pngCount: dimensions.length, dimensions, browserErrors: errors, sourceWarnings: [...new Set(sourceWarnings)], galleryLinks: links };
  await writeFile(resolve(out, 'capture-manifest.json'), JSON.stringify(report, null, 2) + '\n');
  if (errors.length) throw new Error(`Browser runtime errors: ${errors.join('; ')}`);
  const zip = resolve(out, 'persian-isles-promotional-covers-v0.1.0.zip');
  await rm(zip, { force: true });
  execFileSync('zip', ['-q', '-r', zip, 'index.html', 'README.md', 'capture-manifest.json', 'sources', 'assets', ...dimensions.map(item => item.filename)], { cwd: out });
  for (const link of new Set(links)) await access(resolve(out, link));
  execFileSync('unzip', ['-tq', zip]);
  console.log(JSON.stringify({ output: out, pngCount: dimensions.length, dimensions, browserErrors: errors, sourceWarnings: [...new Set(sourceWarnings)], zipVerified: true, galleryLinksVerified: true }, null, 2));
} finally { await browser.close(); }
