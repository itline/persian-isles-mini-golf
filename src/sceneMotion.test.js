import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as motion from './sceneMotion.js';

describe('motionSample', () => {
  it('returns rest offsets for non-finite timestamps', () => {
    for (const time of [NaN, Infinity, -Infinity, undefined]) {
      expect(motion.motionSample(time)).toEqual({ bob: 0, yaw: 0 });
    }
  });
  it('samples gentle, deterministic five/six-second motion without state', () => {
    expect(motion.motionSample(0)).toEqual({ bob: 0, yaw: 0 });
    expect(motion.motionSample(1.25).bob).toBeCloseTo(0.05, 12);
    expect(motion.motionSample(1.5).yaw).toBeCloseTo(0.008, 12);
    expect(motion.motionSample(6.25).bob).toBeCloseTo(0.05, 12);
    expect(motion.motionSample(7.5).yaw).toBeCloseTo(0.008, 12);
    expect(motion.motionSample(2.5, true)).toEqual({ bob: 0, yaw: 0 });
    const expected = motion.motionSample(2.34);
    motion.motionSample(900);
    expect(motion.motionSample(2.34)).toEqual(expected);
    for (let time = -30; time <= 60; time += 0.017) {
      const { bob, yaw } = motion.motionSample(time);
      expect(Math.abs(bob)).toBeLessThanOrEqual(0.07);
      expect(Math.abs(yaw)).toBeLessThanOrEqual(0.012);
    }
  });
});

describe('updateIslandMotion', () => {
  it('adds offsets to the captured base transform without accumulating drift', () => {
    const root = new THREE.Group();
    root.position.set(3, 4, 5);
    root.rotation.y = 0.25;
    const child = new THREE.Object3D();
    child.position.y = 2;
    root.add(child);
    const childPosition = child.position.clone();

    motion.updateIslandMotion(root, 1.25);
    expect(root.position.toArray()).toEqual([3, 4.05, 5]);
    expect(root.rotation.y).toBeCloseTo(0.25 + motion.motionSample(1.25).yaw, 12);
    expect(child.position.equals(childPosition)).toBe(true);

    motion.updateIslandMotion(root, 3.75);
    expect(root.position.toArray()).toEqual([3, 3.95, 5]);
    expect(root.rotation.y).toBeCloseTo(0.25 + motion.motionSample(3.75).yaw, 12);

    motion.updateIslandMotion(root, 3.75, { active: false });
    expect(root.position.toArray()).toEqual([3, 4, 5]);
    expect(root.rotation.y).toBeCloseTo(0.25, 12);
  });

  it('resets immediately for reduced motion and stays at its base while inactive', () => {
    const root = new THREE.Group();
    root.position.y = -2;
    root.rotation.y = -0.4;
    motion.updateIslandMotion(root, 2, { reducedMotion: true });
    expect(root.position.y).toBe(-2);
    expect(root.rotation.y).toBe(-0.4);
    motion.updateIslandMotion(root, 8, { active: false });
    expect(root.position.y).toBe(-2);
    expect(root.rotation.y).toBe(-0.4);
    motion.updateIslandMotion(root, 1.25);
    expect(root.position.y).not.toBe(-2);
    motion.updateIslandMotion(root, 9, { reducedMotion: true });
    expect(root.position.y).toBe(-2);
    expect(root.rotation.y).toBe(-0.4);
  });

  it('keeps independent WeakMap baselines stable through repeated frames and restarts', () => {
    const first = new THREE.Group();
    const second = new THREE.Group();
    first.position.y = 2;
    second.position.y = -3;
    first.rotation.y = 0.75;
    second.rotation.y = -0.75;
    for (let frame = 0; frame < 1000; frame++) {
      motion.updateIslandMotion(first, 1.25);
      motion.updateIslandMotion(second, 1.25);
    }
    expect(first.position.y).toBe(2.05);
    expect(second.position.y).toBe(-2.95);
    motion.updateIslandMotion(first, 9, { active: false });
    expect(first.position.y).toBe(2);
    expect(first.rotation.y).toBe(0.75);
    expect(second.position.y).toBe(-2.95);
    motion.updateIslandMotion(first, 1.25);
    expect(first.position.y).toBe(2.05);
  });

  it('leaves child animations, sibling gameplay objects and unrelated transform axes untouched', () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    root.position.set(2, 3, 4);
    root.rotation.set(0.2, 0.3, 0.4);
    root.scale.set(2, 3, 4);
    const boat = new THREE.Object3D();
    const playable = new THREE.Object3D();
    playable.position.set(10, 11, 12);
    root.add(boat);
    scene.add(root, playable);
    const playableMatrix = playable.matrix.clone();
    for (let frame = 0; frame < 10; frame++) {
      boat.position.y = frame * 0.03;
      boat.rotation.z = frame * 0.01;
      motion.updateIslandMotion(root, frame / 10);
      expect(boat.position.y).toBe(frame * 0.03);
      expect(boat.rotation.z).toBe(frame * 0.01);
    }
    motion.updateIslandMotion(root, 2, { active: false });
    expect(root.position.toArray()).toEqual([2, 3, 4]);
    expect(root.rotation.toArray()).toEqual([0.2, 0.3, 0.4, 'XYZ']);
    expect(root.scale.toArray()).toEqual([2, 3, 4]);
    expect(playable.position.toArray()).toEqual([10, 11, 12]);
    expect(playable.matrix.equals(playableMatrix)).toBe(true);
  });
});

describe('menu transition helpers', () => {
  it('interpolates colors and clamps progress', () => {
    expect(motion.transitionColor('#000000', '#ffffff', 0)).toBe('#000000');
    expect(motion.transitionColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(motion.transitionColor('#000000', '#ffffff', 2)).toBe('#ffffff');
    expect(motion.transitionColor('#123456', '#abcdef', -1)).toBe('#123456');
    expect(motion.transitionColor('#123456', '#abcdef', NaN)).toBe('#123456');
    expect(motion.transitionColor('#ff0000', '#0000ff', 0.5)).toBe('#800080');
    expect(motion.transitionColor('#123456', '#abcdef', 1)).toBe('#abcdef');
  });

  it('reports a quarter-second opacity transition and reduced-motion completion', () => {
    expect(motion.transitionOpacity(10, 10)).toBe(0);
    expect(motion.transitionOpacity(10, 10.125)).toBeCloseTo(0.5, 12);
    expect(motion.transitionOpacity(10, 10.5)).toBe(1);
    expect(motion.transitionOpacity(10, 10.25)).toBe(1);
    expect(motion.transitionOpacity(10, 9)).toBe(0);
    expect(motion.transitionOpacity(NaN, 10)).toBe(0);
    expect(motion.transitionOpacity(10, 10.125, true)).toBe(1);
  });
});
