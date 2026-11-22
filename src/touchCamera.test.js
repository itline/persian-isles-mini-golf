import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { touchCourseView } from './cameraView.js';
import { LEVELS } from './journey.js';

describe('touch course framing', () => {
  for (const [width, height] of [[320, 568], [390, 844], [667, 375], [844, 390]]) {
    for (const level of LEVELS.filter((level) => level.available)) {
      it(`fits the whole playable outline of hole ${level.id} at ${width}x${height}`, () => {
        const view = touchCourseView({ width, height, coarsePointer: true, outline: level.outline, angle: .62 });
        const camera = new THREE.OrthographicCamera(-view.scale * width / height, view.scale * width / height, view.scale + view.shift, -view.scale + view.shift, .1, 200);
        const target = new THREE.Vector3(view.x, 0, view.z);
        camera.position.copy(target).add(new THREE.Vector3(Math.sin(.62) * 37, 37 * .87, Math.cos(.62) * 37));
        camera.lookAt(target);
        camera.updateMatrixWorld();
        for (const [x, z] of level.outline) {
          const p = new THREE.Vector3(x, .11, z).project(camera);
          const px = (p.x + 1) * width / 2, py = (1 - p.y) * height / 2;
          expect(px).toBeGreaterThanOrEqual(20);
          expect(px).toBeLessThanOrEqual(width - 20);
          expect(py).toBeGreaterThanOrEqual(height > width ? 110 : 90);
          expect(py).toBeLessThanOrEqual(height - (height > width ? 130 : 85));
        }
      });
    }
  }
  it('does not change fine pointers or large touch displays', () => {
    const outline = LEVELS[0].outline;
    expect(touchCourseView({ width: 390, height: 844, coarsePointer: false, outline, angle: .62 })).toBeNull();
    expect(touchCourseView({ width: 1440, height: 900, coarsePointer: true, outline, angle: .62 })).toBeNull();
  });
});
