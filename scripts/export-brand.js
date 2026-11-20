import {chromium} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const [file,size] of [['icon',512],['favicon',32]]){
  const svg=fs.readFileSync(`public/${file}.svg`,'utf8');const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
  await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`);
  await page.screenshot({path:`public/${file}.png`,omitBackground:true});await page.close();
 }
}finally{await browser.close();}
console.log('Exported brand PNG 512×512 and favicon PNG 32×32');
