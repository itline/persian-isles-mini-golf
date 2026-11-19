import { describe, expect, it } from 'vitest';
import { clampPower, computeShotImpulse, isHoleComplete, initialHormuzState } from './game.js';

describe('Hormuz golf slice rules', () => {
  it('clamps shot power and preserves horizontal direction', () => {
    expect(clampPower(-1)).toBe(0);
    expect(clampPower(0.55)).toBe(0.55);
    expect(clampPower(2)).toBe(1);
    const impulse = computeShotImpulse({ x: 1, z: -1 }, 0.5);
    expect(impulse.y).toBe(0);
    expect(Math.hypot(impulse.x, impulse.z)).toBeCloseTo(0.5, 5);
  });
  it('recognizes a settled ball inside the cup', () => {
    expect(isHoleComplete({x: 1, z: 1}, {x: 1.1, z: 1.1}, 0.03)).toBe(true);
    expect(isHoleComplete({x: 1, z: 1}, {x: 2, z: 2}, 0.03)).toBe(false);
    expect(isHoleComplete({x: 1, z: 1}, {x: 1.1, z: 1.1}, 0.5)).toBe(false);
  });
  it('starts on Hormuz with a bounded par', () => {
    expect(initialHormuzState.par).toBe(4);
    expect(initialHormuzState.strokes).toBe(0);
    expect(initialHormuzState.completed).toBe(false);
  });
});
