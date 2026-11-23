import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:width===1440?900:844});await page.goto('http://127.0.0.1:4181/?qa');await page.locator('#play:enabled').waitFor();
  const brand=await page.locator('.brand-name').boundingBox(),slogan=await page.locator('.brand-slogan').boundingBox();
  assert.ok(brand.x+brand.width<=width);assert.ok(brand.y+brand.height<=slogan.y);
 }
 await page.locator('#creditsOpen').click();const about=await page.locator('.about-intro').innerText();assert.ok(!/preview|test|\bthree\b|\bholes\b/i.test(about));
 assert.equal(await page.locator('.game-version').innerText(),'Version 0.2.1');
 for(const href of ['https://github.com/itline','https://github.com/LCmaster/minigolf','https://science.nasa.gov/earth/earth-observatory/irans-rainbow-island-147428'])assert.equal(await page.locator(`#credits a[href="${href}"]`).count(),1);
 await page.locator('#creditsClose').click();await page.locator('#menuSound').click();assert.equal(await page.locator('#musicAuditions').count(),0);await page.locator('#audioClose').click();
 await page.locator('[data-island="qeshm"]').click();await page.waitForFunction(()=>document.querySelector('#menu').dataset.previewReady==='qeshm');await page.waitForTimeout(1000);
 assert.equal((await page.evaluate(()=>window.__golf.fleet())).details.length,2);
 for(const file of ['public/icon.png','public/favicon.png',...['hormuz','qeshm','kish-hengam'].map(id=>`marketing/${id}-cover-16x9.png`)]){const data=fs.readFileSync(file);assert.equal(data.subarray(1,4).toString(),'PNG');if(file.startsWith('marketing')){assert.equal(data.readUInt32BE(16),1920);assert.equal(data.readUInt32BE(20),1080);}}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({brandWidths:[320,390,768,1440],aboutVersion:'0.2.1',creditLinks:3,marketingPngs:3,coverDimensions:'1920x1080',sceneModeRocklets:2,pageErrors:errors}));
}finally{await browser.close();}
