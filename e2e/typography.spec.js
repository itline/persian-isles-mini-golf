import { test, expect } from '@playwright/test';

const url = 'http://127.0.0.1:4181/?qa';

async function loadTypography(page) {
  await page.goto(url);
  await expect(page.locator('#play')).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
}

test('operational UI uses locally loaded Source Sans 3 at regular and semibold weights', async ({ page }) => {
  await loadTypography(page);
  for (const selector of ['#play', '.island-tab span', '.menu-footer a', '#hint b', '#resume', '#restart', '.audio-option span', '.help-steps li']) {
    await expect(page.locator(selector).first()).toHaveCSS('font-family', /Source Sans 3/);
  }
  const font = await page.evaluate(async () => {
    const regular = await document.fonts.load('400 14px "Source Sans 3"');
    const semibold = await document.fonts.load('600 14px "Source Sans 3"');
    return {
      regular: regular.map(({ status }) => status),
      semibold: semibold.map(({ status }) => status),
      resources: performance.getEntriesByType('resource')
        .filter(({ name }) => /\.woff2(?:$|\?)/.test(name))
        .map(({ name }) => ({ url: name, origin: new URL(name).origin })),
      origin: location.origin,
    };
  });
  expect(font.regular).toEqual(['loaded']);
  expect(font.semibold).toEqual(['loaded']);
  expect(font.resources.length).toBeGreaterThan(0);
  expect(font.resources.every(({ origin }) => origin === font.origin)).toBe(true);
  expect(font.resources.some(({ url }) => url.includes('source-sans-3-latin'))).toBe(true);
});

test('operational type has a readable scale and subordinate tabular numbers', async ({ page }) => {
  await loadTypography(page);
  const styles = await page.evaluate(() => {
    const read = (selector) => {
      const style = getComputedStyle(document.querySelector(selector));
      return { size: parseFloat(style.fontSize), family: style.fontFamily, numbers: style.fontVariantNumeric, weight: style.fontWeight };
    };
    return {
      button: read('#play'), label: read('.island-tab span'),
      slogan: read('.brand-slogan'), footer: read('.menu-footer a'),
      heading: read('#pauseTitle'), body: read('#pausePanel .panel > p:not(.eyebrow)'),
      hint: read('#hint b'), level: read('.level-button > span'),
      score: read('#resultStrokes'), subscore: read('#resultSubscore'),
    };
  });
  expect(styles.button.size).toBe(14);
  expect(styles.label.size).toBe(12);
  expect(styles.slogan.size).toBe(12);
  expect(styles.footer.size).toBe(14);
  expect(styles.body.size).toBe(14);
  expect(styles.hint.size).toBe(14);
  expect(styles.heading.family).toContain('Georgia');
  expect(styles.heading.size).toBeGreaterThanOrEqual(32);
  expect(styles.heading.size).toBeLessThanOrEqual(40);
  expect(styles.level.family).toContain('Source Sans 3');
  expect(styles.level.numbers).toContain('tabular-nums');
  expect(styles.score.size).toBeLessThanOrEqual(40);
  expect(styles.score.numbers).toContain('tabular-nums');
  expect(styles.subscore.size).toBe(12);
});

test('round information stays compact and onboarding stays readable on small screens', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 667, height: 320 }]) {
    await page.setViewportSize(viewport);
    await loadTypography(page);
    await page.locator('#play').click();
    await expect(page.locator('#game .game-title')).toBeVisible();
    await expect(page.locator('#hint')).toBeVisible();
    await expect(page.locator('#hint b')).toHaveCSS('font-size', '14px');
    await expect(page.locator('.game-title .course-context')).toHaveCSS('font-size', '12px');
    await expect(page.locator('.game-title .round-stats')).toHaveCSS('font-size', '14px');
    await expect(page.locator('.game-title .round-stats')).toHaveCSS('font-variant-numeric', 'tabular-nums');
    const title = await page.locator('.game-title').boundingBox();
    const actions = await page.locator('.game-navigation').boundingBox();
    expect(title.x + title.width).toBeLessThanOrEqual(actions.x);
    await page.locator('#pause').click();
    await expect(page.locator('#pausePanel')).toBeVisible();
    await expect(page.locator('#resume')).toBeInViewport();
    await expect(page.locator('#backHome')).toBeInViewport();
  }
});

test('small menus keep four readable footer links reachable without horizontal clipping', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 667, height: 320 }]) {
    await page.setViewportSize(viewport);
    await loadTypography(page);
    const links = page.locator('#menu .menu-footer > div > :is(a, button)');
    await expect(links).toHaveCount(4);
    for (const link of await links.all()) {
      await expect(link).toHaveCSS('font-size', '14px');
      const bounds = await link.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
      await expect(link).toBeVisible();
    }
    await page.locator('#play').scrollIntoViewIfNeeded();
    const play = await page.locator('#play').boundingBox();
    expect(play.x).toBeGreaterThanOrEqual(0);
    expect(play.x + play.width).toBeLessThanOrEqual(viewport.width);
    await page.locator('.level-button:not(:disabled)').last().scrollIntoViewIfNeeded();
    await expect(page.locator('.level-button:not(:disabled)').last()).toBeInViewport();
    await page.locator('#helpFooter').click();
    await expect(page.locator('#helpPanel')).toBeVisible();
    await expect(page.locator('#helpClose')).toBeInViewport();
    await page.locator('#helpClose').click();
  }
});

test('typography layer leaves every credits style and brand size unchanged', async ({ page }) => {
  await loadTypography(page);
  const comparison = await page.evaluate(() => {
    const sheets = [...document.styleSheets].filter((sheet) =>
      sheet.href?.includes('/src/typography.css') ||
      sheet.ownerNode?.getAttribute('data-vite-dev-id')?.endsWith('/typography.css'));
    const snapshot = () => ({
      credits: [...document.querySelectorAll('#credits, #credits *')].map((element) => {
        const style = getComputedStyle(element);
        return { html: element.outerHTML, css: [...style].map((key) => [key, style.getPropertyValue(key)]) };
      }),
      brandSize: getComputedStyle(document.querySelector('.brand-name')).fontSize,
    });
    const enabled = snapshot();
    sheets.forEach((sheet) => { sheet.disabled = true; });
    const disabled = snapshot();
    sheets.forEach((sheet) => { sheet.disabled = false; });
    return { enabled, disabled, count: sheets.length };
  });
  expect(comparison.count).toBeGreaterThan(0);
  expect(comparison.enabled).toEqual(comparison.disabled);
});
