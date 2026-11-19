import {test,expect} from '@playwright/test';
test('island-first menu is calm, readable, bilingual and reversible in language',async({page})=>{
 await page.goto('http://127.0.0.1:4181/?qa');await page.waitForFunction(()=>window.__golf);
 expect(await page.locator('.island-tab').first().getAttribute('data-island')).toBe('hormuz');
 await expect(page.locator('.island-tab small')).toHaveCount(0);
 await expect(page.getByText('THE PERSIAN GULF COLLECTION / 01',{exact:true})).toHaveCount(0);
 await expect(page.getByText('LOCKED',{exact:true})).toHaveCount(0);
 await expect(page.locator('#zoomIn')).toHaveCount(0);await expect(page.locator('#zoomOut')).toHaveCount(0);
 await expect(page.locator('.level-button')).toHaveCount(10);await expect(page.locator('.level-button:not(:disabled)')).toHaveCount(3);
 await expect(page.locator('[data-level="1"]')).toContainText('Par 2');await expect(page.locator('[data-level="1"]')).toContainText('Best');
 await page.locator('#languageFa').click();await expect(page.locator('html')).toHaveAttribute('lang','fa');await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect(page.locator('#selectedIslandName')).toHaveText('هرمز');
 await page.reload();await page.waitForFunction(()=>window.__golf);await expect(page.locator('html')).toHaveAttribute('lang','fa');
 await page.locator('[data-level="1"]').click();await expect(page.locator('#levelName')).toHaveText('ساحل سرخ');
 await page.keyboard.press('Space');await expect(page.locator('#strokes')).toHaveText('۱');
 await page.locator('#pause').click();await expect(page.locator('#pauseTitle')).toHaveText('نفسی تازه کنید.');
 await page.locator('#backHome').click();await page.locator('#languageEn').click();await expect(page.locator('html')).toHaveAttribute('dir','ltr');await expect(page.locator('#selectedIslandName')).toHaveText('Hormuz');
});
