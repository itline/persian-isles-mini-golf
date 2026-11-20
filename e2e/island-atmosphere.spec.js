import {test,expect} from '@playwright/test';
test('five distinct sparse fleets and low distant rocklets survive switching and vanish for play',async({page})=>{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:768,height:1024},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:4181/?qa');await page.emulateMedia({reducedMotion:'reduce'});
  const layouts=[];
  for(const id of ['hormuz','qeshm','kish','khark','hengam']){
   await page.locator(`[data-island="${id}"]`).click();await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready',id);await page.waitForTimeout(450);
   const state=await page.evaluate(()=>window.__golf.fleet());
   expect(state.boats.length).toBe(2);expect(state.visible).toBe(true);expect(state.details.length).toBe(id==='hormuz'?0:2);
   layouts.push(state.boats.map(b=>[Math.round(b.x),Math.round(b.y)]));const panel=await page.locator('.hero-copy').boundingBox();
   for(const box of [...state.boats,...state.details]){
    expect(box.x).toBeGreaterThan(0);expect(box.x+box.width).toBeLessThan(viewport.width);expect(box.y).toBeGreaterThan(65);expect(box.y+box.height).toBeLessThan(viewport.height);expect(box.width).toBeLessThan(46);
    expect(box.x<panel.x+panel.width&&box.x+box.width>panel.x&&box.y<panel.y+panel.height&&box.y+box.height>panel.y).toBe(false);
   }
  }
  expect(new Set(layouts.map(JSON.stringify)).size).toBe(5);
  await page.locator('[data-island="hormuz"]').click();await page.locator('#play').click();await expect.poll(()=>page.evaluate(()=>window.__golf.fleet().visible)).toBe(false);
 }
});
