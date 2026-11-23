import {test,expect} from '@playwright/test';
const url=new URL('/?qa',process.env.GOLF_URL||'http://127.0.0.1:4181').href;
test('the coast stays English even with an older saved Persian preference',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('persian-isles-golf:language:v1','fa'));
 await page.goto(url);await expect(page.locator('#play')).toBeEnabled();
 await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('html')).toHaveAttribute('dir','ltr');
 await expect(page).toHaveTitle('Persian Isles Mini Golf');
 await expect(page.locator('.language-switch')).toHaveCount(0);
 await expect(page.locator('#selectedIslandName')).toHaveText('Hormuz');
 await page.locator('[data-level="1"]').click();await expect(page.locator('#levelName')).toHaveText('Red Shore');
 await page.keyboard.press('Space');await expect(page.locator('#strokes')).toHaveText('1');
 await page.locator('#pause').click();await expect(page.locator('#pauseTitle')).toHaveText('Take a breath.');
 await page.reload();await expect(page.locator('#selectedIslandName')).toHaveText('Hormuz');
});

test('compact course sketches omit scores; explicit camera controls clamp and never putt',async({page})=>{
 await page.goto(url);await page.waitForFunction(()=>window.__golf);
 await expect(page.locator('.level-button')).toHaveCount(9);await expect(page.locator('.level-button:visible:not(:disabled)')).toHaveCount(9);
 await expect(page.locator('.course-sketch')).toHaveCount(9);
 await expect(page.locator('#levelGrid')).not.toContainText(/Par|Best|Soon/i);
 for(const card of await page.locator('.level-button').all())await expect(card.locator('.course-sketch')).toHaveCount(1);
 const heights=await page.locator('.level-button').evaluateAll(cards=>cards.map(card=>card.getBoundingClientRect().height));
 for(const height of heights){expect(height).toBeGreaterThan(55);expect(height).toBeLessThan(130);}
 await page.locator('[data-level="1"]').click();
 await expect(page.locator('.game-title .course-context')).toHaveText('Hormuz · Hole 1');
 await expect(page.locator('.game-title .round-stats')).toHaveText('Strokes 0·Par 2');
 await expect(page.locator('.game-title')).not.toContainText(/Best/i);
 for(let i=0;i<6;i++)await page.locator('#zoomIn').click();
 await expect(page.locator('#zoomIn')).toBeDisabled();
 await expect.poll(()=>page.evaluate(()=>window.__golf.state().targetZoom)).toBe(1.85);
 await expect.poll(()=>page.evaluate(()=>window.__golf.state().zoom)).toBe(1.85);
 await page.keyboard.press('Space');await expect(page.locator('#strokes')).toHaveText('0');
 await page.locator('#overview').click();
 await expect.poll(()=>page.evaluate(()=>window.__golf.state().zoom)).toBe(1);
 await expect(page.locator('#zoomOut')).toBeDisabled();
 expect(await page.evaluate(()=>window.__golf.state().targetZoom)).toBe(1);
 await expect(page.locator('#strokes')).toHaveText('0');
 await page.locator('#scene').focus();await page.keyboard.press('Space');await expect(page.locator('#strokes')).toHaveText('1');
});

test('Explore uses an ivory folio and scenery freezes only for pause or hidden tabs',async({page})=>{
 await page.goto(url);await page.waitForFunction(()=>window.__golf);
 const rail=await page.locator('.hero-copy').evaluate(el=>({width:el.getBoundingClientRect().width,bg:getComputedStyle(el).backgroundColor}));
 expect(rail.width).toBeLessThanOrEqual(430);expect(rail.bg).toBe('rgb(249, 243, 230)');
 const before=await page.evaluate(()=>window.__golf.state().sceneryTime);await page.waitForTimeout(200);
 expect(await page.evaluate(()=>window.__golf.state().sceneryTime)).toBeGreaterThan(before);
 await page.locator('[data-level="1"]').click();const playing=await page.evaluate(()=>window.__golf.state().sceneryTime);await page.waitForTimeout(200);
 expect(await page.evaluate(()=>window.__golf.state().sceneryTime)).toBeGreaterThan(playing);
 await page.locator('#pause').click();const paused=await page.evaluate(()=>window.__golf.state().sceneryTime);await page.waitForTimeout(200);
 expect(await page.evaluate(()=>window.__golf.state().sceneryTime)).toBe(paused);
 await page.locator('#resume').click();await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));
 const hidden=await page.evaluate(()=>window.__golf.state().sceneryTime);await page.waitForTimeout(200);expect(await page.evaluate(()=>window.__golf.state().sceneryTime)).toBe(hidden);
});

test('reduced motion holds scenery at zero',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(url);await page.waitForFunction(()=>window.__golf);await page.waitForTimeout(200);
 expect(await page.evaluate(()=>window.__golf.state().sceneryTime)).toBe(0);
});
