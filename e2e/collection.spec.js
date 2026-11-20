import {test,expect} from '@playwright/test';
const url='http://127.0.0.1:4181/?qa';
test('five island previews and ten Hormuz slots distinguish unpublished content',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await expect(page.getByRole('button',{name:'Play Hormuz journey'})).toBeEnabled();
 await expect(page.locator('.level-button')).toHaveCount(10);
 await expect(page.locator('.level-button:not(:disabled)')).toHaveCount(3);
 for(const id of ['qeshm','kish','khark','hengam']){
  await page.locator(`[data-island="${id}"]`).click();
  await expect(page.locator('#islandAvailability')).toHaveText('Coming soon · Preview only');
  await expect(page.locator('#play')).toBeDisabled();
  await page.waitForFunction(id=>window.__golf.state().preview===id,id);
 }
 await page.locator('[data-island="hormuz"]').click();
 await expect(page.locator('#play')).toBeEnabled();
 await page.locator('[data-level="1"]').click();
 await expect(page.locator('#levelName')).toHaveText('Red Shore');
 expect(errors).toEqual([]);
});
test('zoom is real, bounded, aim-safe and has an overview reset',async({page})=>{
 await page.goto(url);await page.locator('[data-level="1"]').click();
 await page.mouse.move(600,250);await page.mouse.wheel(0,-150);
 await page.waitForTimeout(600);
 expect((await page.evaluate(()=>window.__golf.state())).zoom).toBeGreaterThan(1);
 for(let i=0;i<15;i++)await page.mouse.wheel(0,-150);
 await page.waitForTimeout(600);expect((await page.evaluate(()=>window.__golf.state())).zoom).toBeLessThanOrEqual(1.851);
 await page.getByRole('button',{name:'Reset camera'}).click();await page.waitForTimeout(600);
 expect((await page.evaluate(()=>window.__golf.state())).zoom).toBeCloseTo(1,1);
 await expect(page.locator('#strokes')).toHaveText('0');
});
