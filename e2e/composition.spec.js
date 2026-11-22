import {test,expect} from '@playwright/test';
const url='http://127.0.0.1:4181/';
test('default sound waits for a trusted island gesture; settings alone stays locked',async({page})=>{
 await page.goto(url+'?qa');await page.waitForFunction(()=>window.__golf);
 expect(await page.evaluate(()=>window.__golf.state().audio)).toMatchObject({music:true,effects:true,unlocked:false});
 await page.locator('#menuSound').click();expect(await page.evaluate(()=>window.__golf.state().audio)).toMatchObject({unlocked:false,contextState:'locked'});
 await page.locator('#audioClose').click();await page.locator('[data-island="kish"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__golf.state().audio)).toMatchObject({unlocked:true,contextState:'running'});
});
test('manual shot UI is absent while keyboard aim, power and putting remain available',async({page})=>{
 await page.goto(url+'?qa');await page.locator('#play').click();
 await expect(page.locator('#manualToggle, #manualControls, #manualClose, #power, #powerValue, #aimLeft, #aimRight, #putt, #restartQuick, .shot-controls')).toHaveCount(0);
 await expect(page.locator('#status')).toHaveClass(/sr-only/);
 await expect(page.locator('#status')).toHaveAttribute('aria-live','polite');
 await expect(page.locator('#status')).toHaveAttribute('data-phase','ready');
 const before=await page.evaluate(()=>window.__golf.state());
 await page.locator('#scene').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowUp');
 let after=await page.evaluate(()=>window.__golf.state());expect(after.angle).toBeCloseTo(before.angle+.055,8);expect(after.power).toBeCloseTo(before.power+.025,8);
 await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowDown');
 after=await page.evaluate(()=>window.__golf.state());expect(after.angle).toBeCloseTo(before.angle,8);expect(after.power).toBeCloseTo(before.power,8);
 await page.keyboard.press('Space');
 await expect(page.locator('#strokes')).toHaveText('1');
});
test('direct sound and pause controls survive rotation and Escape without firing shots',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
 await page.goto(url+'?qa');await page.locator('#play').tap();
 await expect(page.locator('#home, #gameMenuToggle, #gameTools, #helpOpen')).toHaveCount(0);
 for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1200,height:1400}]){
  await page.setViewportSize(viewport);
  await expect(page.locator('.game-navigation button')).toHaveCount(2);
  for(const id of ['sound','pause'])await expect(page.locator(`.game-navigation #${id}`)).toBeVisible();
  for(const id of ['zoomIn','zoomOut','overview'])await expect(page.locator(`#game > .zoom-controls #${id}`)).toBeVisible();
  await page.locator('#sound').tap();await expect(page.locator('#audioPanel')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#audioPanel')).toBeHidden();await expect(page.locator('#pausePanel')).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.__golf.state().paused)).toBe(false);
  await page.keyboard.press('Escape');await expect(page.locator('#pausePanel')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#pausePanel')).toBeHidden();
  for(const [control,panel,close] of [['sound','audioPanel','audioClose'],['pause','pausePanel','resume']]){
   await page.locator('#'+control).tap();await expect(page.locator('#'+panel)).toBeVisible();await page.locator('#'+close).tap();
  }
  await expect(page.locator('#strokes')).toHaveText('0');
  await expect.poll(()=>page.evaluate(()=>window.__golf.state().paused)).toBe(false);
 }
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
