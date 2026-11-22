import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';

// Execute the actual DOM handlers; projection is isolated so release coordinates
// are deterministic. Genuine browser gestures are covered separately in e2e.
function handlers() {
  const source = fs.readFileSync(new URL('./main.js', import.meta.url), 'utf8');
  const listeners = {}, shots = [];
  const context = {
    ready: true, playing: true, paused: false, state: { completed: false },
    pointers: new Map(), pinch: null, orbit: null, drag: null, cameraFrozen: false,
    aimAngle: 0, orbitAngle: 0.62, targetZoom: 1, ball: { state: 'aiming' },
    canvas: { addEventListener: (name, fn) => { listeners[name] = fn; }, setPointerCapture() {} },
    $: () => ({ classList: { contains: () => true } }),
    groundPoint: (x, z) => new THREE.Vector3(x, 0, z), aimDir: () => ({ x: 0, z: -1 }),
    clampPower: value => Math.max(0, Math.min(1, value)), clampZoom: value => value,
    THREE, updateHud() {}, putt: (p, dir) => shots.push({ p, dir }),
    cancelDrag() { context.drag = null; context.orbit = null; context.cameraFrozen = false; },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("canvas.addEventListener('pointerdown', (e) => {"), source.indexOf("addEventListener('blur'")), context);
  const event = (id, x, y) => ({ pointerId: id, clientX: x, clientY: y, button: 0 });
  return { listeners, context, shots, event };
}

describe('putt pointer ownership', () => {
  it('cancels an owned drag if pointer capture is lost, without shooting', () => {
    const { listeners: on, context, shots, event } = handlers();
    on.pointerdown(event(1, 0, 0));
    on.pointermove(event(1, 0, 1));
    on.lostpointercapture?.(event(1, 0, 1));
    expect(context.drag).toBeNull();
    expect(context.cameraFrozen).toBe(false);
    on.pointerup(event(1, 0, 1));
    expect(shots).toEqual([]);
  });
  it('ignores moves and release from a pointer that did not start the putt', () => {
    const { listeners: on, context, shots, event } = handlers();
    on.pointerdown(event(1, 0, 0));
    on.pointermove(event(999, 3.6, 0));
    on.pointerup(event(999, 3.6, 0));
    expect(shots).toEqual([]);
    expect(context.drag.p).toBe(0);
    on.pointerup(event(1, 0, 1.8));
    expect(shots).toHaveLength(1);
    expect(shots[0].p).toBeCloseTo(0.5);
  });
  it('uses the release endpoint even when the last move was earlier', () => {
    const { listeners: on, shots, event } = handlers();
    on.pointerdown(event(1, 0, 0));
    on.pointermove(event(1, 0, 1));
    on.pointerup(event(1, 0, 3.6));
    expect(shots).toHaveLength(1);
    expect(shots[0].p).toBeCloseTo(1);
    expect(shots[0].dir.z).toBeCloseTo(-1);
  });
});
