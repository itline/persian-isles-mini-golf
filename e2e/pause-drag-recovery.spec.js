import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`pausing during a held drag releases camera freeze ${viewport.width}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, ...(viewport.width < 500 ? { isMobile: true, hasTouch: true } : {}) });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4181/?qa');
    await page.locator('[data-level="1"]').click();
    await expect.poll(() => page.evaluate(() => {
      const state = window.__golf.state();
      const ball = window.__golf.project(state.ball.x, state.ball.z);
      return ball.x > 20 && ball.y > 20 && ball.x < innerWidth - 20 && ball.y < innerHeight - 20;
    })).toBe(true);
    const points = await page.evaluate(() => {
      const ball = window.__golf.state().ball;
      return { start: window.__golf.project(ball.x, ball.z), end: window.__golf.project(ball.x, ball.z + 1) };
    });
    await page.mouse.move(points.start.x, points.start.y);
    await page.mouse.down();
    await page.mouse.move(points.end.x, points.end.y, { steps: 5 });
    await page.locator('#pause').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#pausePanel')).toBeVisible();
    await page.mouse.up();
    await page.locator('#resume').click();
    await page.locator('#zoomIn').click();
    await expect.poll(() => page.evaluate(() => window.__golf.state().zoom)).toBeCloseTo(1.15, 2);
    await expect(page.locator('#strokes')).toHaveText('0');
    expect(errors).toEqual([]);
    await context.close();
  });
}
