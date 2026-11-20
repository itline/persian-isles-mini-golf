import {test,expect} from '@playwright/test';

test('landscape touch controls have usable hit targets',async({browser})=>{
 const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:4181/');
 await page.locator('#play').tap();
 for(const [toggle,selectors] of [['#manualToggle',['#aimLeft','#aimRight','#putt','#restartQuick']],['#gameMenuToggle',['#pause','#helpOpen','#sound','#zoomIn','#zoomOut','#overview']]]){
  await page.locator(toggle).tap();
  for(const selector of selectors){
   const box=await page.locator(selector).boundingBox();
   expect(box,`${selector} is visible`).not.toBeNull();
   expect(box.width,`${selector} width`).toBeGreaterThanOrEqual(44);
   expect(box.height,`${selector} height`).toBeGreaterThanOrEqual(44);
  }
 }
 await context.close();
});
