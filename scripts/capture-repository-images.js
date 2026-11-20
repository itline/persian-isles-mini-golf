import {chromium} from '@playwright/test';
import {mkdir,copyFile} from 'node:fs/promises';
const out=new URL('../docs/images/',import.meta.url);await mkdir(out,{recursive:true});
await copyFile(new URL('../marketing/hormuz-cover-16x9.png',import.meta.url),new URL('hormuz-cover.png',out));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4181/');await page.locator('#play:enabled').waitFor();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(1200);
  if(name==='desktop')await page.screenshot({path:new URL('island-menu.png',out).pathname});
  await page.locator('[data-level="1"]').click();await page.locator('#strokes').waitFor();await page.waitForTimeout(1600);
  await page.screenshot({path:new URL(`gameplay-${name}.png`,out).pathname});if(errors.length)throw Error(errors.join('\n'));await page.close();
 }
 console.log('Repository images captured from real menu and gameplay: 4 PNGs.');
}finally{await browser.close();}
