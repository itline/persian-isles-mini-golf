import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 320, height: 568 }, { width: 390, height: 844 },
  { width: 844, height: 390 }, { width: 1440, height: 900 },
]) {
  test(`camera bar stays bottom-right clear of round information at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const mobile = viewport.width < 1000;
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4181/?qa');
    await page.locator('#play').click();
    const camera = page.getByRole('group', { name: 'Camera controls' });
    await expect(page.locator('#game > .zoom-controls')).toHaveCount(1);
    await expect(camera.locator('button')).toHaveCount(3);
    await expect(page.locator('#gameMenuToggle, #gameTools')).toHaveCount(0);
    await expect(page.locator('#manualToggle, #manualControls, #manualClose, #power, #powerValue, #aimLeft, #aimRight, #putt, #restartQuick, .shot-controls')).toHaveCount(0);
    for (const [id, name] of [['zoomOut', 'Zoom out'], ['zoomIn', 'Zoom in'], ['overview', mobile ? 'Show whole course' : 'Reset camera']]) {
      const control = camera.locator(`#${id}`);
      await expect(control).toBeVisible();
      await expect(control).toBeEnabled();
      await expect(control).toBeInViewport();
      await expect(control).toHaveAccessibleName(name);
      // Trial clicks verify that visible controls are not covered by another UI.
      await control.click({ trial: true });
    }
    const bar = await camera.boundingBox();
    // The full bar may cross the midpoint on a 320px phone; its center
    // must stay on the right and its bounds must clear round information.
    expect(bar.x + bar.width / 2).toBeGreaterThan(viewport.width / 2);
    const information = await page.locator('.game-title').boundingBox();
    expect(information).not.toBeNull();
    expect(bar.x + bar.width <= information.x || information.x + information.width <= bar.x ||
      bar.y + bar.height <= information.y || information.y + information.height <= bar.y,
    'camera bar does not overlap round information').toBe(true);
    expect(bar.y).toBeGreaterThan(viewport.height / 2);
    expect(viewport.width - bar.x - bar.width).toBeGreaterThanOrEqual(0);
    expect(viewport.width - bar.x - bar.width).toBeLessThanOrEqual(32);
    expect(viewport.height - bar.y - bar.height).toBeGreaterThanOrEqual(0);
    expect(viewport.height - bar.y - bar.height).toBeLessThanOrEqual(32);
    const buttons = await camera.locator('button').evaluateAll(elements => elements.map(el => ({ id: el.id, x: el.getBoundingClientRect().x })));
    expect(buttons.map(button => button.id)).toEqual(['zoomOut', 'zoomIn', 'overview']);
    expect(buttons[0].x).toBeLessThan(buttons[1].x);
    expect(buttons[1].x).toBeLessThan(buttons[2].x);
    await camera.locator('#zoomIn').click();
    await expect.poll(() => page.evaluate(() => window.__golf.state().targetZoom)).toBeGreaterThan(1);
    await camera.locator('#zoomOut').click();
    await expect.poll(() => page.evaluate(() => window.__golf.state().targetZoom)).toBe(1);
    await camera.locator('#overview').click();
    await expect(page.locator('#strokes')).toHaveText('0');
    await expect(camera).toBeVisible();
    await context.close();
  });
}
