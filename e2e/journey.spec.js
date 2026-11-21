import { test, expect } from '@playwright/test';
import { shot } from './helpers/shot.js';
test('all three holes complete by actual inputs; journey postcard totals and records persist', async ({
  page,
}) => {
  test.setTimeout(140000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('persian-isles-golf:hormuz:level-1:v2', '5'));
  await page.goto('http://127.0.0.1:4181/?qa');
  await page.locator('#play').click();
  await page.waitForTimeout(700);
  await shot(page, -6.1, -0.8, 74);
  await expect(page.locator('#resultStrokes')).toHaveText('1');
  await expect(page.locator('#resultPar')).toHaveText('2');
  await expect(page.locator('#resultBest')).toHaveText('1');
  await expect(page.locator('#resultPreviousBest')).toHaveText('5');
  await expect(page.locator('#recordNote')).toContainText('New personal best');
  await expect(page.locator('#game')).toHaveClass(/celebrating/);
  await expect(page.locator('.shot-controls')).toHaveAttribute('data-phase', 'holed');
  await page.locator('#resultNext').click();
  await expect(page.locator('#levelName')).toHaveText('Salt Valley');
  await shot(page, -6.1, -4.2, 83);
  await shot(page, 2.9, -4.2, 77);
  await expect(page.locator('#resultStrokes')).toHaveText('2');
  await expect(page.locator('#resultPar')).toHaveText('3');
  await expect(page.locator('#resultBest')).toHaveText('2');
  await expect(page.locator('#resultPreviousBest')).toHaveText('—');
  await page.locator('#resultNext').click();
  await expect(page.locator('#levelName')).toHaveText('Rainbow Run');
  await shot(page, -6.1, -4.2, 88);
  await shot(page, -3, -4.2, 47);
  await shot(page, 6, -4.2, 78);
  await shot(page, 6, 5.4, 82);
  await expect(page.locator('#resultStrokes')).toHaveText('4');
  await expect(page.locator('#resultPar')).toHaveText('4');
  await expect(page.locator('#resultBest')).toHaveText('4');
  await page.getByRole('button', { name: 'See journey results' }).click();
  await expect(page.getByRole('heading', { name: 'Your Hormuz postcard.' })).toBeVisible();
  await expect(page.locator('#resultStrokes')).toHaveText('7');
  await expect(page.locator('#resultPar')).toHaveText('9');
  await expect(page.locator('#resultBest')).toHaveText('7');
  await expect(page.locator('#journeyResults tbody tr')).toHaveCount(3);
  await expect(page.locator('#journeyResults thead')).toHaveText(/Hole.*Strokes.*Par.*Best/);
  await expect(page.locator('#journeyResults tbody tr').nth(0)).toHaveText(/Red Shore.*1.*2.*1/);
  await expect(page.locator('#journeyResults tbody tr').nth(1)).toHaveText(/Salt Valley.*2.*3.*2/);
  await expect(page.locator('#journeyResults tbody tr').nth(2)).toHaveText(/Rainbow Run.*4.*4.*4/);
  await expect(page.locator('#journeyResults tfoot th').last()).toHaveText('—');
  await expect(page.locator('#resultPanel .eyebrow')).toHaveText('HORMUZ / JOURNEY COMPLETE');
  await expect(page.locator('#journeyResults tfoot')).toContainText('Total');
  await expect(page.locator('#recordNote')).toContainText('Journey best: 7');
  expect(await page.evaluate(() => window.__golf.state().journey)).toEqual([1, 2, 4]);
  await page.getByRole('button', { name: 'Play the journey again' }).click();
  await expect(page.locator('#strokes')).toHaveText('0');
  expect(
    await page.evaluate(() => localStorage.getItem('persian-isles-golf:hormuz:level-1:v2')),
  ).toBe('1');
  await page.reload();
  await page.locator('[data-level="2"]').click();
  expect(
    await page.evaluate(() => localStorage.getItem('persian-isles-golf:hormuz:level-2:v2')),
  ).toBe('2');
  expect(errors).toEqual([]);
});

test('music and effects default on, remain independent and persistent', async ({ page }) => {
  await page.goto('http://127.0.0.1:4181/?qa');
  await page.waitForFunction(() => window.__golf);
  let audio = await page.evaluate(() => window.__golf.state().audio);
  expect(audio.music).toBe(true);
  expect(audio.effects).toBe(true);
  expect(audio.unlocked).toBe(false);
  await page.locator('#menuSound').click();
  await page.locator('#effectsToggle').uncheck();
  await page.locator('#audioClose').click();
  await page.waitForFunction(() => window.__golf.state().audio.playing);
  audio = await page.evaluate(() => window.__golf.state().audio);
  expect(audio.effects).toBe(false);
  expect(audio.contextState).toBe('running');
  await page.locator('[data-island="kish"]').click();
  await page.waitForFunction(() => window.__golf.state().preview === 'kish');
  expect((await page.evaluate(() => window.__golf.state().audio)).island).toBe('kish');
  await page.reload();
  await page.waitForFunction(() => window.__golf);
  audio = await page.evaluate(() => window.__golf.state().audio);
  expect(audio.music).toBe(true);
  expect(audio.effects).toBe(false);
  expect(audio.unlocked).toBe(false);
  await page.locator('#play').click();
  await page.waitForFunction(() => window.__golf.state().audio.playing);
  await page.locator('#pause').click();
  expect((await page.evaluate(() => window.__golf.state().audio)).playing).toBe(false);
  await page.locator('#resume').click();
  await page.waitForFunction(() => window.__golf.state().audio.playing);
});

