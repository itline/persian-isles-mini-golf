import { test, expect } from '@playwright/test';
import { shot } from './helpers/shot.js';
const url = process.env.GOLF_DEMO_URL || 'http://127.0.0.1:4181';

test('Pause keeps keyboard navigation inside its own controls', async ({ page }) => {
  await page.goto(`${url}/?qa`);
  await page.locator('#play').click();
  await page.locator('#pause').click();
  await expect(page.locator('#resume')).toBeFocused();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#pausePanel'))).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('#pausePanel'))).toBe(true);
  await expect(page.locator('#audioPanel')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#scene')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('#strokes')).toHaveText('1');
});

test('a mouse release uses its final direction even without a last move event', async ({ page }) => {
  await page.goto(`${url}/?qa`);
  await page.locator('[data-level="1"]').click();
  await expect.poll(() => page.evaluate(() => {
    const b = window.__golf.state().ball;
    const p = window.__golf.project(b.x, b.z);
    return p.x > 100 && p.y > 100 && p.x < innerWidth - 100 && p.y < innerHeight - 100;
  })).toBe(true);
  const points = await page.evaluate(() => {
    const b = window.__golf.state().ball;
    return {
      start: window.__golf.project(b.x, b.z),
      move: window.__golf.project(b.x, b.z + 0.3),
      release: window.__golf.project(b.x + 1.5, b.z),
    };
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...points.start, button: 'left', buttons: 1, clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...points.move, buttons: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...points.release, button: 'left', buttons: 0, clickCount: 1 });
  await expect(page.locator('#strokes')).toHaveText('1');
  expect(await page.evaluate(() => window.__golf.state().angle)).toBeCloseTo(-Math.PI / 2, 1);
});

test('Practice keeps replay as its primary focused action', async ({ page }) => {
  await page.goto(`${url}/?qa`);
  await page.locator('[data-level="1"]').click();
  await shot(page, -6.1, -0.8, 74);
  await expect(page.locator('#resultPanel')).toBeVisible();
  await expect(page.locator('#resultRetry')).toHaveClass(/primary/);
  await expect(page.locator('#resultRetry')).toBeFocused();
});

test('phone touch drag shoots once and a pinch never shoots', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${url}/?qa`);
    await page.locator('[data-level="1"]').tap();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: 120, y: 350 }, { id: 2, x: 260, y: 350 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: 100, y: 350 }, { id: 2, x: 280, y: 350 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#strokes')).toHaveText('0');
    await page.locator('#pause').tap();
    await page.locator('#restart').tap();
    await expect.poll(() => page.evaluate(() => {
      const b = window.__golf.state().ball;
      return window.__golf.project(b.x, b.z).y < innerHeight - 100;
    })).toBe(true);
    const points = await page.evaluate(() => {
      const b = window.__golf.state().ball;
      return { start: window.__golf.project(b.x, b.z), end: window.__golf.project(b.x, b.z + 1.2) };
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 3, ...points.start }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 3, ...points.end }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#strokes')).toHaveText('1');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('Journey offers and focuses the next step after a genuine holed putt', async ({ page }) => {
  await page.goto(`${url}/?qa`);
  await page.locator('#play').click();
  await shot(page, -6.1, -0.8, 74);
  await expect(page.locator('#resultPanel')).toBeVisible();
  await expect(page.locator('#resultNext')).toHaveClass(/primary/);
  await expect(page.locator('#resultNext')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#holeNumber')).toHaveText('2');
  await expect(page.locator('#scene')).toBeFocused();
});
