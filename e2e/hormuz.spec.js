import { test, expect } from '@playwright/test';

test('Hormuz loads as a real 3D guest game and supports start, a real shot, pause and retry', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:4181');
  await expect(page.getByRole('heading', { name: 'Choose your island' })).toBeVisible();
  await page.locator('#play').click();
  await expect(page.locator('#status')).toContainText('Ready');
  await expect(page.locator('#strokes')).toHaveText('0');
  await page.locator('#scene').focus();await page.keyboard.press('Space');
  await expect(page.locator('#strokes')).toHaveText('1');
  await page.getByRole('button', {name:'Pause game'}).click();
  await expect(page.getByRole('heading',{name:'Take a breath'})).toBeVisible();
  await page.getByRole('button',{name:'Resume'}).click();
  await expect(page.locator('#pausePanel')).toBeHidden();
  await page.getByRole('button', {name:'Pause game'}).click();
  await page.locator('#pausePanel #restart').click();
  await expect(page.locator('#strokes')).toHaveText('0');
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#game')).not.toHaveClass(/hidden/);
  await expect(page.locator('#scene')).toBeVisible();
  const layout=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth:innerWidth}));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth);
  expect(errors).toEqual([]);
});
