import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

// Run only against a separately served, frozen production candidate.
const base = new URL(process.env.GOLF_URL || 'http://127.0.0.1:4182/');
const previewIslands = ['qeshm', 'kish', 'khark', 'hengam'];
const holeIds = Array.from({ length: 9 }, (_, index) => String(index + 1));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = request.url();
    if (!url.startsWith('data:') && !url.startsWith('blob:') && new URL(url).origin !== base.origin) {
      external.push(url);
    }
  });
  const entry = new URL(base);
  entry.search = '?qa';
  await page.goto(entry.href);
  await page.locator('#play:enabled').waitFor();
  assert.equal(await page.evaluate(() => typeof window.__golf), 'undefined',
    'Production must not expose QA state even with ?qa');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('[data-island]')).toHaveCount(5);

  for (const id of previewIslands) {
    await page.locator(`[data-island="${id}"]`).click();
    await page.waitForFunction(island => document.querySelector('#menu').dataset.previewReady === island, id);
    await expect(page.locator('#islandAvailability')).toBeHidden();
    await expect(page.locator('#loadError')).toBeHidden();
    await expect(page.locator('#play')).toBeDisabled();
    await expect(page.locator('#play')).toHaveText('Preview only');
    await expect(page.locator('#levelGrid')).toBeHidden();
    await expect(page.locator('#levelGrid [data-level]:visible:enabled')).toHaveCount(0);
    await expect(page.locator('#invitation')).toBeHidden();
  }

  await page.locator('[data-island="hormuz"]').click();
  await page.waitForFunction(() => document.querySelector('#menu').dataset.previewReady === 'hormuz');
  await expect(page.locator('#islandAvailability')).toBeHidden();
  await expect(page.locator('#play')).toBeEnabled();
  await expect(page.locator('#play')).toHaveText('Play Hormuz journey');
  await expect(page.locator('#levelGrid')).toBeVisible();
  const cards = page.locator('#levelGrid [data-level]');
  await expect(cards).toHaveCount(9);
  assert.deepEqual(await cards.evaluateAll(nodes => nodes.map(node => node.dataset.level)), holeIds,
    'Hormuz must contain exactly holes 1–9, with no future slots or playable Qeshm cards');
  for (const card of await cards.all()) {
    await expect(card).toBeVisible();
    await expect(card).toBeEnabled();
  }
  // A bounded real-input production route: complete the first journey hole,
  // advance using its primary action, then verify practice remains separate.
  await page.locator('#play').click();
  await page.locator('#scene').focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  await expect(page.locator('#resultPanel')).toBeVisible({ timeout: 25000 });
  await expect(page.locator('#resultNext')).toHaveClass(/primary/);
  await expect(page.locator('#resultNext')).toBeFocused();
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('persian-isles-golf:hormuz:journey-9:progress-v1'))), { version: 1, scores: [1] });
  await page.keyboard.press('Enter');
  await expect(page.locator('#holeNumber')).toHaveText('2');
  await page.locator('#pause').click();
  await page.locator('#backHome').click();
  await page.locator('#leaveConfirm').click();
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#continueJourney')).toHaveText('Continue Hormuz · hole 2 of 9');
  await page.locator('#levelGrid [data-level="5"]').click();
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('#game .game-title')).toBeVisible();
  await expect(page.locator('#courseIsland')).toHaveText('Hormuz');
  await expect(page.locator('#holeNumber')).toHaveText('5');
  await expect(page.locator('#strokes')).toHaveText('0');
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#strokes')).toHaveText('1');

  for (const file of ['THIRD_PARTY_NOTICES.txt', 'DEPENDENCY_LICENSES.txt']) {
    const response = await page.request.get(new URL(file, base).href);
    assert.equal(response.status(), 200, `${file} must ship with the build`);
    const text = await response.text();
    assert.ok(text.length > 100 && !/<html[\s>]/i.test(text), `${file} must contain a notice, not an HTML fallback`);
  }
  assert.equal(await page.evaluate(() => typeof window.__golf), 'undefined');
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(JSON.stringify({
    production: true, qaAbsent: true, hormuzHoleCards: holeIds.length,
    previewOnlyIslands: previewIslands, level: 5, realKeyboardShot: true,
    firstJourneyHoleCompleted: true, nextHoleAndCheckpoint: true,
    pageErrors: errors, externalRequests: external, notices: 200,
    scope: 'Production first-hole, next-step and practice smoke; not full-journey or physical-device acceptance',
  }));
} finally {
  await browser.close();
}
