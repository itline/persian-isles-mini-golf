import {chromium} from '@playwright/test';
import fs from 'node:fs';
const out='/Users/hasan/.hermes/cache/scratch/golf-menu-polish';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
for(const [name,width,height]of [['desktop',1440,900],['portrait',390,844],['tablet',768,1024],['landscape',844,390]]){
 const context=await browser.newContext({viewport:{width,height},hasTouch:name!=='desktop',isMobile:name==='portrait'||name==='landscape'});const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4181/?qa');await page.waitForFunction(()=>window.__golf);await page.emulateMedia({reducedMotion:'reduce'});
 for(const id of ['hormuz','qeshm','kish']){await page.locator(`[data-island="${id}"]`).click();await page.waitForFunction(id=>document.querySelector('#menu').dataset.previewReady===id,id);await page.waitForTimeout(500);await page.screenshot({path:`${out}/${name}-${id}.png`});}
 await page.locator('[data-island="hormuz"]').click();await page.locator('#play').click();await page.locator('#manualToggle').click();await page.waitForTimeout(500);await page.screenshot({path:`${out}/${name}-manual.png`});
 results.push({name,errors,manual:await page.locator('#manualControls').boundingBox(),close:await page.locator('#manualClose').boundingBox(),restart:await page.locator('#restartQuick').boundingBox()});await context.close();
}
await browser.close();fs.writeFileSync(`${out}/layout.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({out,results},null,2));
