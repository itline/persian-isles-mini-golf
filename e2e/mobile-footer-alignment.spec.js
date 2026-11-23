import {test,expect} from '@playwright/test';
for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
 test(`mobile footer has balanced touch cells and centered island arrows ${viewport.width}`,async({browser})=>{
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});const page=await context.newPage();
  await page.goto('http://127.0.0.1:4181/');await page.locator('#play:enabled').waitFor();await page.evaluate(()=>document.fonts.ready);
  const links=page.locator('.menu-footer a,.menu-footer button');await expect(links).toHaveCount(4);
  const boxes=await links.evaluateAll(ns=>ns.map(n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height}}));
  for(const b of boxes){expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);expect(b.y+b.height).toBeLessThanOrEqual(viewport.height);expect(b.width).toBeCloseTo(boxes[0].width,0);}
  for(const id of ['prevIsland','nextIsland']){
   const button=page.locator('#'+id);await expect(button.locator('svg')).toHaveCount(1);
   const b=await button.boundingBox(),s=await button.locator('svg').boundingBox();
   expect(Math.abs(b.x+b.width/2-s.x-s.width/2)).toBeLessThan(1);
   expect(Math.abs(b.y+b.height/2-s.y-s.height/2)).toBeLessThan(1);
  }
  await page.locator('#nextIsland').tap();await expect(page.locator('#selectedIslandName')).toHaveText('Qeshm');
  await page.locator('#prevIsland').tap();await expect(page.locator('#selectedIslandName')).toHaveText('Hormuz');
  await page.locator('#helpFooter').tap();await expect(page.locator('#helpPanel')).toBeVisible();await page.locator('#helpClose').tap();
  await page.locator('#creditsOpen').tap();await expect(page.locator('#credits')).toBeVisible();
  await context.close();
 });
}
