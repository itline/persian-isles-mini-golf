import { test, expect } from '@playwright/test';
const url = 'http://127.0.0.1:4181/';

test('reloading a round returns to the real menu history entry', async ({page}) => {
  await page.goto(url + 'LICENSE.txt');
  await page.goto(url + '?qa');
  await page.locator('#play').click();
  await page.reload();
  await expect(page.locator('#menu')).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.state?.golfView)).not.toBe('game');
  await page.goBack();
  await expect(page).toHaveURL(url + 'LICENSE.txt');
  await page.goForward();
  await expect(page.locator('#menu')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#menu')).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.state?.golfView)).not.toBe('game');
  await page.goBack();
  await expect(page).toHaveURL(url + 'LICENSE.txt');
});
