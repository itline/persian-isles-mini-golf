import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4181/?qa');await page.waitForFunction(()=>window.__golf);
await page.locator('#play').click();await page.waitForTimeout(700);
async function shot(x,z,power){
 const s=await page.evaluate(()=>window.__golf.state());const desired=Math.atan2(x-s.ball.x,-(z-s.ball.z));
 await page.locator('#scene').focus();let delta=desired-s.angle;while(delta>Math.PI)delta-=Math.PI*2;while(delta< -Math.PI)delta+=Math.PI*2;
 for(let i=0;i<Math.round(Math.abs(delta)/.055);i++)await page.keyboard.press(delta>0?'ArrowRight':'ArrowLeft');
 await page.locator('#power').evaluate((el,p)=>{el.value=String(p);el.dispatchEvent(new Event('input',{bubbles:true}));},power);
 await page.locator('#scene').focus();await page.keyboard.press('Space');await page.waitForTimeout(700);
 await page.waitForFunction(()=>['aiming','in_hole'].includes(window.__golf.state().phase),null,{timeout:25000});
 console.log(JSON.stringify(await page.evaluate(()=>window.__golf.state())));
}
await shot(-6.1,-.8,74);await page.locator('#resultNext').click();await page.waitForTimeout(700);
await shot(-6.1,-4.2,83);await shot(2.9,-4.2,77);
await page.screenshot({path:'collection-probe.png'});
console.log({errors});await browser.close();
