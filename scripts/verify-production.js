import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.GOLF_URL||'http://127.0.0.1:4182';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base+'/')&&!r.url().startsWith('data:'))external.push(r.url());});
 await page.goto(base+'/?qa');await page.waitForFunction(()=>window.__golf);
 for(const id of ['qeshm','kish','khark','hengam','hormuz']){await page.locator(`[data-island="${id}"]`).click();await page.waitForFunction(id=>window.__golf.state().preview===id,id);}
 await page.locator('[data-level="2"]').click();await page.locator('#scene').focus();await page.keyboard.press('Space');
 assert.equal(await page.locator('#strokes').innerText(),'1');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 const response=await page.request.get(base+'/THIRD_PARTY_NOTICES.txt');assert.equal(response.status(),200);
 console.log(JSON.stringify({production:true,previewSwitches:5,level:2,shot:true,pageErrors:errors,externalRequests:external,notices:response.status()}));
}finally{await browser.close();}
