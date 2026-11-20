import {test,expect} from '@playwright/test';
const url='http://127.0.0.1:4181/?qa';
test('sparse distant vessels stay outside folio and disappear for gameplay',async({page})=>{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:768,height:1024},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.goto(url);await page.waitForFunction(()=>window.__golf);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(1200);
  const fleet=await page.evaluate(()=>window.__golf.fleet());
  expect(fleet.visible).toBe(true);expect(fleet.boats.length).toBe(2);
  const panel=await page.locator('.hero-copy').boundingBox();
  for(const boat of fleet.boats){
   expect(boat.x).toBeGreaterThan(0);expect(boat.x+boat.width).toBeLessThan(viewport.width);
   expect(boat.y).toBeGreaterThan(65);expect(boat.y+boat.height).toBeLessThan(viewport.height);
   expect(boat.width).toBeGreaterThan(10);expect(boat.width).toBeLessThan(42);
   const intersects=boat.x<panel.x+panel.width&&boat.x+boat.width>panel.x&&boat.y<panel.y+panel.height&&boat.y+boat.height>panel.y;
   expect(intersects).toBe(false);
  }
  const baseline=await page.evaluate(()=>window.__golf.fleet());await page.waitForTimeout(200);
  const still=await page.evaluate(()=>window.__golf.fleet());
  // Camera entry smoothing may finish while reduced-motion silhouettes rest.
  still.boats.forEach((boat,i)=>{for(const key of ['x','y','width','height'])expect(Math.abs(boat[key]-baseline.boats[i][key])).toBeLessThan(.2);});
  await page.locator('[data-island="kish"]').click();await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready','kish');
  expect((await page.evaluate(()=>window.__golf.fleet())).visible).toBe(true);
  await page.locator('[data-island="hormuz"]').click();await page.locator('#play').click();
  await expect.poll(()=>page.evaluate(()=>window.__golf.fleet().visible)).toBe(false);await expect(page.locator('#strokes')).toHaveText('0');
 }
});
