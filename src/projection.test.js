import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { projectedBounds, screenAnchorToPlane } from './projection.js';

describe('scene-to-viewport projection', () => {
  it('projects all eight world bounds corners without mutating the object', () => {
    const camera = new THREE.OrthographicCamera(-10, 10, 5, -5, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const object = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    const before = object.position.clone();
    const bounds = projectedBounds(object, camera, 1000, 500);
    expect(bounds).toEqual({ x: 450, y: 200, width: 100, height: 100 });
    expect(object.position.equals(before)).toBe(true);
    object.geometry.dispose();
    object.material.dispose();
  });

  it('returns the existing water-plane intersection and null for a parallel ray', () => {
    const camera = new THREE.OrthographicCamera(-10, 10, 5, -5, 0.1, 100);
    camera.position.set(0, 10, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const ray = new THREE.Raycaster(),
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 3.65);
    const point = screenAnchorToPlane(
      0.5,
      0.5,
      900,
      camera,
      ray,
      plane,
      new THREE.Vector2(),
      new THREE.Vector3(),
    );
    expect(point.x).toBeCloseTo(0);
    expect(point.y).toBeCloseTo(-3.65);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    expect(
      screenAnchorToPlane(
        0.5,
        0.5,
        900,
        camera,
        ray,
        plane,
        new THREE.Vector2(),
        new THREE.Vector3(),
      ),
    ).toBeNull();
  });
});
