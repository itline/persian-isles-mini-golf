import { test, expect } from '@playwright/test';
import { shot } from './helpers/shot.js';
import { LEVELS } from '../src/journey.js';
import { JOURNEY_PROGRESS_KEY } from '../src/journeyProgress.js';

// Run against an isolated frozen Vite server, not a shared HMR source tree:
// HORMUZ_NINE_URL=http://127.0.0.1:4193 npx playwright test e2e/hormuz-nine-round.spec.js \
//   --workers=1 --retries=0 --output=/absolute/unique/hormuz-nine-results
const url=process.env.HORMUZ_NINE_URL??'http://127.0.0.1:4181';
const oldKey='persian-isles-golf:hormuz:journey-v2';
const bestKey='persian-isles-golf:hormuz:journey-9:v1';
const routes={
  1:[[-6.1,-.8]],
  2:[[-6.1,-4.2],[2.9,-4.2]],
  3:[[-6.1,-4.2],[-3,-4.2],[6,-4.2],[6,5.4]],
  4:[[-7,0],[-6.4,-4.5],[2.9,-4.2]],
  5:[[.4,-5.1],[-6.1,-4.8],[-6.1,5.5]],
  6:[[-6.1,-4.9],[4.1,-5.1],[6,-3.7],[6,-.1]],
  7:[[6.2,3.5],[6.2,1],[5.5,-2.2],[6,-5],[-6.1,-4.6],[-6.1,5.3]],
  8:[[-6,1],[-6,-2.5],[-6,-5.1],[1.4,-5.15],[2.9,-3.35]],
  9:[[-7,0],[-6.2,-5.1],[3,-5.15],[6,-3.6],[7,-.8],[7,2],[6,5.6]],
};
const originalPowers={1:[74],2:[83,77],3:[88,47,78,82]};

test('nine genuine keyboard-input holes produce an isolated nine-hole best, scorecard and replay',async({page},testInfo)=>{
  // Calibration measured 461s of real settling waits across 47 shots. Allow
  // rendering overhead, not retries or altered physics/time, for the full round.
  test.setTimeout(900000);
  const errors=[],evidence=[],scores=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(key=>localStorage.setItem(key,'1'),oldKey);
  await page.goto(`${url}/?qa`);
  await page.locator('#play').click();
  for(const level of LEVELS) {
    await expect(page.locator('#levelName')).toHaveText(level.name);
    const tee=await page.evaluate(()=>window.__golf.state());
    expect(tee.level).toBe(level.id);
    expect(tee.mode).toBe('journey');
    expect(tee.strokes).toBe(0);
    expect(tee.ball.x).toBeCloseTo(level.start.x,2);
    expect(tee.ball.z).toBeCloseTo(level.start.z,2);
    await page.screenshot({path:testInfo.outputPath(`hole-${level.id}-tee.png`)});
    for(const [index,[x,z]] of routes[level.id].entries()) {
      const final=index===routes[level.id].length-1;
      for(let attempt=0;attempt<(level.id<=3?1:4);attempt++) {
        const before=await page.evaluate(()=>window.__golf.state());
        if(before.completed)break;
        const distance=Math.hypot(x-before.ball.x,z-before.ball.z);
        if(!final&&distance<.65)break;
        const power=level.id<=3?originalPowers[level.id][index]
          :Math.max(8,Math.min(95,Math.pow(distance/15,.72)*100));
        const start=Date.now();
        await shot(page,x,z,power);
        const after=await page.evaluate(()=>window.__golf.state());
        evidence.push({hole:level.id,waypoint:index,target:[x,z],power,
          before:before.ball,after:after.ball,strokes:after.strokes,
          completed:after.completed,elapsedMs:Date.now()-start});
      }
      if(!final&&level.id>3) {
        const after=await page.evaluate(()=>window.__golf.state());
        expect(Math.hypot(x-after.ball.x,z-after.ball.z),`hole ${level.id}, waypoint ${index}`).toBeLessThan(.65);
      }
    }
    const finish=await page.evaluate(()=>window.__golf.state());
    expect(finish.completed,`hole ${level.id} genuinely holed`).toBe(true);
    expect(finish.phase).toBe('in_hole');
    scores.push(finish.strokes);
    expect(finish.journey).toEqual(scores);
    await expect(page.locator('#resultStrokes')).toHaveText(String(finish.strokes));
    await expect(page.locator('#resultPar')).toHaveText(String(level.par));
    const checkpoint=await page.evaluate(key=>localStorage.getItem(key),JOURNEY_PROGRESS_KEY);
    if(level.id<9)expect(JSON.parse(checkpoint)).toEqual({version:1,scores});
    else {
      expect(checkpoint).toBeNull();
      // Persist before the extra postcard click: reloading this result must
      // never lose an already completed nine-hole best.
      expect(await page.evaluate(key=>localStorage.getItem(key),bestKey))
        .toBe(String(scores.reduce((sum,score)=>sum+score,0)));
    }
    await page.locator('#resultNext').click();
  }
  const total=scores.reduce((sum,score)=>sum+score,0);
  const par=LEVELS.reduce((sum,level)=>sum+level.par,0);
  await expect(page.getByRole('heading',{name:'Your Hormuz postcard.'})).toBeVisible();
  await expect(page.locator('#journeyResults tbody tr')).toHaveCount(9);
  for(const [i,level] of LEVELS.entries()) {
    await expect(page.locator('#journeyResults tbody tr').nth(i).locator('td')).toHaveText([
      level.name,String(scores[i]),String(level.par),String(scores[i]),
    ]);
  }
  await expect(page.locator('#resultStrokes')).toHaveText(String(total));
  await expect(page.locator('#resultPar')).toHaveText(String(par));
  await expect(page.locator('#resultBest')).toHaveText(String(total));
  await expect(page.locator('#resultPreviousBest')).toHaveText('—');
  await expect(page.locator('#journeyResults tfoot')).toContainText(`Total${total}${par}`);
  expect(await page.evaluate(key=>localStorage.getItem(key),bestKey)).toBe(String(total));
  expect(await page.evaluate(key=>localStorage.getItem(key),oldKey)).toBe('1');
  expect(await page.evaluate(key=>localStorage.getItem(key),JOURNEY_PROGRESS_KEY)).toBeNull();
  await page.screenshot({path:testInfo.outputPath('nine-hole-postcard.png')});
  await testInfo.attach('actual-input-route-evidence',{body:JSON.stringify({scores,total,par,shots:evidence},null,2),contentType:'application/json'});
  await page.getByRole('button',{name:/Play the journey again/}).click();
  await expect(page.locator('#levelName')).toHaveText('Red Shore');
  const replay=await page.evaluate(()=>window.__golf.state());
  expect(replay.level).toBe(1);
  expect(replay.strokes).toBe(0);
  expect(replay.completed).toBe(false);
  expect(replay.journey).toEqual([]);
  expect(await page.evaluate(key=>localStorage.getItem(key),bestKey)).toBe(String(total));
  expect(errors).toEqual([]);
});
