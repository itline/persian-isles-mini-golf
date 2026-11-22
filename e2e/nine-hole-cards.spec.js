import { test, expect } from '@playwright/test';
for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
  test(`all nine course thumbnails fit their cards and the final hole is reachable ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('http://127.0.0.1:4181/?qa');
    await expect(page.locator('#play')).toBeEnabled();
    await expect(page.locator('.level-button:enabled')).toHaveCount(9);
    await expect(page.locator('.future-marker')).toHaveCount(0);
    const bounds = await page.locator('.level-button').evaluateAll(buttons => buttons.map(button => {
      const card = button.getBoundingClientRect(), sketch = button.querySelector('svg').getBoundingClientRect();
      return { id: button.dataset.level, bottom: sketch.bottom - card.top, height: card.height };
    }));
    for (const card of bounds) expect(card.bottom, `hole ${card.id} sketch clips its card`).toBeLessThanOrEqual(card.height - 2);
    await page.locator('[data-level="9"]').click();
    await expect(page.locator('#holeNumber')).toHaveText('9');
    await expect(page.locator('#game')).not.toHaveClass(/hidden/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}
