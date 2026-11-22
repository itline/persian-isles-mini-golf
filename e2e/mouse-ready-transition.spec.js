import { test, expect } from '@playwright/test';
const base = process.env.GOLF_MOUSE_URL || 'http://127.0.0.1:4181';

test('holing while a mouse drag is held releases camera framing', async ({ page }) => {
  await page.goto(`${base}/?qa`);
  await page.locator('[data-level="1"]').click();
  const state = await page.evaluate(() => window.__golf.state());
  const delta = Math.atan2(-6.1 - state.ball.x, -(-0.8 - state.ball.z)) - state.angle;
  await page.locator('#scene').focus();
  for (let i = 0; i < Math.round(Math.abs(delta) / 0.055); i++)
    await page.keyboard.press(delta > 0 ? 'ArrowRight' : 'ArrowLeft');
  for (let i = 0; i < Math.round((0.74 - state.power) / 0.025); i++)
    await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  await page.mouse.move(700, 500);
  await page.mouse.down();
  await page.mouse.move(780, 560, { steps: 5 });
  expect(await page.evaluate(() => window.__golf.state().phase)).toBe('moving');
  expect(await page.evaluate(() => window.__golf.state().cameraFrozen)).toBe(true);
  await expect(page.locator('#resultPanel')).toBeVisible();
  await page.mouse.up();
  expect(await page.evaluate(() => window.__golf.state().cameraFrozen)).toBe(false);
  await expect(page.locator('#strokes')).toHaveText('1');
});

test('a release while rolling is not queued and the next ready drag still works', async ({ page }) => {
  await page.goto(`${base}/?qa`);
  await page.locator('[data-level="1"]').click();
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#strokes')).toHaveText('1');
  const start = { x: 700, y: 500 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 80, start.y + 60, { steps: 5 });
  expect(await page.evaluate(() => window.__golf.state().phase)).toBe('moving');
  await page.mouse.up();
  await page.waitForFunction(() => window.__golf.state().phase === 'aiming');
  await expect(page.locator('#strokes')).toHaveText('1');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 80, start.y + 60, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#strokes')).toHaveText('2');
});

test('a held mouse drag crossing the ready transition is not silently discarded', async ({ page }) => {
  await page.goto(`${base}/?qa`);
  await page.locator('[data-level="1"]').click();
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#strokes')).toHaveText('1');
  // Observe only. Begin dragging during the slow tail of a genuine putt;
  // no time, position, phase or physics settings are modified.
  await page.waitForFunction(() => {
    const state = window.__golf.state();
    return state.phase === 'moving' && state.ball.z < 2;
  });
  const start = await page.evaluate(() => {
    const state = window.__golf.state();
    return window.__golf.project(state.ball.x, state.ball.z);
  });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  expect(await page.evaluate(() => window.__golf.state().phase)).toBe('moving');
  await page.mouse.move(start.x + 90, start.y + 70, { steps: 6 });
  await page.waitForFunction(() => window.__golf.state().phase === 'aiming');
  await page.mouse.up();
  await expect(page.locator('#strokes')).toHaveText('2');
});
