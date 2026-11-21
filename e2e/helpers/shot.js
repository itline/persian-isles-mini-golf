import { expect } from '@playwright/test';

// Read-only QA coordinates guide genuine keyboard and slider inputs.
export async function shot(page, x, z, power, timeout = 25000) {
  const state = await page.evaluate(() => window.__golf.state());
  const desired = Math.atan2(x - state.ball.x, -(z - state.ball.z));
  let delta = desired - state.angle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  await page.locator('#scene').focus();
  for (let step = 0; step < Math.round(Math.abs(delta) / 0.055); step++) {
    await page.keyboard.press(delta > 0 ? 'ArrowRight' : 'ArrowLeft');
  }
  await page.locator('#power').evaluate((element, value) => {
    element.value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, power);
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#strokes')).toHaveText(String(state.strokes + 1));
  // Shoot changes phase synchronously, so no fixed sleep is needed to avoid
  // accidentally accepting the pre-shot aiming phase.
  await page.waitForFunction(
    () => ['aiming', 'in_hole'].includes(window.__golf.state().phase),
    null,
    { timeout },
  );
}
