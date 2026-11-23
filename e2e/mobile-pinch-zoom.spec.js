import {test,expect} from '@playwright/test';

test('mobile pinch shares the button zoom limits without shooting',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
 await page.goto('http://127.0.0.1:4181/?qa');await page.locator('#play:enabled').waitFor();await page.locator('[data-level="9"]').tap();
 await expect(page.locator('#overview')).toHaveAccessibleName('Return to ball');
 const cdp=await context.newCDPSession(page);
 const points=spread=>[{id:1,x:195-spread/2,y:350},{id:2,x:195+spread/2,y:350}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(280)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(30)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(page.locator('#zoomOut')).toBeDisabled();
 await expect.poll(()=>page.evaluate(()=>{const b=window.__golf.courseBounds();return b.left>=20&&b.right<=innerWidth-20})).toBe(true);
 await page.locator('#overview').tap();await expect.poll(()=>page.evaluate(()=>window.__golf.state().zoom)).toBe(1);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(40)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(280)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(page.locator('#zoomIn')).toBeDisabled();await expect(page.locator('#strokes')).toHaveText('0');
 await context.close();
});
