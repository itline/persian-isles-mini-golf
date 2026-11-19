const TAU = Math.PI * 2;
const baselines = new WeakMap();
const clampProgress = (value) => Number.isNaN(value) ? 0 : Math.max(0, Math.min(1, value));

/** Pure menu offsets: time in seconds, bob in world units, yaw in radians. */
export function motionSample(time, reduced = false) {
  if (reduced || !Number.isFinite(time)) return { bob: 0, yaw: 0 };
  return {
    bob: Math.sin(time * TAU / 5) * 0.05,
    yaw: Math.sin(time * TAU / 6) * 0.008,
  };
}

/**
 * MENU ONLY: animate a visual diorama root, never a playable mesh/collider.
 * Capture root.position.y/root.rotation.y on first call; only these two values
 * are owned here. Child animations, x/z, other rotations and scale are untouched.
 * Call once with active:false before gameplay or when hiding a root to restore
 * its exact baseline. reducedMotion also restores immediately. Time is seconds.
 */
export function updateIslandMotion(root, time, { reducedMotion = false, active = true } = {}) {
  if (!baselines.has(root)) {
    baselines.set(root, { y: root.position.y, yaw: root.rotation.y });
  }
  const base = baselines.get(root);
  if (!active || reducedMotion) {
    root.position.y = base.y;
    root.rotation.y = base.yaw;
    return;
  }
  const sample = motionSample(time);
  root.position.y = base.y + sample.bob;
  root.rotation.y = base.yaw + sample.yaw;
}

/**
 * Pure, channel-wise sRGB interpolation of #rrggbb strings; returns #rrggbb.
 * Progress is clamped to [0,1]. Keep currentHex fixed at transition start rather
 * than feeding the previous frame's result back in. No DOM or Three.js ownership.
 */
export function transitionColor(currentHex, targetHex, progress) {
  const from = Number.parseInt(currentHex.slice(1), 16);
  const to = Number.parseInt(targetHex.slice(1), 16);
  const amount = clampProgress(progress);
  let result = 0;
  for (const shift of [16, 8, 0]) {
    const start = (from >>> shift) & 255;
    const end = (to >>> shift) & 255;
    result |= Math.round(start + (end - start) * amount) << shift;
  }
  return `#${result.toString(16).padStart(6, '0')}`;
}

/** Pure linear 250ms transition progress; both timestamps are in seconds. */
export function transitionOpacity(timeStarted, timeNow, reduced = false) {
  return reduced ? 1 : clampProgress((timeNow - timeStarted) / 0.25);
}
