import { test, expect } from '@playwright/test';
import { shot as keyboardShot } from './helpers/shot.js';

test('a whole Hormuz round can be completed with real keyboard input; best persists and retry resets', async ({
  page,
}) => {
  test.setTimeout(100000);
  const errors = [],
    external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4181') && !r.url().startsWith('data:'))
      external.push(r.url());
  });
  await page.goto('http://127.0.0.1:4181/?qa');
  await page.locator('[data-level="3"]').click();
  await page.waitForTimeout(900);
  const shot = (x, z, power) => keyboardShot(page, x, z, power, 20000);
  await shot(-6.1, -4.2, 88);
  await shot(-3, -4.2, 47);
  await shot(6, -4.2, 78);
  await shot(6, 5.4, 82);
  await expect(page.locator('#resultPanel')).toBeVisible();
  await expect(page.locator('#resultStrokes')).toHaveText('4');
  await expect(page.locator('#resultBest')).toHaveText('4');
  await page.getByRole('button', { name: /Find a better line/ }).click();
  await expect(page.locator('#strokes')).toHaveText('0');
  await expect(page.locator('#resultBest')).toHaveText('4');
  await page.reload();
  await page.locator('[data-level="3"]').click();
  expect(
    await page.evaluate(() => localStorage.getItem('persian-isles-golf:hormuz:level-3:v2')),
  ).toBe('4');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('real pointer drag fires a shot and pointercancel does not', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4181/?qa');
  await page.getByRole('button', { name: 'Play Hormuz' }).click();
  await page.waitForTimeout(1200);
  const points = await page.evaluate(() => {
    const s = window.__golf.state();
    return {
      start: window.__golf.project(s.ball.x, s.ball.z),
      end: window.__golf.project(s.ball.x, s.ball.z + 2.2),
    };
  });
  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down();
  await page.mouse.move(points.end.x, points.end.y, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('#strokes')).toHaveText('1');
  await page.locator('#pause').click();
  await page.locator('#pausePanel #restart').click();
  const cdp = await page.context().newCDPSession(page);
  const next = await page.evaluate(() => {
    const ball = window.__golf.state().ball;
    return { start: window.__golf.project(ball.x, ball.z), end: window.__golf.project(ball.x, ball.z + 1) };
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [next.start] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [next.end] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('#strokes')).toHaveText('0');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [next.start] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [next.end] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#strokes')).toHaveText('1');
  expect(errors).toEqual([]);
});

test('landscape touch drag works without horizontal overflow or auth requests', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:4181/?qa');
  await page.getByRole('button', { name: 'Play Hormuz' }).tap();
  await page.waitForTimeout(1200);
  const points = await page.evaluate(() => {
    const s = window.__golf.state();
    return {
      start: window.__golf.project(s.ball.x, s.ball.z),
      end: window.__golf.project(s.ball.x, s.ball.z + 1.5),
    };
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: points.start.x, y: points.start.y }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: points.end.x, y: points.end.y }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#strokes')).toHaveText('1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'game-landscape.png' });
  await context.close();
});
