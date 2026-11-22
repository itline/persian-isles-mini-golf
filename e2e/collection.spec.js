import {test,expect} from '@playwright/test';
const url=new URL('/?qa',process.env.GOLF_URL||'http://127.0.0.1:4181').href;
test('nine Hormuz holes and four preview-only islands distinguish unpublished content',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await expect(page.locator('.island-tab')).toHaveCount(5);
 await expect(page.getByRole('button',{name:'Play Hormuz journey'})).toBeEnabled();
 await expect(page.locator('.level-button')).toHaveCount(9);
 await expect(page.locator('.level-button:visible:not(:disabled)')).toHaveCount(9);
 await expect(page.locator('.course-sketch')).toHaveCount(9);
 await expect(page.locator('#levelGrid')).not.toContainText(/Soon/i);
 expect(await page.locator('.level-button').evaluateAll(cards=>cards.map(card=>Number(card.dataset.level)))).toEqual([1,2,3,4,5,6,7,8,9]);
 for(const id of ['qeshm','kish','khark','hengam']){
  await page.locator(`[data-island="${id}"]`).click();
  await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready',id);
  await expect(page.locator('#islandAvailability')).toBeHidden();await expect(page.locator('#play')).toHaveText('Preview only');
  await expect(page.locator('#play')).toBeDisabled();
  await expect(page.locator('#levelGrid')).toBeHidden();
  await expect(page.locator('.level-button:not(:disabled)')).toHaveCount(0);
  await expect(page.locator('#invitationPlay')).toBeHidden();
  await page.waitForFunction(id=>window.__golf.state().preview===id,id);
 }
 await page.locator('[data-island="hormuz"]').click();
 await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready','hormuz');
 await expect(page.locator('#play')).toBeEnabled();
 await expect(page.locator('.level-button:visible:not(:disabled)')).toHaveCount(9);
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
