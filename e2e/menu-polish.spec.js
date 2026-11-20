import {test,expect} from '@playwright/test';
const url='http://127.0.0.1:4181/?qa';
async function swipe(page,from,to){
 const client=await page.context().newCDPSession(page);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y,id:1}]});
 for(let i=1;i<=10;i++){
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/10,y:from.y+(to.y-from.y)*i/10,id:1}]});
  await page.waitForTimeout(20);
 }
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();
}
test('primary action remains separated from island tabs across viewports and previews',async({page})=>{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:768,height:1024},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.goto(url);await expect(page.locator('#play')).toBeEnabled();
  for(const id of ['hormuz','kish']){
   await page.locator(`[data-island="${id}"]`).click();await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready',id);
   const a=await page.locator('.island-switcher').boundingBox(),b=await page.locator('#play').boundingBox();
   expect(b.y-a.y-a.height).toBeGreaterThanOrEqual(14);
  }
 }
});
test('game brand is prominent while selection heading is secondary and action uses play icon',async({page})=>{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:768,height:1024}]){
  await page.setViewportSize(viewport);await page.goto(url);await expect(page.locator('#play')).toBeEnabled();
  const typography=await page.evaluate(()=>({brand:parseFloat(getComputedStyle(document.querySelector('.brand-name')).fontSize),heading:parseFloat(getComputedStyle(document.querySelector('.hero-copy h1')).fontSize)}));
  expect(typography.brand).toBeGreaterThanOrEqual(viewport.width===390?23:26);expect(typography.heading).toBeLessThanOrEqual(viewport.width===1440?32:28);
  await expect(page.locator('#play .play-icon')).toHaveCount(1);await expect(page.locator('#play')).not.toContainText('↗');
  const title=await page.locator('.brand').boundingBox();expect(title.x+title.width).toBeLessThanOrEqual(viewport.width);
 }
});
test('manual controls close using just a small cross and restart labels are short',async({page})=>{
 await page.goto(url);await page.locator('#play').click();await page.locator('#manualToggle').click();
 await expect(page.locator('#manualToggle')).toBeHidden();await expect(page.getByRole('button',{name:'Close manual controls',exact:true})).toBeVisible();
 await expect(page.locator('#restartQuick')).toHaveAccessibleName('Restart');await expect(page.locator('#restart')).toHaveText('Restart');
 await page.getByRole('button',{name:'Close manual controls',exact:true}).click();await expect(page.locator('#manualControls')).toBeHidden();
 await expect(page.locator('#manualToggle')).toBeVisible();await expect(page.locator('#manualToggle')).toBeFocused();
 await expect(page.locator('#strokes')).toHaveText('0');
});
for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1280,height:800}])test(`real touch swipe cycles on scene and selector without hijacking vertical scrolling ${viewport.width}`,async({browser})=>{
 const context=await browser.newContext({viewport,hasTouch:true,isMobile:viewport.width<800});const page=await context.newPage();
 await page.goto(url);await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready','hormuz');
 // First swipe over the 3D scene, then back across non-interactive panel text.
 const sceneY=viewport.width<800?200:210;
 await swipe(page,{x:viewport.width-65,y:sceneY},{x:viewport.width-230,y:sceneY+6});
 await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready','qeshm');
 const name=await page.locator('#selectedIslandName').boundingBox(),y=name.y+name.height/2;
 await swipe(page,{x:name.x+15,y},{x:name.x+155,y:y+4});await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready','hormuz');
 const panel=await page.locator('.hero-copy').boundingBox();
 await swipe(page,{x:panel.x+panel.width/2,y:panel.y+150},{x:panel.x+panel.width/2+5,y:panel.y+65});
 await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready','hormuz');
 await expect(page.locator('#game')).toBeHidden();
 await page.waitForTimeout(400);await page.locator('[data-island="hormuz"]').tap();
 await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready','hormuz');
 // Cancelled multi-touch must never be interpreted as a next-island swipe.
 const client=await context.newCDPSession(page),x=viewport.width-130;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:sceneY,id:1}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:sceneY,id:1},{x:x+45,y:sceneY+35,id:2}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-100,y:sceneY,id:1},{x:x+45,y:sceneY+70,id:2}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();
 await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready','hormuz');await context.close();
});
