import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.GOLF_URL || 'http://127.0.0.1:4181';
const baseline = process.env.GOLF_BASELINE_URL || 'http://127.0.0.1:4281';
const out = process.env.GOLF_EVIDENCE_DIR || '/Users/hasan/.hermes/cache/scratch/golf-compact-interface';
await fs.mkdir(out, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const observations = [];
try {
  for (const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1440,height:900}]) {
    const mobile = viewport.width < 1000;
    const context = await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
    const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror',error => errors.push(error.message));
    page.on('request',request => { if (!request.url().startsWith(base + '/') && !request.url().startsWith('data:')) external.push(request.url()); });
    await page.goto(base + '/?qa');
    await page.locator('#play:enabled').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path:`${out}/menu-${viewport.width}.png`});
    await page.locator('#helpFooter').click();
    await page.locator('#helpPanel').waitFor();
    assert.equal(await page.locator('#helpPanel .help-steps li').count(),4);
    await page.screenshot({path:`${out}/help-${viewport.width}.png`});
    await page.locator('#helpClose').click();
    await page.locator('#creditsOpen').click();
    // Freeze the backdrop only during comparison: rounded transparent corners
    // otherwise sample the changed menu behind the unchanged credits panel.
    const creditCapture = {style:'#credits { background: #214b4a !important; backdrop-filter: none !important; }'};
    const credits = await page.locator('#credits .panel').screenshot({...creditCapture,path:`${out}/credits-after-${viewport.width}.png`});
    const beforePage = await context.newPage();
    await beforePage.goto(baseline);
    await beforePage.locator('#play:enabled').waitFor();
    await beforePage.locator('#creditsOpen').click();
    const original = await beforePage.locator('#credits .panel').screenshot({...creditCapture,path:`${out}/credits-before-${viewport.width}.png`});
    assert.ok(credits.equals(original), `Credits rendering must remain pixel-identical at ${viewport.width}`);
    await beforePage.close();
    await page.locator('#creditsClose').click();
    await page.locator('#play').click();
    await page.screenshot({path:`${out}/game-${viewport.width}.png`});
    assert.equal(await page.locator('#home,#gameMenuToggle,#gameTools,#helpOpen,.hud').count(),0);
    assert.equal(await page.locator('.game-navigation button').count(),2);
    await page.locator('#scene').focus();
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.querySelector('#strokes').textContent === '1');
    await page.locator('#pause').click();
    await page.locator('#pausePanel').waitFor();
    await page.screenshot({path:`${out}/pause-${viewport.width}.png`});
    await page.locator('#backHome').click();
    await page.locator('#leavePanel').waitFor();
    await page.locator('#leaveCancel').click();
    assert.ok(await page.locator('#pausePanel').isVisible());
    await page.locator('#backHome').click();
    await page.locator('#leaveConfirm').click();
    await page.locator('#menu').waitFor();
    const type = await page.locator('#play').evaluate(el => ({family:getComputedStyle(el).fontFamily,size:getComputedStyle(el).fontSize}));
    assert.deepEqual(errors,[]);
    assert.deepEqual(external,[]);
    observations.push({viewport,creditsPixelIdentical:true,helpSteps:4,realShot:true,confirmationCancelPreservesPause:true,errors,external,type});
    await context.close();
  }
  await fs.writeFile(`${out}/observations.json`,JSON.stringify({base,observations},null,2));
  console.log(JSON.stringify({evidence:out,observations},null,2));
} finally { await browser.close(); }
