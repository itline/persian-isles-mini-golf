import { test, expect } from '@playwright/test';

for (const viewport of [{width:390,height:844},{width:844,height:390},{width:320,height:568}]) {
  test(`mobile minus reaches a centered full-course view at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({viewport,isMobile:true,hasTouch:true});
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4181/?qa');
    await page.locator('#play:enabled').waitFor();
    await page.locator('[data-level="9"]').tap();
    await expect(page.locator('#zoomOut')).toBeEnabled();
    for(let i=0;i<12&&await page.locator('#zoomOut').isEnabled();i++){
      await page.locator('#zoomOut').tap();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    }
    await expect.poll(()=>page.evaluate(()=>{
      const b=window.__golf.courseBounds();
      return b.left>=20 && b.right<=innerWidth-20 && b.top>=80 && b.bottom<=innerHeight-70;
    })).toBe(true);
    await expect(page.locator('#strokes')).toHaveText('0');
    const ballSizeBefore = await page.evaluate(()=>{
      const p=window.__golf.state().ball;const a=window.__golf.project(p.x,p.z),b=window.__golf.project(p.x+.29,p.z);
      return Math.hypot(a.x-b.x,a.y-b.y);
    });
    await expect(page.locator('#zoomIn')).toBeEnabled();
    for(let i=0;i<12&&await page.locator('#zoomIn').isEnabled();i++){
      await page.locator('#zoomIn').tap();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    }
    await expect.poll(()=>page.evaluate(()=>window.__golf.state().zoom)).toBe(1.85);
    const ballSizeAfter = await page.evaluate(()=>{
      const p=window.__golf.state().ball;const a=window.__golf.project(p.x,p.z),b=window.__golf.project(p.x+.29,p.z);
      return Math.hypot(a.x-b.x,a.y-b.y);
    });
    expect(ballSizeAfter).toBeGreaterThan(ballSizeBefore);
    await page.locator('#scene').focus();await page.keyboard.press('Space');
    await expect(page.locator('#strokes')).toHaveText('1');
    await context.close();
  });
}
