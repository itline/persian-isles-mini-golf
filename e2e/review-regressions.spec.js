import {test,expect} from '@playwright/test';
const url='http://127.0.0.1:4181/?qa';
test('primary action text has at least 4.5 to 1 contrast',async({page})=>{
 await page.goto(url);await expect(page.locator('#play')).toBeEnabled();
 const ratio=await page.locator('#play').evaluate(el=>{
  const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  const style=getComputedStyle(el),a=luminance(style.color),b=luminance(style.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 });expect(ratio).toBeGreaterThanOrEqual(4.5);
});
test('tablet portrait keeps every diorama above the selector',async({page})=>{
 await page.setViewportSize({width:768,height:1024});await page.goto(url);await page.waitForFunction(()=>window.__golf);
 for(const id of ['hormuz','qeshm','kish','khark','hengam']){
  await page.locator(`[data-island="${id}"]`).click();await expect(page.locator('#menu')).toHaveAttribute('data-preview-ready',id);await page.waitForTimeout(1100);
  const points=await page.evaluate(()=>window.__golf.islandCorners()),panel=await page.locator('.hero-copy').boundingBox();
  expect(Math.max(...points.map(p=>p.y))).toBeLessThan(panel.y);
  expect(Math.min(...points.map(p=>p.y))).toBeGreaterThan(35);
 }
});
test('landscape camera controls remain separate from direct sound and pause without firing a shot',async({browser})=>{
 const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const page=await context.newPage();
 await page.goto(url);await page.locator('#play').tap();
 await expect(page.locator('#manualToggle, #manualControls, #manualClose, .shot-controls')).toHaveCount(0);
 await expect(page.locator('#gameMenuToggle, #gameTools')).toHaveCount(0);
 await page.locator('#zoomIn').tap();await expect.poll(()=>page.evaluate(()=>window.__golf.state().targetZoom)).toBeGreaterThan(1);
 await page.locator('#overview').tap();await expect.poll(()=>page.evaluate(()=>window.__golf.state().targetZoom)).toBe(1);await expect(page.locator('#strokes')).toHaveText('0');
 for(const id of ['sound','pause'])await expect(page.locator(`.game-navigation #${id}`)).toBeVisible();
 await page.locator('#sound').tap();await expect(page.locator('#audioPanel')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#audioPanel')).toBeHidden();
 for(const id of ['zoomOut','zoomIn','overview'])await expect(page.locator(`#game > .zoom-controls #${id}`)).toBeVisible();
 await page.locator('#pause').tap();await expect(page.locator('#pausePanel')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#pausePanel')).toBeHidden();
 await expect(page.locator('#strokes')).toHaveText('0');
 await context.close();
});
