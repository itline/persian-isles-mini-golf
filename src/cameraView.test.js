import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { updateCameraFraming } from './cameraView.js';

describe('orthographic camera framing', () => {
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
