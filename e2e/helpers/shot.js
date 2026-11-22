import { expect } from '@playwright/test';

// Read-only QA coordinates guide genuine keyboard inputs only.
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
  const targetPower = Math.max(0.08, Math.min(1, power / 100));
  const powerDirection = targetPower >= state.power ? 1 : -1;
  const powerDistance = Math.abs(targetPower - state.power) / 0.025;
  const candidates = [Math.floor(powerDistance), Math.ceil(powerDistance)].map((steps) => ({
    steps,
    value: Math.max(0.08, Math.min(1, state.power + powerDirection * steps * 0.025)),
  }));
  // Choose the closest reachable power, including the clamped endpoint.
  const closest = candidates.reduce((best, candidate) =>
    Math.abs(candidate.value - targetPower) < Math.abs(best.value - targetPower)
      ? candidate : best,
  );
  for (let step = 0; step < closest.steps; step++) {
    await page.keyboard.press(powerDirection > 0 ? 'ArrowUp' : 'ArrowDown');
  }
  expect(await page.evaluate(() => window.__golf.state().power)).toBeCloseTo(closest.value, 8);
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