test('silent browsing and playing never create an audio context; music unlocks on opt-in', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'persian-isles-golf.audio.v1',
      JSON.stringify({ music: false, effects: false }),
    ),
  );
  await page.goto('http://127.0.0.1:4181/?qa');
  await page.waitForFunction(() => window.__golf);
  // The audio API reports an absent (not-yet-created) context as 'locked'.
  const expectLocked = async () =>
    expect(await page.evaluate(() => window.__golf.state().audio)).toMatchObject({
      music: false,
      effects: false,
      unlocked: false,
      contextState: 'locked',
    });
  await expectLocked();
  for (const island of ['hormuz', 'qeshm', 'kish', 'khark', 'hengam']) {
    await page.locator(`[data-island="${island}"]`).click();
    await expect.poll(() => page.evaluate(() => window.__golf.state().preview)).toBe(island);
    await expectLocked();
  }
  await page.locator('#nextIsland').click();
  await expect.poll(() => page.evaluate(() => window.__golf.state().preview)).toBe('hormuz');
  await expectLocked();
  await page.locator('#prevIsland').click();
  await expect.poll(() => page.evaluate(() => window.__golf.state().preview)).toBe('hengam');
  await expectLocked();
  await page.locator('#prevIsland').click();
  await expect.poll(() => page.evaluate(() => window.__golf.state().preview)).toBe('khark');
  await expectLocked();
  await page.locator('[data-island="hormuz"]').click();
  await expect.poll(() => page.evaluate(() => window.__golf.state().preview)).toBe('hormuz');
  await page.locator('#play').click();
  await expect(page.locator('#pause')).toBeVisible();
  await expectLocked();
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#strokes')).toHaveText('1');
  await expectLocked();
  await page.locator('#sound').click();
  await page.locator('#musicToggle').check();
  await expect
    .poll(() => page.evaluate(() => window.__golf.state().audio))
    .toMatchObject({ music: true, effects: false, unlocked: true, contextState: 'running' });
  await page.locator('#audioClose').click();
  await page.waitForFunction(() => window.__golf.state().audio.playing);
});

for (const channel of ['music', 'effects'])
  test(`turning the last ${channel} preference off does not create an audio context`, async ({
    page,
  }) => {
    await page.addInitScript(
      (channel) =>
        localStorage.setItem(
          'persian-isles-golf.audio.v1',
          JSON.stringify({ music: channel === 'music', effects: channel === 'effects' }),
        ),
      channel,
    );
    await page.goto('http://127.0.0.1:4181/?qa');
    await page.waitForFunction(() => window.__golf);
    expect(await page.evaluate(() => window.__golf.state().audio)).toMatchObject({
      unlocked: false,
      contextState: 'locked',
    });
    await page.locator('#menuSound').click();
    await page.locator(`#${channel}Toggle`).uncheck();
    expect(await page.evaluate(() => window.__golf.state().audio)).toMatchObject({
      music: false,
      effects: false,
      unlocked: false,
      contextState: 'locked',
    });
    await page.locator(`#${channel}Toggle`).check();
    await expect
      .poll(() => page.evaluate(() => window.__golf.state().audio))
      .toMatchObject({ [channel]: true, unlocked: true, contextState: 'running' });
  });

test('startup effect waits for audio resume from the play gesture', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'persian-isles-golf.audio.v1',
      JSON.stringify({ music: false, effects: true }),
    );
    const NativeAudioContext = window.AudioContext;
    window.__startupAudio = [];
    window.AudioContext = class extends NativeAudioContext {
      constructor() {
        super();
        this.suspend();
      }
      resume() {
        window.__resumeFromGesture = navigator.userActivation.isActive;
        return new Promise((resolve, reject) =>
          setTimeout(() => super.resume().then(resolve, reject), 150),
        );
      }
      createOscillator() {
        const oscillator = super.createOscillator();
        let frequency;
        const set = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
        oscillator.frequency.setValueAtTime = (value, ...args) => {
          frequency = value;
          return set(value, ...args);
        };
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (...args) => {
          window.__startupAudio.push({ frequency, state: this.state });
          return start(...args);
        };
        return oscillator;
      }
    };
  });
  await page.goto('http://127.0.0.1:4181/?qa');
  await page.locator('#play').click();
  await expect
    .poll(() => page.evaluate(() => window.__startupAudio))
    .toContainEqual({ frequency: 660, state: 'running' });
  expect(await page.evaluate(() => window.__resumeFromGesture)).toBe(true);
});

test('mobile pinch zoom never fires a shot; single-touch dragging still does', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4181/?qa');
  await page.locator('[data-level="1"]').tap();
  const cdp = await context.newCDPSession(page);
  const points = (a, b) => [
    { x: a, y: 160, id: 1 },
    { x: b, y: 160, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(350, 450) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(310, 490) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(900);
  expect((await page.evaluate(() => window.__golf.state())).zoom).toBeGreaterThan(1.2);
  await expect(page.locator('#strokes')).toHaveText('0');
  await page.locator('#gameMenuToggle').tap();
  await page.locator('#overview').tap();
  await page.waitForTimeout(800);
  expect((await page.evaluate(() => window.__golf.state())).zoom).toBeCloseTo(1, 1);
  await page.locator('#gameMenuToggle').tap();
  const pointsAfterPinch = await page.evaluate(() => {
    const s = window.__golf.state();
    return {
      start: window.__golf.project(s.ball.x, s.ball.z),
      end: window.__golf.project(s.ball.x, s.ball.z + 1.5),
    };
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...pointsAfterPinch.start, id: 3 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ ...pointsAfterPinch.end, id: 3 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#strokes')).toHaveText('1');
  await context.close();
});
