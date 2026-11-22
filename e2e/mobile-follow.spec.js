import { test, expect } from '@playwright/test';
import { shot } from './helpers/shot.js';

for (const viewport of [{width:390,height:844},{width:844,height:390}]) {
  for (const level of [1,2,3,4,5,6,7,8,9]) {
    test(`hole ${level} ball is readable at the same follow scale ${viewport.width}x${viewport.height}`, async ({browser}) => {
      const context = await browser.newContext({viewport,isMobile:true,hasTouch:true});
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:4181/?qa');
      const sizes=[];
      // Each hole gets its own normal test budget. Compare against the same
      // original tee instead of putting nine camera transitions in one test.
      for (const id of [...new Set([1,level])]) {
        await page.locator(`[data-level="${id}"]`).tap();
        await expect.poll(()=>page.evaluate(()=>{
          const s=window.__golf.state(), b=window.__golf.project(s.ball.x,s.ball.z);
          return Math.abs(b.x-innerWidth/2)<15 && Math.abs(b.y-innerHeight/2)<20;
        })).toBe(true);
        const diameter=await page.evaluate(()=>{
          const s=window.__golf.state(),a=window.__golf.project(s.ball.x,s.ball.z),b=window.__golf.project(s.ball.x+.29,s.ball.z);
          return Math.hypot(a.x-b.x,a.y-b.y);
        });
        expect(diameter).toBeGreaterThan(6);
        sizes.push(diameter);
        await page.locator('#pause').tap();await page.locator('#backHome').tap();
      }
      // 2% versus the common baseline bounds any pair below the old 5% limit.
      expect(Math.max(...sizes)/Math.min(...sizes)).toBeLessThan(1.02);
      await context.close();
    });
  }
}

test('phone camera follows an actual shot and stays still while aiming', async ({browser}) => {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:4181/?qa');
  await page.locator('[data-level="3"]').tap();
  await shot(page,-6.1,-4.2,88);
  await expect.poll(()=>page.evaluate(()=>{
    const s=window.__golf.state(), b=window.__golf.project(s.ball.x,s.ball.z);
    return Math.abs(b.x-innerWidth/2)<15 && Math.abs(b.y-innerHeight/2)<20;
  })).toBe(true);
  const points=await page.evaluate(()=>{
    const s=window.__golf.state();
    return {start:window.__golf.project(s.ball.x,s.ball.z),end:window.__golf.project(s.ball.x,s.ball.z+1)};
  });
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points.start]});
  const before=await page.evaluate(()=>window.__golf.project(0,0));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[points.end]});
  const after=await page.evaluate(()=>window.__golf.project(0,0));
  expect(after).toEqual(before);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('#strokes')).toHaveText('2');
  await context.close();
});
