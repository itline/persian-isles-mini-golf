import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>console.error(e));
await page.goto('http://127.0.0.1:4181/?qa');await page.waitForFunction(()=>window.__golf);await page.waitForTimeout(1300);
for(const id of ['hormuz','qeshm','kish','khark','hengam']){await page.locator(`[data-island="${id}"]`).click();await page.waitForFunction(id=>window.__golf.state().preview===id,id);await page.waitForTimeout(700);await page.screenshot({path:`preview-${id}.png`});}
await page.locator('[data-island="hormuz"]').click();await page.locator('[data-level="2"]').click();await page.waitForTimeout(1200);await page.screenshot({path:'level-two.png'});await page.mouse.move(700,250);await page.mouse.wheel(0,-160);await page.mouse.wheel(0,-160);await page.waitForTimeout(900);await page.screenshot({path:'controlled-zoom.png'});
const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const mobile=await context.newPage();await mobile.goto('http://127.0.0.1:4181/?qa');await mobile.waitForFunction(()=>window.__golf);await mobile.waitForTimeout(1000);await mobile.screenshot({path:'menu-mobile-landscape.png'});await mobile.locator('[data-level="3"]').tap();await mobile.waitForTimeout(1000);await mobile.screenshot({path:'game-mobile-landscape-v2.png'});
await mobile.setViewportSize({width:390,height:844});await mobile.reload();await mobile.waitForFunction(()=>window.__golf);await mobile.waitForTimeout(900);await mobile.screenshot({path:'menu-mobile-portrait.png'});
console.log('Five island previews, levels, zoom and mobile screenshots captured');await browser.close();
