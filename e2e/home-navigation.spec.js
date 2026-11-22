import { test, expect } from '@playwright/test';

const url = 'http://127.0.0.1:4181/';

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`pause is directly reachable and returns to islands at ${viewport.width}`, async ({ browser }) => {
    const mobile = viewport.width < 600;
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    await page.goto(url);
    await page.locator('#play').click();
    const pause = page.getByRole('button', { name: 'Pause game', exact: true });
    await expect(pause).toBeVisible();
    await expect(page.locator('#home, #gameMenuToggle, #gameTools')).toHaveCount(0);
    await pause.click();
    await expect(page.locator('#pausePanel')).toBeVisible();
    await expect(page.locator('#resume')).toBeVisible();
    await expect(page.locator('#restart')).toBeVisible();
    await page.locator('#backHome').click();
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page.locator('#leavePanel')).toBeHidden();
    await context.close();
  });
}

test('browser Back confirms progress loss and cancellation restores the unpaused round', async ({ page }) => {
  await page.goto(url + '?qa');
  await page.locator('#play').click();
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#strokes')).toHaveText('1');
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Back to the islands?' })).toBeVisible();
  await expect(page.locator('#leaveCancel')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.__golf.state().paused)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#leavePanel')).toBeHidden();
  await expect(page.locator('#strokes')).toHaveText('1');
  await expect.poll(() => page.evaluate(() => window.__golf.state().paused)).toBe(false);
  await page.goBack();
  await page.locator('#leaveConfirm').click();
  await expect(page.locator('#menu')).toBeVisible();
});

test('cancelling home from pause preserves pause and keyboard focus', async ({ page }) => {
  await page.goto(url + '?qa');
  await page.locator('#play').click();
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  await page.locator('#pause').click();
  await page.locator('#backHome').click();
  await expect(page.locator('#leavePanel')).toBeVisible();
  await page.locator('#leaveCancel').click();
  await expect(page.locator('#pausePanel')).toBeVisible();
  await expect(page.locator('#backHome')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.__golf.state().paused)).toBe(true);
  await page.locator('#resume').click();
  await expect.poll(() => page.evaluate(() => window.__golf.state().paused)).toBe(false);
});

test('browser Back returns inside the game and remains natural at the island menu', async ({ page }) => {
  await page.goto(url + 'LICENSE.txt');
  await page.goto(url + '?qa');
  await page.locator('#play').click();
  await page.goBack();
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#game')).toBeHidden();
  await page.goBack();
  await expect(page).toHaveURL(url + 'LICENSE.txt');
});

test('phone Back preserves sound modal pause state and home remains available through pause', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(url + '?qa');
  await page.locator('#play').tap();
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  await page.locator('#sound').tap();
  await expect(page.locator('#audioPanel')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#leavePanel')).toBeVisible();
  await page.locator('#leaveCancel').tap();
  await expect(page.locator('#audioPanel')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__golf.state().paused)).toBe(true);
  await page.locator('#audioClose').tap();
  await expect.poll(() => page.evaluate(() => window.__golf.state().paused)).toBe(false);
  await page.locator('#pause').tap();
  await page.locator('#backHome').tap();
  await expect(page.locator('#leavePanel')).toBeVisible();
  await page.locator('#leaveConfirm').tap();
  await expect(page.locator('#menu')).toBeVisible();
  await context.close();
});

test('browser Back can cancel or confirm leaving without growing history', async ({ page }) => {
  await page.goto(url + 'LICENSE.txt');
  await page.goto(url + '?qa');
  await page.locator('#play').click();
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#strokes')).toHaveText('1');
  const length = await page.evaluate(() => history.length);
  await page.goBack();
  await expect(page.locator('#leavePanel')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#leavePanel')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__golf.state().paused)).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.locator('#leaveConfirm')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#leaveCancel')).toBeFocused();
  await page.locator('#leaveCancel').click();
  await expect(page.locator('#leavePanel')).toBeHidden();
  await expect(page.locator('#game')).not.toHaveClass(/hidden/);
  await expect(page.locator('#strokes')).toHaveText('1');
  await page.goBack();
  await expect(page.locator('#leavePanel')).toBeVisible();
  await page.locator('#leaveConfirm').click();
  await expect(page.locator('#menu')).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.goBack();
  await expect(page).toHaveURL(url + 'LICENSE.txt');
});
