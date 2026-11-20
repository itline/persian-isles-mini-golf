import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.GOLF_URL||'http://127.0.0.1:4182';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base+'/')&&!r.url().startsWith('data:'))external.push(r.url());});
 await page.goto(base+'/?qa');await page.locator('#play:enabled').waitFor();
 assert.equal(await page.evaluate(()=>typeof window.__golf),'undefined','Production must not expose QA state even with ?qa');
 assert.equal(await page.locator('html').getAttribute('lang'),'en');
 for(const id of ['qeshm','kish','khark','hengam','hormuz']){await page.locator(`[data-island="${id}"]`).click();await page.waitForFunction(id=>document.querySelector(`[data-island="${id}"]`).classList.contains('selected'),id);if(id!=='hormuz'){await page.locator('#play:disabled').waitFor();assert.equal(await page.locator('#islandAvailability').innerText(),'Coming soon · Preview only');}}
 await page.locator('[data-level="2"]').click();await page.locator('#scene').focus();await page.keyboard.press('Space');
 assert.equal(await page.locator('#strokes').innerText(),'1');
 for(const file of ['THIRD_PARTY_NOTICES.txt','DEPENDENCY_LICENSES.txt']){const response=await page.request.get(base+'/'+file);assert.equal(response.status(),200);assert.ok((await response.text()).length>100);}
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log(JSON.stringify({production:true,qaAbsent:true,previewSwitches:5,level:2,shot:true,pageErrors:errors,externalRequests:external,notices:200}));
}finally{await browser.close();}
