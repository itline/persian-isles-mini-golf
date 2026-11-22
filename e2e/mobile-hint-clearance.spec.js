import { test, expect } from '@playwright/test';
const url = new URL('/?qa&island=hormuz&hole=2', process.env.GOLF_URL || 'http://127.0.0.1:4181').href;

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`first-putt hint leaves the ball clear ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto(url);
    await expect(page.locator('#invitationPlay')).toBeEnabled();
    await page.locator('#invitationPlay').click();
    await expect(page.locator('#levelName')).toHaveText('Salt Valley');
    expect((await page.evaluate(() => window.__golf.state())).level).toBe(2);
    await expect(page.locator('#hint')).toBeVisible();
    // The touch camera eases from the menu overview into the playable follow view.
    // Wait for that genuine transition, not an arbitrary fixed sleep.
    await expect.poll(() => page.evaluate(() => {
      const hint = document.querySelector('#hint').getBoundingClientRect();
      const position = window.__golf.state().ball;
      const ball = window.__golf.project(position.x, position.z);
      return Math.max(hint.left - ball.x, ball.x - hint.right, hint.top - ball.y, ball.y - hint.bottom);
    })).toBeGreaterThanOrEqual(16);
    const { hint, ball } = await page.evaluate(() => {
      const hint = document.querySelector('#hint').getBoundingClientRect();
      const position = window.__golf.state().ball;
      const ball = window.__golf.project(position.x, position.z);
      return { hint: { left: hint.left, right: hint.right, top: hint.top, bottom: hint.bottom }, ball };
    });
    const separation = Math.max(hint.left - ball.x, ball.x - hint.right, hint.top - ball.y, ball.y - hint.bottom);
    expect(separation).toBeGreaterThanOrEqual(16);
    await context.close();
  });
}
