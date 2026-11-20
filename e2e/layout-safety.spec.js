import {test,expect} from '@playwright/test';

test('landscape menu scroll exposes every hole; clean preview mode returns to selection',async({browser})=>{
 const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const page=await context.newPage();
 await page.goto('http://127.0.0.1:4181/?qa');await page.waitForFunction(()=>window.__golf);
 await page.locator('.hero-copy').evaluate(el=>el.scrollTop=el.scrollHeight);
 await expect(page.locator('[data-level="10"]')).toBeInViewport();
 await page.locator('[data-level="3"]').tap();await expect(page.locator('#levelName')).toHaveText('Rainbow Run');
 await page.locator('#gameMenuToggle').tap();await page.locator('#pause').tap();await page.locator('#backHome').tap();
 await page.locator('#sceneryToggle').tap();await expect(page.locator('#menu')).toHaveClass(/scenery-only/);
 await page.locator('#sceneryToggle').tap();await expect(page.locator('#menu')).not.toHaveClass(/scenery-only/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await context.close();
});

test('zoom keeps the real ball clear of HUD and freezes camera during a shot drag',async({browser})=>{
 const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const page=await context.newPage();
 await page.goto('http://127.0.0.1:4181/?qa');await page.locator('[data-level="3"]').tap();
 await page.mouse.move(430,150);for(let i=0;i<12;i++)await page.mouse.wheel(0,-160);await page.waitForTimeout(1400);
 let position=await page.evaluate(()=>{const s=window.__golf.state();return window.__golf.project(s.ball.x,s.ball.z);});
 expect(position.x).toBeGreaterThan(20);expect(position.x).toBeLessThan(824);expect(position.y).toBeGreaterThan(20);expect(position.y).toBeLessThan(370);
 for(const selector of ['.hud','.shot-controls','.zoom-controls','.topbar .game-title']){
  const box=await page.locator(selector).boundingBox();if(box)expect(position.x>box.x&&position.x<box.x+box.width&&position.y>box.y&&position.y<box.y+box.height,`ball not under ${selector}`).toBe(false);
 }
 await page.mouse.move(position.x,position.y);await page.mouse.down();await page.waitForTimeout(800);
 const still=await page.evaluate(()=>{const s=window.__golf.state();return window.__golf.project(s.ball.x,s.ball.z);});
 expect(Math.abs(still.x-position.x)).toBeLessThan(1);expect(Math.abs(still.y-position.y)).toBeLessThan(1);
 await page.locator('#scene').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();await expect(page.locator('#strokes')).toHaveText('0');await context.close();
});
