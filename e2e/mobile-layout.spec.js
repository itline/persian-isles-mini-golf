import { test, expect } from '@playwright/test';

const url = 'http://127.0.0.1:4181/?qa';

async function fittedCourse(page, viewport) {
  const portrait = viewport.width < viewport.height;
  await expect.poll(() => page.evaluate(({ width, height, portrait }) => {
    const b = window.__golf.courseBounds();
    const occupancy = Math.max(b.width / (width - 40), b.height / (height - (portrait ? 240 : 175)));
    return b.left >= 20 && b.right <= width - 20 && occupancy > .8 &&
      b.top >= (portrait ? 110 : 90) && b.bottom <= height - (portrait ? 130 : 85);
  }, { ...viewport, portrait })).toBe(true);
  const course = await page.evaluate(() => window.__golf.courseBounds());
  // A wide hole on a tall phone is width-limited; require useful occupancy
  // on the limiting axis rather than forcing every hole to fill both axes.
  const availableHeight = viewport.height - (portrait ? 240 : 175);
  expect(Math.max(course.width / (viewport.width - 40), course.height / availableHeight)).toBeGreaterThan(.8);
  return course;
}

async function zoomOutToCourse(page) {
  await expect(page.locator('#overview')).toHaveAccessibleName('Return to ball');
  for (let i = 0; i < 16 && await page.locator('#zoomOut').isEnabled(); i++) {
    await page.locator('#zoomOut').tap();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  await expect(page.locator('#zoomOut')).toBeDisabled();
}

for (const viewport of [
  { width: 320, height: 568 }, { width: 390, height: 844 },
  { width: 667, height: 375 }, { width: 844, height: 390 },
]) for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  test(`hole ${level} phone zoom-out fits and returns to ball at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto(url);
      await page.locator(`[data-level="${level}"]`).tap();
      await page.locator('#zoomIn').tap();
      await expect.poll(() => page.evaluate(() => window.__golf.state().zoom)).toBeGreaterThan(1.1);
      await zoomOutToCourse(page);
      await fittedCourse(page, viewport);
      await expect(page.locator('#overview')).toHaveAttribute('aria-label', 'Return to ball');
      await page.locator('#overview').tap();
      await expect.poll(() => page.evaluate(() => window.__golf.state().cameraMode)).toBe('follow');
      await expect.poll(() => page.evaluate(() => window.__golf.state().zoom)).toBe(1);
      await expect(page.locator('#strokes')).toHaveText('0');
      await page.locator('#pause').tap();
      await page.locator('#backHome').tap();
    await context.close();
  });
}

test('rotating a phone preserves the full-course zoom and the round', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(url);
  await page.locator('[data-level="3"]').tap();
  await zoomOutToCourse(page);
  await fittedCourse(page, { width: 390, height: 844 });
  await page.setViewportSize({ width: 844, height: 390 });
  await fittedCourse(page, { width: 844, height: 390 });
  await expect.poll(() => page.evaluate(() => window.__golf.state().level)).toBe(3);
  await expect(page.locator('#strokes')).toHaveText('0');
  await context.close();
});

test('large touch displays retain the existing desktop framing', async ({ browser }) => {
  const viewport = { width: 1440, height: 900 };
  const samples = [];
  for (const hasTouch of [false, true]) {
    const context = await browser.newContext({ viewport, hasTouch });
    const page = await context.newPage();
    await page.goto(url);
    await page.locator('#play').click();
    // Read-only observation of camera convergence, not a gameplay-state mutation.
    await page.waitForFunction(() => {
      const now = window.__golf.courseBounds();
      const old = window.__cameraSample;
      window.__cameraSample = now;
      return old && Math.abs(old.left - now.left) < .01 && Math.abs(old.top - now.top) < .01;
    });
    samples.push(await page.evaluate(() => window.__golf.courseBounds()));
    expect(await page.evaluate(() => window.__golf.state().targetZoom)).toBe(1);
    await context.close();
  }
  for (const key of ['left', 'right', 'top', 'bottom']) expect(samples[1][key]).toBeCloseTo(samples[0][key], 0);
});

test('landscape touch controls have usable hit targets', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4181/');
  await page.locator('#play').tap();
  await expect(page.locator('#manualToggle, #manualControls, #manualClose, #power, #powerValue, #aimLeft, #aimRight, #putt, #restartQuick, .shot-controls')).toHaveCount(0);
  for (const selector of ['#zoomOut', '#zoomIn', '#overview', '#pause', '#sound']) {
    await expect(page.locator(selector)).toBeVisible();
    const box = await page.locator(selector).boundingBox();
    expect(box, `${selector} is visible`).not.toBeNull();
    expect(box.width, `${selector} width`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${selector} height`).toBeGreaterThanOrEqual(44);
  }
  await context.close();
});
