import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { touchCourseView, updateCameraFraming } from './cameraView.js';
import { LEVELS } from './journey.js';

describe('orthographic camera framing', () => {
  it('starts touch gameplay closer while preserving the desktop overview', () => {
    const camera = new THREE.OrthographicCamera();
    updateCameraFraming(camera, {
      width: 390,
      height: 844,
      playing: true,
      zoom: 1,
      touchView: touchCourseView({ width: 390, height: 844, coarsePointer: true, outline: LEVELS[0].outline, angle: .62 }),
    });
    expect(camera.top - camera.bottom).toBeLessThanOrEqual(40);
    updateCameraFraming(camera, {
      width: 844,
      height: 390,
      playing: true,
      zoom: 1,
      touchView: touchCourseView({ width: 844, height: 390, coarsePointer: true, outline: LEVELS[0].outline, angle: .62 }),
    });
    expect(camera.top - camera.bottom).toBeLessThanOrEqual(20);
    updateCameraFraming(camera, {
      width: 1440,
      height: 900,
      playing: true,
      zoom: 1,
      coarsePointer: false,
    });
    expect(camera.top - camera.bottom).toBe(24);
  });

  it('retains the menu and playing frusta at responsive sizes', () => {
    const camera = new THREE.OrthographicCamera(-18, 18, 13, -13, 0.1, 200);
    updateCameraFraming(camera, { width: 1440, height: 900, playing: false, zoom: 1 });
    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([
      -23.04, 23.04, 12.4, -16.4,
    ]);
    updateCameraFraming(camera, { width: 390, height: 844, playing: false, zoom: 1 });
    expect(camera.top).toBeCloseTo(35 * 0.51);
    expect(camera.bottom).toBeCloseTo(-35 * 1.49);
    updateCameraFraming(camera, { width: 844, height: 390, playing: true, zoom: 1.5 });
    expect(camera.top).toBe(5.5);
    expect(camera.bottom).toBe(-10.5);
  });

  it('does not rebuild an unchanged projection but responds to zoom, mode and viewport', () => {
    const camera = new THREE.OrthographicCamera();
    const update = vi.spyOn(camera, 'updateProjectionMatrix');
    const view = { width: 1440, height: 900, playing: false, zoom: 1 };
    updateCameraFraming(camera, view);
    const matrix = camera.projectionMatrix.clone();
    for (let frame = 0; frame < 60; frame++) updateCameraFraming(camera, view);
    expect(update).toHaveBeenCalledTimes(1);
    expect(camera.projectionMatrix.equals(matrix)).toBe(true);
    updateCameraFraming(camera, { ...view, zoom: 1.1 });
    updateCameraFraming(camera, { ...view, playing: true });
    updateCameraFraming(camera, { ...view, width: 1024 });
    expect(update).toHaveBeenCalledTimes(4);
  });
});
