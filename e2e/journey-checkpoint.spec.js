import { test, expect } from '@playwright/test';
import { shot } from './helpers/shot.js';
const key = 'persian-isles-golf:hormuz:journey-9:progress-v1';

test('a genuine completed hole survives reload; continue starts the next tee and practice cannot overwrite it', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4181/?qa');
  await page.locator('#play').click();
  await shot(page, -6.1, -0.8, 74);
  await expect(page.locator('#resultStrokes')).toHaveText('1');
  await page.reload();
  await expect(page.locator('#continueJourney')).toBeVisible();
  await expect(page.locator('#continueJourney')).toContainText('hole 2 of 9');
  await expect(page.locator('#journeyCheckpointNote')).toContainText('Completed holes are saved');
  await page.locator('#continueJourney').click();
  await expect(page.locator('#holeNumber')).toHaveText('2');
  await expect(page.locator('#strokes')).toHaveText('0');
  expect(await page.evaluate(() => window.__golf.state().journey)).toEqual([1]);
  await page.reload();
  await page.locator('[data-level="1"]').click();
  await shot(page, -6.1, -0.8, 74);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).scores, key)).toEqual([1]);
  await page.reload();
  await page.locator('#play').click();
  await expect(page.locator('#holeNumber')).toHaveText('1');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
  expect(errors).toEqual([]);
});

for (const island of ['qeshm', 'kish', 'khark', 'hengam']) {
  test(`${island} is preview-only and cannot expose a playable invitation`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:4181/?qa&island=${island}&hole=1`);
    await page.locator(`[data-island="${island}"]`).click();
    await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready', island);
    await expect(page.locator('#play')).toBeDisabled();
    await expect(page.locator('#play')).toHaveText('Preview only');
    await expect(page.locator('#levelGrid')).toBeHidden();
    await expect(page.locator('#invitation')).toBeHidden();
    await expect(page.locator('#continueJourney')).toBeHidden();
    await expect(page.locator('#levelGrid button:enabled')).toHaveCount(0);
  });
}
