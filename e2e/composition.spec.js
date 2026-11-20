import {test,expect} from '@playwright/test';
const url='http://127.0.0.1:4181/';
test('default sound waits for a trusted island gesture; settings alone stays locked',async({page})=>{
 await page.goto(url+'?qa');await page.waitForFunction(()=>window.__golf);
 expect(await page.evaluate(()=>window.__golf.state().audio)).toMatchObject({music:true,effects:true,unlocked:false});
 await page.locator('#menuSound').click();expect(await page.evaluate(()=>window.__golf.state().audio)).toMatchObject({unlocked:false,contextState:'locked'});
 await page.locator('#audioClose').click();await page.locator('[data-island="kish"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__golf.state().audio)).toMatchObject({unlocked:true,contextState:'running'});
});
test('manual controls start collapsed while keyboard gameplay remains available',async({page})=>{
 await page.goto(url+'?qa');await page.locator('#play').click();
 await expect(page.locator('#manualToggle')).toHaveAttribute('aria-expanded','false');
 await expect(page.locator('#manualToggle')).toHaveAttribute('aria-controls','manualControls');
 await expect(page.locator('#manualControls')).toBeHidden();
 await page.locator('#scene').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');
 await expect(page.locator('#strokes')).toHaveText('1');
 await page.locator('#manualToggle').click();await expect(page.locator('#manualControls')).toBeVisible();
 await page.locator('#manualClose').click();await expect(page.locator('#manualControls')).toBeHidden();
});
test('mobile single tools drawer closes before Escape pause and never fires shots',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
 await page.goto(url+'?qa');await page.locator('#play').tap();
 await expect(page.locator('#gameMenuToggle')).toHaveAttribute('aria-expanded','false');await expect(page.locator('#gameTools')).toBeHidden();
 for(const id of ['pause','helpOpen','sound','zoomIn','zoomOut','overview'])await expect(page.locator(`#gameTools #${id}`)).toHaveCount(1);
 await page.locator('#gameMenuToggle').tap();await expect(page.locator('#gameTools')).toBeVisible();
 await page.locator('#zoomIn').tap();await expect(page.locator('#gameTools')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('#gameTools')).toBeHidden();await expect(page.locator('#pausePanel')).toBeHidden();
 await page.keyboard.press('Escape');await expect(page.locator('#pausePanel')).toBeVisible();await page.locator('#resume').tap();
 for(const [control,panel,close] of [['helpOpen','helpPanel','helpClose'],['sound','audioPanel','audioClose'],['pause','pausePanel','resume']]){
  await page.locator('#gameMenuToggle').tap();await page.locator('#'+control).tap();await expect(page.locator('#gameTools')).toBeHidden();await expect(page.locator('#'+panel)).toBeVisible();await page.locator('#'+close).tap();
 }
 await page.locator('#gameMenuToggle').tap();await page.locator('#scene').focus();await expect(page.locator('#gameTools')).toBeHidden();
 await page.locator('#gameMenuToggle').tap();await page.mouse.click(200,370);await expect(page.locator('#gameTools')).toBeHidden();await expect(page.locator('#strokes')).toHaveText('0');
 await page.locator('#gameMenuToggle').tap();await page.setViewportSize({width:1200,height:1400});await expect(page.locator('#gameMenuToggle')).toBeHidden();await expect(page.locator('#pause')).toBeVisible();await expect(page.locator('#gameMenuToggle')).toHaveAttribute('aria-expanded','false');
 await context.close();
});
test('visible preview readiness follows the latest rendered selection without ordinary notices',async({page})=>{
 await page.goto(url);
 await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready','hormuz');
 await expect(page.locator('#islandAvailability')).toHaveAttribute('role','status');
 await expect(page.locator('#islandAvailability')).toBeHidden();
 for(const id of ['qeshm','kish','khark','hengam','hormuz']){
  await page.locator(`[data-island="${id}"]`).click();
  await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready',id);
  await expect(page.locator('#islandAvailability')).toBeHidden();
  if(id!=='hormuz'){await expect(page.locator('#play')).toHaveText('Preview only');await expect(page.locator('#play')).toBeDisabled();}
 }
 await expect(page.getByText('3 open holes · 7 more in development',{exact:true})).toHaveCount(0);
 await page.locator('#creditsOpen').click();await expect(page.getByRole('link',{name:'itline',exact:true})).toHaveAttribute('href','https://github.com/itline');
 await expect(page.locator('#credits')).toContainText('Mini Golf Mania');
 expect(await page.evaluate(()=>window.__golf)).toBeUndefined();
});
test('menu diorama moves coherently then restores before real gameplay and pause',async({page})=>{
 await page.goto(url+'?qa');await page.waitForFunction(()=>window.__golf);await page.waitForTimeout(300);
 const a=await page.evaluate(()=>window.__golf.state());await page.waitForTimeout(450);const b=await page.evaluate(()=>window.__golf.state());
 expect(b.menuMotion.y).not.toBe(a.menuMotion.y);expect(b.ball).toEqual(a.ball);
 await page.locator('#play').click();expect((await page.evaluate(()=>window.__golf.state())).menuMotion).toEqual({y:0,yaw:0});
 await page.locator('#pause').click();await page.waitForTimeout(100);const paused=await page.evaluate(()=>window.__golf.state());await page.waitForTimeout(200);expect((await page.evaluate(()=>window.__golf.state())).sceneryTime).toBe(paused.sceneryTime);
 await page.locator('#backHome').click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);expect((await page.evaluate(()=>window.__golf.state())).menuMotion).toEqual({y:0,yaw:0});
});
test('portrait menu reserves upper scene and fits all five projected dioramas above selector',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();await page.goto(url+'?qa');
 for(const id of ['hormuz','qeshm','kish','khark','hengam']){
  await page.locator(`[data-island="${id}"]`).tap();await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready',id);await page.waitForTimeout(900);
  const points=await page.evaluate(()=>window.__golf.islandCorners());const panel=await page.locator('.hero-copy').boundingBox();
  expect(Math.min(...points.map(p=>p.x))).toBeGreaterThan(0);expect(Math.max(...points.map(p=>p.x))).toBeLessThan(390);
  expect(Math.min(...points.map(p=>p.y))).toBeGreaterThan(35);expect(Math.max(...points.map(p=>p.y))).toBeLessThan(panel.y);
  expect(panel.y).toBeGreaterThan(844*.4);expect(panel.height).toBeLessThanOrEqual(844*.51);
 }
 await context.close();
});
