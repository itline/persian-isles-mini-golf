import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import config from '../playwright.config.js';

// --baseline reproduces the previous headless launch, not the Mesa candidate.
const baseline = process.argv.includes('--baseline');
const { channel, headless, launchOptions, viewport } = config.use;
const launch = baseline ? { channel, headless: true } : { channel, headless, ...launchOptions };
const label = baseline ? 'baseline' : 'candidate';
const browser = await chromium.launch(launch);
try {
  const session = await browser.newBrowserCDPSession();
  const { gpu } = await session.send('SystemInfo.getInfo');
  console.log(JSON.stringify({ label, browser: browser.version(), launch, gpu }));
  const page = await browser.newPage({ viewport });
  page.on('pageerror', error => console.error(`[${label}] pageerror: ${error.message}`));
  await page.goto('http://127.0.0.1:4181/?qa');
  await page.waitForFunction(() => window.__golf);
  const gl = await page.evaluate(() => {
    const canvas = document.querySelector('#scene');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const debug = context?.getExtension('WEBGL_debug_renderer_info');
    return {
      vendor: debug ? context.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
      renderer: debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      width: canvas.width,
      height: canvas.height,
      devicePixelRatio,
    };
  });
  console.log(JSON.stringify({ label, gl }));
  if (!baseline && process.platform === 'linux' && process.env.GOLF_CI_MESA === '1') {
    assert.match(gl.renderer || '', /llvmpipe/i, 'CI must use Mesa llvmpipe, not silently fall back to SwiftShader');
  }
  for (const mode of ['menu', 'gameplay']) {
    if (mode === 'gameplay') await page.locator('#play').click();
    const timing = await page.evaluate(() => new Promise(resolve => {
      const start = performance.now();
      const initialScenery = window.__golf.state().sceneryTime;
      const intervals = [];
      let previous = start;
      let frame;
      const sample = now => {
        intervals.push(now - previous);
        previous = now;
        frame = requestAnimationFrame(sample);
      };
      frame = requestAnimationFrame(sample);
      setTimeout(() => {
        cancelAnimationFrame(frame);
        const elapsedMs = performance.now() - start;
        const sorted = [...intervals].sort((a, b) => a - b);
        const percentile = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? null;
        resolve({
          elapsedMs,
          frames: intervals.length,
          fps: intervals.length * 1000 / elapsedMs,
          frameMsP50: percentile(0.5),
          frameMsP95: percentile(0.95),
          scenerySeconds: window.__golf.state().sceneryTime - initialScenery,
          state: window.__golf.state(),
        });
      }, 4000);
    }));
    console.log(JSON.stringify({ label, mode, timing }));
  }
} finally {
  await browser.close();
}
