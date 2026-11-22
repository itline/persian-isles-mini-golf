import { test, expect } from '@playwright/test';

test('unchanged aiming does not rewrite live status; pause blocks shots and restart resets', async ({ page }) => {
  await page.goto('http://127.0.0.1:4181/?qa');
  await page.locator('[data-level="1"]').click();
  await expect(page.locator('#status')).toHaveText('Ready to putt');
  await expect(page.locator('#status')).toHaveAttribute('data-phase', 'ready');
  await expect(page.locator('#status')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('#putt, .shot-controls')).toHaveCount(0);
  const changes = await page.evaluate(async () => {
    const mutations = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(document.querySelector('#status'), {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-phase'],
    });
    for (let frame = 0; frame < 12; frame++) await new Promise(requestAnimationFrame);
    observer.disconnect();
    return mutations.length;
  });
  expect(changes).toBe(0);
  await page.locator('#pause').click();
  await expect(page.locator('#pausePanel')).toBeVisible();
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#strokes')).toHaveText('0');
  await expect(page.locator('#pausePanel')).toBeVisible();
  await page.locator('#resume').click();
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#strokes')).toHaveText('1');
  await expect(page.locator('#status')).toHaveAttribute('data-phase', 'rolling');
  await expect(page.locator('#status')).toHaveText('Rolling');
  await page.locator('#pause').click();
  await page.locator('#pausePanel #restart').click();
  await expect(page.locator('#pausePanel')).toBeHidden();
  await expect(page.locator('#strokes')).toHaveText('0');
  await expect(page.locator('#status')).toHaveAttribute('data-phase', 'ready');
  await expect(page.locator('#status')).toHaveText('Ready to putt');
});
