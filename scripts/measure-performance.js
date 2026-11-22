#!/usr/bin/env node
/**
 * Read-only local Chrome baseline; never builds or changes game state via QA.
 * BASE_URL=http://127.0.0.1:4279/ SAMPLES=3 OUTPUT=/path/baseline.json \
 *   node scripts/measure-performance.js
 * BASE_URLS=http://127.0.0.1:4279/,http://127.0.0.1:4181/?qa measures both.
 * Optional: FRAME_MS=5000 SETTLE_MS=1500 HEADLESS=1 WIDTH=1440 HEIGHT=900
 * CHANNEL=chrome DIST_DIR=dist (set DIST_DIR=off to skip disk inventory).
 * New browser process/context per sample, HTTP cache disabled; OS, Vite,
 * filesystem and GPU caches are NOT flushed. No network/CPU throttling.
 * rAF intervals are browser scheduling observations, NOT GPU or phone FPS.
 * Transfer size is Resource Timing's reported size, not packet-level traffic.
 * gzip/Brotli disk estimates are NOT proof of server Content-Encoding support.
 */
import { chromium } from '@playwright/test';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { cpus, platform, release } from 'node:os';
import { execFileSync } from 'node:child_process';

function numberOption(name, fallback, minimum = 1) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${name} must be an integer >= ${minimum}`);
  return value;
}
function summarize(values) {
  if (!values.length) return { count: 0, min: null, median: null, p95: null, max: null, mean: null };
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = p => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
  return { count: values.length, min: sorted[0], median: percentile(0.5), p95: percentile(0.95), max: sorted.at(-1), mean: values.reduce((a, b) => a + b, 0) / values.length };
}
function git(args) {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

// This observer records browser/DOM state only. It does not replace any game API.
function installStartupProbe() {
  performance.setResourceTimingBufferSize(5000);
  const probe = { menuReadyMs: null, playClickMs: null, firstPlayReadyMs: null, longTasks: [], supportedEntryTypes: PerformanceObserver.supportedEntryTypes };
  window.__performanceBaseline = probe;
  if (probe.supportedEntryTypes.includes('longtask')) {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) probe.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
    }).observe({ type: 'longtask', buffered: true });
  }
  const observer = new MutationObserver(() => {
    const menu = document.querySelector('#menu');
    const play = document.querySelector('#play');
    if (menu?.dataset.previewReady === 'hormuz' && play && !play.disabled && !menu.classList.contains('hidden')) {
      probe.menuReadyMs = performance.now();
      observer.disconnect();
    }
  });
  observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-preview-ready', 'disabled', 'class'] });
  document.addEventListener('click', event => {
    if (probe.playClickMs === null && event.target instanceof Element && event.target.closest('#play')) probe.playClickMs = performance.now();
  }, { capture: true });
  const playObserver = new MutationObserver(() => {
    const game = document.querySelector('#game');
    if (probe.playClickMs !== null && game && !game.classList.contains('hidden') && document.querySelector('#status')?.textContent === 'Ready to putt') {
      probe.firstPlayReadyMs = performance.now();
      playObserver.disconnect();
    }
  });
  playObserver.observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'data-phase'] });
}

async function resources(page) {
  return page.evaluate(() => {
    const entries = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].map(e => ({
      url: e.name, initiatorType: e.initiatorType || 'navigation', startTime: e.startTime,
      duration: e.duration, transferBytes: e.transferSize, encodedBodyBytes: e.encodedBodySize,
      decodedBodyBytes: e.decodedBodySize, responseStatus: e.responseStatus ?? null,
      deliveryType: e.deliveryType ?? null,
    }));
    const totals = entries.reduce((a, e) => {
      a.count++; a.transferBytes += e.transferBytes; a.encodedBodyBytes += e.encodedBodyBytes; a.decodedBodyBytes += e.decodedBodyBytes;
      return a;
    }, { count: 0, transferBytes: 0, encodedBodyBytes: 0, decodedBodyBytes: 0 });
    return { totals, entries };
  });
}

async function sampleWindow(page, durationMs) {
  const result = await page.evaluate(async duration => {
    const qa = () => typeof window.__golf?.state === 'function' ? window.__golf.state() : null;
    const qaBefore = qa();
    const before = { status: document.querySelector('#status')?.textContent, strokes: document.querySelector('#strokes')?.textContent, visibility: document.visibilityState };
    const mutations = { records: 0, attributes: 0, childList: 0, characterData: 0, addedNodes: 0, removedNodes: 0, targets: {} };
    const observer = new MutationObserver(records => {
      for (const record of records) {
        mutations.records++; mutations[record.type]++;
        mutations.addedNodes += record.addedNodes.length; mutations.removedNodes += record.removedNodes.length;
        const element = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        const target = `${element?.id ? '#' + element.id : element?.tagName || 'unknown'}${record.attributeName ? '@' + record.attributeName : ''}`;
        mutations.targets[target] = (mutations.targets[target] || 0) + 1;
      }
    });
    observer.observe(document.querySelector('#app'), { subtree: true, attributes: true, childList: true, characterData: true });
    const started = performance.now();
    const intervalsMs = [];
    let previous, raf;
    const frame = now => { if (previous !== undefined) intervalsMs.push(now - previous); previous = now; raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    await new Promise(resolve => setTimeout(resolve, duration));
    const ended = performance.now();
    cancelAnimationFrame(raf);
    observer.disconnect();
    return {
      startedMs: started, endedMs: ended, elapsedMs: ended - started,
      before, after: { status: document.querySelector('#status')?.textContent, strokes: document.querySelector('#strokes')?.textContent, visibility: document.visibilityState },
      mutations, frames: { intervalsMs }, qaBefore, qaAfter: qa(),
      longTasks: window.__performanceBaseline.longTasks.filter(e => e.startTime >= started && e.startTime < ended),
    };
  }, durationMs);
  result.frames.summaryMs = summarize(result.frames.intervalsMs);
  result.frames.intervalsOver25Ms = result.frames.intervalsMs.filter(n => n > 25).length;
  result.frames.intervalsOver50Ms = result.frames.intervalsMs.filter(n => n > 50).length;
  result.frames.intervalsOver100Ms = result.frames.intervalsMs.filter(n => n > 100).length;
  return result;
}

async function measure(url, sample, options) {
  let browser, context;
  const run = { url, sample, success: false, console: [], pageErrors: [], failedRequests: [], blockedExternalRequests: [], responses: [], devServerEvents: [] };
  try {
    browser = await chromium.launch({ channel: options.channel, headless: options.headless });
    run.browserVersion = browser.version();
    context = await browser.newContext({ viewport: options.viewport, deviceScaleFactor: 1, serviceWorkers: 'block', reducedMotion: 'no-preference' });
    await context.route('**/*', route => {
      const requestUrl = new URL(route.request().url());
      if (!['http:', 'https:'].includes(requestUrl.protocol) || requestUrl.origin === new URL(url).origin) return route.continue();
      run.blockedExternalRequests.push(requestUrl.href);
      return route.abort('blockedbyclient');
    });
    await context.addInitScript(installStartupProbe);
    const page = await context.newPage();
    await page.bringToFront();
    page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
      if (typeof payload !== 'string') return;
      try {
        const event = JSON.parse(payload);
        if (['update', 'full-reload', 'error'].includes(event.type)) run.devServerEvents.push({ type: event.type, observedAt: new Date().toISOString() });
      } catch { /* Ignore protocol messages that are not Vite JSON. */ }
    }));
    page.on('console', message => { if (['warning', 'error'].includes(message.type())) run.console.push({ type: message.type(), text: message.text() }); });
    page.on('pageerror', error => run.pageErrors.push(error.message));
    page.on('requestfailed', request => run.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }));
    const responseTasks = [];
    page.on('response', response => responseTasks.push((async () => {
      const headers = await response.allHeaders();
      run.responses.push({ url: response.url(), status: response.status(), contentType: headers['content-type'] || null, contentLength: headers['content-length'] || null, contentEncoding: headers['content-encoding'] || null });
    })().catch(error => run.console.push({ type: 'measurement-warning', text: error.message }))));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__performanceBaseline?.menuReadyMs !== null && window.__performanceBaseline?.menuReadyMs !== undefined, null, { timeout: 30000 });
    run.menuReadyMs = await page.evaluate(() => window.__performanceBaseline.menuReadyMs);
    run.resourcesAtMenu = await resources(page);
    run.navigation = await page.evaluate(() => performance.getEntriesByType('navigation')[0].toJSON());
    run.environment = await page.evaluate(() => {
      const canvas = document.querySelector('#scene');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      const debug = gl?.getExtension('WEBGL_debug_renderer_info');
      return {
        userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight }, devicePixelRatio,
        canvas: { width: canvas.width, height: canvas.height }, hardwareConcurrency: navigator.hardwareConcurrency,
        webgl: gl ? { version: gl.getParameter(gl.VERSION), vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER), unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null, unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null } : null,
      };
    });
    // Measure first play immediately: no menu observation delay in this metric.
    run.beforeClickMs = await page.evaluate(() => performance.now());
    await page.locator('#play').click();
    await page.waitForFunction(() => {
      const game = document.querySelector('#game');
      return game && !game.classList.contains('hidden') && document.querySelector('#status')?.textContent === 'Ready to putt';
    }, null, { timeout: 30000 });
    const playTiming = await page.evaluate(() => ({
      clicked: window.__performanceBaseline.playClickMs,
      ready: window.__performanceBaseline.firstPlayReadyMs,
      observed: performance.now(),
    }));
    if (playTiming.clicked === null || playTiming.ready === null) throw new Error('Play click/readiness timestamps missing');
    run.playClickMs = playTiming.clicked;
    run.firstPlayReadyMs = playTiming.ready;
    run.clickToPlayReadyMs = playTiming.ready - playTiming.clicked;
    run.actionabilityWaitMs = playTiming.clicked - run.beforeClickMs;
    run.automationPlayReadyObservedMs = playTiming.observed;
    // DOM readiness is not guaranteed GPU presentation; keep a separate upper bound.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    run.firstPlayPresentedUpperBoundMs = await page.evaluate(() => performance.now());
    run.resourcesAtPlay = await resources(page);
    await page.waitForTimeout(options.settleMs);
    run.gameplay = await sampleWindow(page, options.frameMs);
    if (run.gameplay.before.strokes !== '0' || run.gameplay.after.strokes !== '0' || run.gameplay.after.status !== 'Ready to putt' || (run.gameplay.qaAfter && run.gameplay.qaAfter.phase !== 'aiming')) throw new Error('Game was not unchanged, settled aiming');
    // Return through real UI for a settled menu frame sample.
    await page.locator('#pause').click();
    await page.locator('#backHome').click();
    await page.waitForFunction(() => !document.querySelector('#menu').classList.contains('hidden') && !document.querySelector('#play').disabled, null, { timeout: 30000 });
    await page.waitForTimeout(options.settleMs);
    run.menu = await sampleWindow(page, options.frameMs);
    run.resourcesFinal = await resources(page);
    run.startupLongTasks = await page.evaluate(() => window.__performanceBaseline.longTasks.filter(e => e.startTime < window.__performanceBaseline.menuReadyMs));
    await Promise.all(responseTasks);
    if (run.pageErrors.length || run.blockedExternalRequests.length || run.failedRequests.length || run.devServerEvents.length || run.responses.some(r => r.status >= 400) || run.gameplay.frames.intervalsMs.length < 2 || run.menu.frames.intervalsMs.length < 2 || run.gameplay.before.visibility !== 'visible' || run.gameplay.after.visibility !== 'visible') throw new Error('Browser/network errors, HMR contamination, hidden page, or insufficient frame observations; see evidence');
    run.success = true;
  } catch (error) {
    run.error = error.stack || String(error);
  } finally {
    await context?.close();
    await browser?.close();
  }
  return run;
}

async function inventory(directory) {
  const files = [];
  async function walk(root, prefix = '') {
    for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = prefix + entry.name;
      if (entry.isDirectory()) await walk(join(root, entry.name), name + '/');
      else if (entry.isFile()) {
        const path = join(root, entry.name);
        const bytes = await readFile(path);
        const metadata = { path: name, bytes: bytes.length, modifiedAt: (await stat(path)).mtime.toISOString(), sha256: createHash('sha256').update(bytes).digest('hex') };
        if (/\.(?:js|css|html|json|svg|txt|md)$/.test(name)) {
          metadata.gzip9Bytes = gzipSync(bytes, { level: 9 }).length;
          metadata.brotli11Bytes = brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
        }
        files.push(metadata);
      }
    }
  }
  await walk(directory);
  return { directory: resolve(directory), files, totals: { files: files.length, bytes: files.reduce((n, f) => n + f.bytes, 0), musicAuditionBytes: files.filter(f => f.path.startsWith('music-audition/')).reduce((n, f) => n + f.bytes, 0), nonAuditionBytes: files.filter(f => !f.path.startsWith('music-audition/')).reduce((n, f) => n + f.bytes, 0) } };
}

async function main() {
  if (process.argv.includes('--help')) {
    process.stdout.write('Usage: BASE_URL=http://127.0.0.1:4279/ [SAMPLES=3 OUTPUT=baseline.json FRAME_MS=5000 SETTLE_MS=1500 HEADLESS=1] node scripts/measure-performance.js\nMultiple targets: BASE_URLS=http://127.0.0.1:4279/,http://127.0.0.1:4181/?qa\nLocal loopback URLs only. No runtime changes, builds or synthetic gameplay.\n');
    return;
  }
  if (process.argv.length > 2) throw new Error('Unknown arguments; use --help');
  const urls = (process.env.BASE_URLS || process.env.BASE_URL || 'http://127.0.0.1:4279/').split(',');
  for (const input of urls) {
    const url = new URL(input);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only credential-free local loopback HTTP(S) URLs are supported');
  }
  const options = { samples: numberOption('SAMPLES', 3), frameMs: numberOption('FRAME_MS', 5000, 100), settleMs: numberOption('SETTLE_MS', 1500, 0), viewport: { width: numberOption('WIDTH', 1440), height: numberOption('HEIGHT', 900) }, headless: process.env.HEADLESS !== '0', channel: process.env.CHANNEL || 'chrome' };
  const report = {
    schemaVersion: 1, startedAt: new Date().toISOString(), options,
    methodology: { browserProcess: 'new per sample', context: 'new per sample; empty storage; cache disabled; service workers blocked', hostCaches: 'not flushed; Vite already running', throttling: 'none', inputs: 'real locator click Play; pause and Back to coast; no shots or QA state changes', menuReady: 'MutationObserver: previewReady=hormuz, Play enabled, menu visible', firstPlay: 'MutationObserver timestamp after real Play click: visible game and Ready to putt; clickToPlay excludes separately recorded actionability wait; DOM readiness is not GPU presentation', frames: 'independent requestAnimationFrame callback intervals; not render/GPU timings or phone FPS', mutations: '#app subtree MutationObserver for full fixed-duration settled sample; observer itself adds overhead', resources: 'navigation + resource timing transfer/encoded/decoded sizes; excludes DevTools websocket traffic', percentiles: 'nearest rank', diskSizes: 'existing dist only, no rebuild; compressed bytes are offline estimates' },
    host: { platform: platform(), release: release(), cpuModel: cpus()[0]?.model, logicalCpus: cpus().length, node: process.version },
    source: { head: git(['rev-parse', 'HEAD']), dirtyStatusBefore: git(['status', '--short']) }, runs: [],
  };
  async function persist() {
    if (!process.env.OUTPUT) return;
    await mkdir(dirname(resolve(process.env.OUTPUT)), { recursive: true });
    await writeFile(process.env.OUTPUT, JSON.stringify(report, null, 2) + '\n');
  }
  for (const url of urls) {
    for (let sample = 1; sample <= options.samples; sample++) {
      process.stderr.write(`Measuring ${url} sample ${sample}/${options.samples}\n`);
      report.runs.push(await measure(url, sample, options));
      await persist();
    }
  }
  // Compress only after browser runs, to avoid adding CPU contention to frames.
  if (process.env.DIST_DIR !== 'off') {
    try { report.dist = await inventory(process.env.DIST_DIR || 'dist'); }
    catch (error) { report.dist = { error: error.message }; }
  }
  report.summary = urls.map(url => {
    const good = report.runs.filter(run => run.url === url && run.success);
    return { url, successfulSamples: good.length, requestedSamples: options.samples, menuReadyMs: summarize(good.map(r => r.menuReadyMs)), firstPlayReadyMs: summarize(good.map(r => r.firstPlayReadyMs)), clickToPlayReadyMs: summarize(good.map(r => r.clickToPlayReadyMs)), gameplayFrameMedianMs: summarize(good.map(r => r.gameplay.frames.summaryMs.median)), gameplayFrameP95Ms: summarize(good.map(r => r.gameplay.frames.summaryMs.p95)), aimingMutationRecords: good.map(r => r.gameplay.mutations.records) };
  });
  report.source.dirtyStatusAfter = git(['status', '--short']);
  report.finishedAt = new Date().toISOString();
  await persist();
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (report.runs.some(run => !run.success)) process.exitCode = 1;
}
main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
