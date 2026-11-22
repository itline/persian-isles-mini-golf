import {chromium} from '@playwright/test';
const b=await chromium.launch({channel:'chrome',headless:true});const page=await b.newPage({viewport:{width:1440,height:900}});await page.goto('http://127.0.0.1:4181/?qa');await page.locator('[data-level="3"]').click();await page.waitForTimeout(900);
async function aim(x,z,power){const s=await page.evaluate(()=>window.__golf.state());const desired=Math.atan2(x-s.ball.x,-(z-s.ball.z));await page.locator('#scene').focus();let delta=desired-s.angle;while(delta>Math.PI)delta-=Math.PI*2;while(delta< -Math.PI)delta+=Math.PI*2;for(let i=0;i<Math.round(Math.abs(delta)/.055);i++)await page.keyboard.press(delta>0?'ArrowRight':'ArrowLeft');for(let i=0;i<Math.round(Math.abs(power/100-s.power)/.025);i++)await page.keyboard.press(power/100>s.power?'ArrowUp':'ArrowDown');await page.locator('#scene').focus();await page.keyboard.press('Space');await page.waitForTimeout(700);await page.waitForFunction(()=>['aiming','in_hole'].includes(window.__golf.state().phase),null,{timeout:20000});console.log(await page.evaluate(()=>window.__golf.state()));}
await aim(-6.1,-4.2,88);
await aim(-3,-4.2,47);
await aim(6,-4.2,78);
await aim(6,5.4,82);
await page.screenshot({path:'round-progress.png'});await b.close();
