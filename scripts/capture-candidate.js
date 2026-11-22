import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// Serve an isolated frozen candidate first. This script never builds or publishes.
const base = process.env.GOLF_URL ?? 'http://127.0.0.1:4181/';
const output = process.env.OUTPUT ?? '/Users/hasan/.hermes/cache/scratch/golf-candidate-visuals';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const viewport of [
    { width: 320, height: 568 }, { width: 390, height: 844 },
    { width: 844, height: 390 }, { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({
      viewport, reducedMotion: 'reduce',
      ...(viewport.width < 1000 ? { isMobile: true, hasTouch: true } : {}),
    });
    try {
      const page = await context.newPage();
      const errors = [];
      const screenshots = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const hole of [5, 9]) {
        await page.goto(base);
        await page.locator('#play:enabled').waitFor();
        await page.locator('[data-island="hormuz"]').click();
        await page.waitForFunction(() => document.querySelector('#menu').dataset.previewReady === 'hormuz');
        await expect(page.locator('#levelGrid [data-level]')).toHaveCount(9);
        await page.locator(`#levelGrid [data-level="${hole}"]`).click();
        await expect(page.locator('#menu')).toBeHidden();
        await expect(page.locator('#game .game-title')).toBeVisible();
        await expect(page.locator('#courseIsland')).toHaveText('Hormuz');
        await expect(page.locator('#holeNumber')).toHaveText(String(hole));
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1200); // Allow camera framing to settle before capture.
        const path = join(output, `${viewport.width}x${viewport.height}-hormuz-hole${hole}.png`);
        await page.screenshot({ path });
        screenshots.push(path);
      }
      await page.goto(base);
      await page.locator('#play:enabled').waitFor();
      await page.locator('[data-island="qeshm"]').click();
      await page.waitForFunction(() => document.querySelector('#menu').dataset.previewReady === 'qeshm');
      await expect(page.locator('#play')).toBeDisabled();
      await expect(page.locator('#play')).toHaveText('Preview only');
      await expect(page.locator('#levelGrid')).toBeHidden();
      await expect(page.locator('#islandAvailability')).toBeHidden();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1200);
      const path = join(output, `${viewport.width}x${viewport.height}-qeshm-preview.png`);
      await page.screenshot({ path });
      screenshots.push(path);
      assert.deepEqual(errors, [], 'Candidate capture must not hide page errors');
      console.log(JSON.stringify({
        viewport, screenshots, errors,
        scope: 'Local browser-emulated candidate captures, not physical-device or release acceptance',
      }));
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
