import { test, expect } from '@playwright/test';

for (const interruption of ['pause', 'blur', 'sound']) {
  test(`${interruption} cancels held pinch and allows a fresh touch shot`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4181/?qa');
    await page.locator('[data-level="1"]').tap();
    const cdp = await context.newCDPSession(page);
    const contacts = [{ id: 1, x: 130, y: 350 }, { id: 2, x: 260, y: 350 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: contacts });
    if (interruption === 'pause') {
      await page.locator('#pause').focus();
      await page.keyboard.press('Enter');
    } else if (interruption === 'sound') {
      await page.locator('#sound').focus();
      await page.keyboard.press('Enter');
    } else {
      // Headless tab switching does not reliably deliver OS window blur.
      // Simulate that lifecycle event only; all touch contacts remain browser input.
      await page.evaluate(() => dispatchEvent(new Event('blur')));
    }
    await expect(page.locator(interruption === 'sound' ? '#audioPanel' : '#pausePanel')).toBeVisible();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: 50, y: 350 }, { id: 2, x: 340, y: 350 }] });
    const pausedState = await page.evaluate(() => window.__golf.state());
    expect(pausedState.paused).toBe(true);
    expect(pausedState.targetZoom).toBe(1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.locator(interruption === 'sound' ? '#audioClose' : '#resume').tap();
    await expect.poll(() => page.evaluate(() => window.__golf.state().zoom)).toBeCloseTo(1, 2);
    const points = await page.evaluate(() => {
      const ball = window.__golf.state().ball;
      return { start: window.__golf.project(ball.x, ball.z), end: window.__golf.project(ball.x, ball.z + 1) };
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points.start] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [points.end] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#strokes')).toHaveText('1');
    expect(errors).toEqual([]);
    await context.close();
  });
}
