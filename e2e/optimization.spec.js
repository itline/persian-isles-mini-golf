import { test, expect } from '@playwright/test';

test('unchanged aiming does not rewrite shot status DOM; pause and restart stay synchronized', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:4181/?qa');
  await page.locator('[data-level="1"]').click();
  await expect(page.locator('#status')).toHaveText('Ready to putt');
  await expect(page.locator('#putt')).toBeEnabled();
  const changes = await page.evaluate(async () => {
    const mutations = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(document.querySelector('#status'), { childList: true });
    observer.observe(document.querySelector('.shot-controls'), {
      attributes: true,
      attributeFilter: ['data-phase'],
    });
    observer.observe(document.querySelector('#putt'), {
      attributes: true,
      attributeFilter: ['disabled'],
    });
    for (let frame = 0; frame < 12; frame++) await new Promise(requestAnimationFrame);
    observer.disconnect();
    return mutations.length;
  });
  expect(changes).toBe(0);
  await page.locator('#pause').click();
  await expect(page.locator('#putt')).toBeDisabled();
  await page.locator('#resume').click();
  await expect(page.locator('#putt')).toBeEnabled();
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#strokes')).toHaveText('1');
  await expect(page.locator('#putt')).toBeDisabled();
  await page.locator('#pause').click();
  await page.locator('#restart').click();
  await expect(page.locator('#strokes')).toHaveText('0');
  await expect(page.locator('#putt')).toBeEnabled();
  await expect(page.locator('.shot-controls')).toHaveAttribute('data-phase', 'ready');
});
