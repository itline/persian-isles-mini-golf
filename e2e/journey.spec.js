import {test,expect} from '@playwright/test';
async function shot(page,x,z,power){
 const s=await page.evaluate(()=>window.__golf.state());const desired=Math.atan2(x-s.ball.x,-(z-s.ball.z));
 await page.locator('#scene').focus();let delta=desired-s.angle;while(delta>Math.PI)delta-=Math.PI*2;while(delta< -Math.PI)delta+=Math.PI*2;
 for(let i=0;i<Math.round(Math.abs(delta)/.055);i++)await page.keyboard.press(delta>0?'ArrowRight':'ArrowLeft');
 await page.locator('#power').evaluate((el,p)=>{el.value=String(p);el.dispatchEvent(new Event('input',{bubbles:true}));},power);
 await page.locator('#scene').focus();await page.keyboard.press('Space');await page.waitForTimeout(700);
 await page.waitForFunction(()=>['aiming','in_hole'].includes(window.__golf.state().phase),null,{timeout:25000});
}
test('all three holes complete by actual inputs; journey postcard totals and records persist',async({page})=>{
 test.setTimeout(140000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4181/?qa');await page.locator('#play').click();await page.waitForTimeout(700);
 await shot(page,-6.1,-.8,74);await expect(page.locator('#resultStrokes')).toHaveText('1');
 await page.locator('#resultNext').click();await expect(page.locator('#levelName')).toHaveText('Salt Valley');
 await expect(page.locator('#best')).toHaveText('—');
 await shot(page,-6.1,-4.2,83);await shot(page,2.9,-4.2,77);await expect(page.locator('#resultStrokes')).toHaveText('2');
 await page.locator('#resultNext').click();await expect(page.locator('#levelName')).toHaveText('Rainbow Run');
 await expect(page.locator('#best')).toHaveText('—');
 await shot(page,-6.1,-4.2,88);await shot(page,-3,-4.2,47);await shot(page,6,-4.2,78);await shot(page,6,5.4,82);
 await expect(page.locator('#resultStrokes')).toHaveText('4');
 await page.getByRole('button',{name:'See journey results'}).click();
 await expect(page.getByRole('heading',{name:'Your Hormuz postcard.'})).toBeVisible();
 await expect(page.locator('#resultStrokes')).toHaveText('7');await expect(page.locator('#journeyResults>div')).toHaveCount(3);
 expect(await page.evaluate(()=>window.__golf.state().journey)).toEqual([1,2,4]);
 await page.getByRole('button',{name:'Play the journey again'}).click();await expect(page.locator('#strokes')).toHaveText('0');await expect(page.locator('#best')).toHaveText('1');
 await page.reload();await page.locator('[data-level="2"]').click();await expect(page.locator('#best')).toHaveText('2');
 expect(errors).toEqual([]);
});

test('music and effects are opt-in, independent and persistent',async({page})=>{
 await page.goto('http://127.0.0.1:4181/?qa');await page.waitForFunction(()=>window.__golf);
 let audio=await page.evaluate(()=>window.__golf.state().audio);expect(audio.music).toBe(false);expect(audio.effects).toBe(false);expect(audio.unlocked).toBe(false);
 await page.locator('#menuSound').click();await page.locator('#musicToggle').check();await page.locator('#audioClose').click();
 await page.waitForFunction(()=>window.__golf.state().audio.playing);
 audio=await page.evaluate(()=>window.__golf.state().audio);expect(audio.effects).toBe(false);expect(audio.contextState).toBe('running');
 await page.locator('[data-island="kish"]').click();await page.waitForFunction(()=>window.__golf.state().preview==='kish');
 expect((await page.evaluate(()=>window.__golf.state().audio)).island).toBe('kish');
 await page.reload();await page.waitForFunction(()=>window.__golf);audio=await page.evaluate(()=>window.__golf.state().audio);expect(audio.music).toBe(true);expect(audio.effects).toBe(false);expect(audio.unlocked).toBe(false);
 await page.locator('#play').click();await page.waitForFunction(()=>window.__golf.state().audio.playing);
 await page.locator('#pause').click();expect((await page.evaluate(()=>window.__golf.state().audio)).playing).toBe(false);
 await page.locator('#resume').click();await page.waitForFunction(()=>window.__golf.state().audio.playing);
});

test('mobile pinch zoom never fires a shot; single-touch dragging still does',async({browser})=>{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true});const page=await context.newPage();
 await page.goto('http://127.0.0.1:4181/?qa');await page.locator('[data-level="1"]').tap();
 const cdp=await context.newCDPSession(page);const points=(a,b)=>[{x:a,y:160,id:1},{x:b,y:160,id:2}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(350,450)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(310,490)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(900);
 expect((await page.evaluate(()=>window.__golf.state())).zoom).toBeGreaterThan(1.2);await expect(page.locator('#strokes')).toHaveText('0');
 await page.locator('#overview').tap();await page.waitForTimeout(800);expect((await page.evaluate(()=>window.__golf.state())).zoom).toBeCloseTo(1,1);
 await context.close();
});
