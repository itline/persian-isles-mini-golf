import { test, expect } from '@playwright/test';
import { shot } from './helpers/shot.js';

const baseUrl = process.env.GOLF_E2E_BASE_URL ?? 'http://127.0.0.1:4181/';

async function completeFirstHole(page) {
  await page.goto(`${baseUrl}?qa&utm_source=test#debug`);
  await page.locator('[data-level="1"]').click();
  await shot(page, -6.1, -0.8, 74);
  await expect(page.locator('#resultPanel')).toBeVisible();
}

for (const hole of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  test(`Hormuz hole ${hole} invitation waits for explicit play without unlocking audio`, async ({ page }) => {
    await page.goto(`${baseUrl}?qa&island=hormuz&hole=${hole}`);
    await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready', 'hormuz');
    await expect(page.locator('#invitation')).toContainText(`Hormuz · Hole ${hole}:`);
    await expect(page.locator('#invitationPlay')).toBeEnabled();
    const holeName = await page.locator(`[data-level="${hole}"] small`).textContent();
    expect((await page.evaluate(() => window.__golf.state())).audio.unlocked).toBe(false);
    await expect(page.locator('#game')).toHaveClass(/hidden/);
    await page.locator('#invitationPlay').click();
    await expect(page.locator('#levelName')).toHaveText(holeName);
    await expect(page.locator('#holeNumber')).toHaveText(String(hole));
  });
}

for (const query of ['island=hormuz&hole=10', 'island=qeshm', 'island=qeshm&hole=1', 'island=qeshm&hole=9']) {
  test(`invalid playable invitation is ignored: ${query}`, async ({ page }) => {
    await page.goto(`${baseUrl}?qa&${query}`);
    await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready', 'hormuz');
    await expect(page.locator('#invitation')).toBeHidden();
    await expect(page.locator('#invitationPlay')).toBeDisabled();
    await expect(page.locator('#game')).toHaveClass(/hidden/);
    expect((await page.evaluate(() => window.__golf.state())).audio.unlocked).toBe(false);
  });
}

test('native sharing includes a clean same-hole link and treats cancel as cancel', async ({ page }) => {
  await page.addInitScript(() => {
    window.sharedPayloads = [];
    window.copyAttempts = 0;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {
      window.copyAttempts++;
    } } });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async payload => {
      window.sharedPayloads.push(payload);
      throw new DOMException('User cancelled', 'AbortError');
    } });
  });
  await completeFirstHole(page);
  await page.locator('#resultShare').click();
  await expect(page.locator('#shareNotice')).toHaveText('Sharing cancelled.');
  const [payload] = await page.evaluate(() => window.sharedPayloads);
  expect(payload.url).toBe(`${baseUrl}?island=hormuz&hole=1`);
  expect(payload.title).toBe('Persian Isles Mini Golf - Hormuz');
  expect(payload.text).toContain('Hormuz - Hole 1: Red Shore');
  expect(payload.text).toContain('1 stroke | Par 2');
  expect(payload.text).toContain('Self-reported local score');
  expect(await page.evaluate(() => window.copyAttempts)).toBe(0);
  await expect(page.locator('#shareFallback')).toBeHidden();
  await expect(page.locator('#resultShare')).toBeEnabled();
  await expect(page.locator('#resultRetry')).toBeVisible();
});

test('clipboard fallback copies result; failed copy exposes selectable text', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    window.copiedText = null;
    window.failCopy = false;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
      if (window.failCopy) throw new Error('Permission denied');
      window.copiedText = text;
    } } });
  });
  await completeFirstHole(page);
  await page.locator('#resultShare').click();
  await expect(page.locator('#shareNotice')).toHaveText('Result and course link copied.');
  expect(await page.evaluate(() => window.copiedText)).toContain('?island=hormuz&hole=1');
  await page.evaluate(() => { window.failCopy = true; });
  await page.locator('#resultShare').click();
  await expect(page.locator('#shareNotice')).toHaveText('Copy unavailable. Select and copy your result below.');
  await expect(page.locator('#shareText')).toBeVisible();
  await expect(page.locator('#shareText')).toHaveValue(/Self-reported local score/);
  await expect(page.locator('#shareText')).toBeFocused();
});

for (const channel of ['native', 'clipboard']) {
  for (const outcome of ['resolve', 'reject']) {
    test(`late ${channel} ${outcome} cannot overwrite a new result`, async ({ page }) => {
      await page.addInitScript(({ channel }) => {
        window.copyAttempts = 0;
        const deferred = () => new Promise((resolve, reject) => {
          window.finishShare = outcome => {
            if (outcome === 'reject') reject(new Error('Permission denied'));
            else resolve();
          };
        });
        Object.defineProperty(navigator, 'share', {
          configurable: true, value: channel === 'native' ? deferred : undefined,
        });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => {
          window.copyAttempts++;
          return channel === 'clipboard' ? deferred() : Promise.resolve();
        } } });
      }, { channel });
      await completeFirstHole(page);
      await page.locator('#resultShare').click();
      await expect(page.locator('#resultShare')).toBeDisabled();
      await page.locator('#resultRetry').click();
      await shot(page, -6.1, -0.8, 74);
      await expect(page.locator('#resultPanel')).toBeVisible();
      await expect(page.locator('#resultShare')).toBeEnabled();
      await page.evaluate(async outcome => {
        window.finishShare(outcome);
        // Flush the native/clipboard continuation and finally block.
        await new Promise(resolve => setTimeout(resolve, 0));
      }, outcome);
      await expect(page.locator('#shareNotice')).toBeEmpty();
      await expect(page.locator('#shareFallback')).toBeHidden();
      await expect(page.locator('#shareText')).toHaveValue('');
      await expect(page.locator('#resultShare')).toBeEnabled();
      expect(await page.evaluate(() => window.copyAttempts)).toBe(channel === 'clipboard' ? 1 : 0);
    });
  }
}
