export const initialHormuzState = Object.freeze({
  island: 'Hormuz',
  par: 4,
  strokes: 0,
  completed: false,
  best: null,
});

export function clampPower(power) {
  return Math.max(0, Math.min(1, Number.isFinite(power) ? power : 0));
}

export function computeShotImpulse(direction, power) {
  const length = Math.hypot(direction?.x ?? 0, direction?.z ?? 0) || 1;
  const p = clampPower(power);
  return { x: (direction.x / length) * p, y: 0, z: (direction.z / length) * p };
}

export function isHoleComplete(ball, hole, speed, radius = 0.42) {
  if (!ball || !hole || !Number.isFinite(speed)) return false;
  return Math.hypot(ball.x - hole.x, ball.z - hole.z) <= radius && speed <= 0.12;
}

export function scoreLabel(strokes, par) {
  if (strokes === 1) return 'HOLE IN ONE';
  const delta = strokes - par;
  if (delta <= -3) return 'ALBATROSS';
  if (delta === -2) return 'EAGLE';
  if (delta === -1) return 'BIRDIE';
  if (delta === 0) return 'PAR';
  if (delta === 1) return 'BOGEY';
  return `+${delta}`;
}
