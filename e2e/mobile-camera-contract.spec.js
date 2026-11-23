import {test,expect} from '@playwright/test';

test('wide portrait phones can zoom out to center the complete first hole',async({browser})=>{
 const context=await browser.newContext({viewport:{width:430,height:932},isMobile:true,hasTouch:true});
 try{
  const page=await context.newPage();await page.goto('http://127.0.0.1:4181/?qa');await page.locator('#play:enabled').waitFor();await page.locator('[data-level="1"]').tap();
  await expect(page.locator('#zoomOut')).toBeEnabled();
  for(let i=0;i<12&&await page.locator('#zoomOut').isEnabled();i++){
   await page.locator('#zoomOut').tap();
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  }
  await expect(page.locator('#zoomOut')).toBeDisabled();
  await expect.poll(()=>page.evaluate(()=>{const b=window.__golf.courseBounds();return b.left>=20&&b.right<=innerWidth-20&&b.top>=80&&b.bottom<=innerHeight-70&&Math.abs((b.left+b.right)/2-innerWidth/2)<5})).toBe(true);
  await expect(page.locator('#strokes')).toHaveText('0');
 }finally{await context.close();}
});

test('a new practice hole resets zoom instead of preserving the previous framing',async({browser})=>{
 const context=await browser.newContext({viewport:{width:430,height:932},isMobile:true,hasTouch:true});
 try{
  const page=await context.newPage();await page.goto('http://127.0.0.1:4181/?qa');await page.locator('#play:enabled').waitFor();
  await page.locator('[data-level="1"]').tap();await expect(page.locator('#overview')).toHaveAccessibleName('Return to ball');
  await page.locator('#pause').tap();await page.locator('#backHome').tap();
  await page.locator('[data-level="9"]').tap();
  await expect.poll(()=>page.evaluate(()=>window.__golf.state().targetZoom)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.__golf.state().zoom)).toBe(1);
 }finally{await context.close();}
});

test('held shot disables camera controls without changing its frozen projection',async({browser})=>{
 const context=await browser.newContext({viewport:{width:430,height:932},isMobile:true,hasTouch:true});
 try{
  const page=await context.newPage();await page.goto('http://127.0.0.1:4181/?qa');await page.locator('#play:enabled').waitFor();await page.locator('[data-level="1"]').tap();
  await expect(page.locator('#zoomOut')).toBeEnabled();
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:215,y:400}]});
  await expect.poll(()=>page.evaluate(()=>window.__golf.state().cameraFrozen)).toBe(true);
  const before=await page.evaluate(()=>window.__golf.project(0,0));
  for(const id of ['zoomOut','zoomIn','overview'])await expect(page.locator('#'+id)).toBeDisabled();
  expect(await page.evaluate(()=>window.__golf.project(0,0))).toEqual(before);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  for(const id of ['zoomOut','zoomIn','overview'])await expect(page.locator('#'+id)).toBeEnabled();
  await expect(page.locator('#strokes')).toHaveText('0');
 }finally{await context.close();}
});

test('mobile camera uses one zoom range and a repeatable return-to-ball action',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();await page.goto('http://127.0.0.1:4181/?qa');await page.locator('#play:enabled').waitFor();await page.locator('[data-level="9"]').tap();
 const reset=page.locator('#overview');await expect(reset).toHaveAccessibleName('Return to ball');
 for(let i=0;i<12&&await page.locator('#zoomOut').isEnabled();i++){
  await page.locator('#zoomOut').tap();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 }
 await expect(page.locator('#zoomOut')).toBeDisabled();
 await expect.poll(()=>page.evaluate(()=>{const b=window.__golf.courseBounds();return b.left>=20&&b.right<=innerWidth-20})).toBe(true);
 await reset.tap();await expect.poll(()=>page.evaluate(()=>window.__golf.state().zoom)).toBe(1);
 await reset.tap();await expect.poll(()=>page.evaluate(()=>window.__golf.state().zoom)).toBe(1);
 await expect(reset).toHaveAccessibleName('Return to ball');await expect(reset).not.toHaveAttribute('aria-pressed');
 for(let i=0;i<12&&await page.locator('#zoomIn').isEnabled();i++){
  await page.locator('#zoomIn').tap();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 }
 await expect(page.locator('#zoomIn')).toBeDisabled();
 await reset.tap();await expect.poll(()=>page.evaluate(()=>window.__golf.state().zoom)).toBe(1);
 await expect(page.locator('#zoomIn')).toBeEnabled();await expect(page.locator('#zoomOut')).toBeEnabled();
 await expect(page.locator('#strokes')).toHaveText('0');
 await context.close();
});
