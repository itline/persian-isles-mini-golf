import { test, expect } from '@playwright/test';
const url = 'http://127.0.0.1:4181/';

for (const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1440,height:900}]) {
  test(`direct sound and pause replace home and tools at ${viewport.width}`, async ({browser}) => {
    const mobile = viewport.width < 1000;
    const context = await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
    const page = await context.newPage();
    await page.goto(url + '?qa');
    await expect(page.locator('#helpFooter')).toHaveText('How to play');
    for (const item of await page.locator('.menu-footer .text-btn').all()) {
      await expect(item).toBeInViewport();
      await item.click({trial:true});
    }
    await page.locator('#helpFooter').click();
    await expect(page.locator('#helpPanel')).toBeVisible();
    await expect(page.locator('#helpPanel .help-steps li')).toHaveCount(4);
    await page.keyboard.press('Escape');
    await expect(page.locator('#helpFooter')).toBeFocused();
    await page.locator('#play').click();
    await expect(page.locator('#hint')).toBeVisible();
    await expect(page.locator('#home, #gameMenuToggle, #gameTools, #helpOpen')).toHaveCount(0);
    await expect(page.locator('.game-navigation button')).toHaveCount(2);
    await expect(page.locator('.game-title')).toContainText('Hormuz');
    await expect(page.locator('.game-title #holeNumber')).toHaveText('1');
    await expect(page.locator('.game-title #levelName')).toHaveText('Red Shore');
    await expect(page.locator('.game-title #strokes')).toHaveText('0');
    await expect(page.locator('.game-title #coursePar')).toHaveText('2');
    await expect(page.locator('.hud, #levelTitle')).toHaveCount(0);
    const card = await page.locator('.game-title').boundingBox();
    const controls = await page.locator('.game-navigation').boundingBox();
    expect(card.x + card.width).toBeLessThanOrEqual(controls.x - 8);
    expect(card.height).toBeLessThanOrEqual(100);
    await page.locator('#scene').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('.game-title #strokes')).toHaveText('1');
    await page.locator('#pause').click();
    await page.locator('#restart').click();
    await expect(page.locator('.game-title #strokes')).toHaveText('0');
    for (const id of ['sound','pause']) {
      const button = page.locator('#' + id);
      await expect(button).toBeVisible();
      await button.click({trial:true});
      const box = await button.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator('#sound').click();
    await expect(page.locator('#audioPanel')).toBeVisible();
    await page.locator('#audioClose').click();
    await page.locator('#pause').click();
    await expect(page.locator('#pausePanel')).toBeVisible();
    await expect(page.locator('#pausePanel button')).toHaveCount(3);
    await page.locator('#backHome').click();
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page.locator('#leavePanel')).toBeHidden();
    await context.close();
  });
}
