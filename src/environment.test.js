import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEnvironment } from './environment.js';
import { LEVELS } from './journey.js';

function named(root, name) {
  let match;
  root.traverse((object) => {
    if (object.name === name) match = object;
  });
  return match;
}

function snapshot(object) {
  return {
    position: object.position.toArray(),
    rotation: object.rotation.toArray(),
    scale: object.scale.toArray(),
  };
}

describe('Hormuz procedural environment', () => {
  it('animates the named boat pennant as a local component', () => {
    const scene = new THREE.Scene();
    const environment = createEnvironment(scene);
    const pennant = named(environment.root, 'Boat pennant');

    expect(pennant).toBeDefined();
    const baseline = snapshot(pennant);
    environment.update(0);
    expect(snapshot(pennant)).toEqual(baseline);

    environment.update(2.5);
    expect(pennant.rotation.z).not.toBeCloseTo(baseline.rotation[2], 6);
    environment.dispose();
  });

  it('gives the foreground boat a readable gentle bob without moving the island', () => {
    const environment = createEnvironment(new THREE.Scene());
    const boat = named(environment.root, 'Small turquoise fishing boat');
    const rootBaseline = snapshot(environment.root);
    const boatBaseline = snapshot(boat);
    environment.update(1.5);
    expect(Math.abs(boat.position.y - boatBaseline.position[1])).toBeGreaterThan(0.07);
    expect(Math.abs(boat.position.y - boatBaseline.position[1])).toBeLessThan(0.1);
    expect(Math.abs(boat.rotation.z)).toBeGreaterThan(0.04);
    expect(snapshot(environment.root)).toEqual(rootBaseline);
    environment.dispose();
  });

  it('uses absolute time without drift and restores every animated component at zero', () => {
    const environment = createEnvironment(new THREE.Scene());
    const components = ['Small turquoise fishing boat', 'Boat pennant', ...Array.from({ length: 4 }, (_, i) => `Soft shore foam ${i}`)]
      .map((name) => named(environment.root, name));
    const sample = () => components.map((object) => ({ ...snapshot(object), opacity: object.material?.opacity }));
    const baseline = sample();
    environment.update(4.25);
    const first = sample();
    environment.update(9.75);
    for (let i = 0; i < 100; i += 1) environment.update(4.25);
    expect(sample()).toEqual(first);
    environment.update(0);
    expect(sample()).toEqual(baseline);
    environment.update(Infinity);
    expect(sample()).toEqual(baseline);
    environment.dispose();
  });

  it('gives the foreground hull contrasting dark gunwales without widening its footprint', () => {
    const environment = createEnvironment(new THREE.Scene());
    const boat = named(environment.root, 'Small turquoise fishing boat');
    const rails = boat.children.filter((object) => object.name === 'Dark boat gunwale');
    expect(rails).toHaveLength(2);
    for (const rail of rails) {
      expect(rail.material.color.getHexString()).toBe('0f5f6b');
      expect(Math.abs(rail.position.x) + rail.geometry.parameters.width / 2).toBeLessThan(0.46);
    }
    environment.dispose();
  });

  it('breaks up mineral seams while preserving the original top and bottom elevations', () => {
    const environment = createEnvironment(new THREE.Scene());
    const upperCliff = named(environment.root, 'Coastal cliff stratum 1');
    const positions = upperCliff.geometry.attributes.position;
    const lowerHeights = [];
    for (let i = 0; i < positions.count; i += 1) {
      const y = positions.getY(i);
      if (y < -0.5) lowerHeights.push(y);
      else expect(y).toBeCloseTo(-0.35, 6);
    }
    expect(Math.max(...lowerHeights) - Math.min(...lowerHeights)).toBeGreaterThan(0.1);
    const bottom = new THREE.Box3().setFromObject(named(environment.root, 'Coastal cliff stratum 7'));
    expect(bottom.min.y).toBeCloseTo(-3.4, 6);
    environment.dispose();
  });

  it('carries a pale salt seam through red mineral ridges without additional meshes', () => {
    const environment = createEnvironment(new THREE.Scene());
    const redRidge = named(environment.root, 'Mineral ridge 1');
    const colors = redRidge.geometry.attributes.color;
    // Each band has seven six-vertex quads. Inspect the second band.
    const seam = new THREE.Color().fromBufferAttribute(colors, 7 * 6);
    expect(seam.r).toBeGreaterThan(0.7);
    expect(seam.g / seam.r).toBeGreaterThan(0.7);
    expect(seam.b / seam.r).toBeGreaterThan(0.5);
    environment.dispose();
  });

  it('keeps scenery below every playable surface and every wall clearance', () => {
    const environment = createEnvironment(new THREE.Scene());
    environment.update(2.5);
    environment.root.updateMatrixWorld(true);
    const scenery = [];
    environment.root.traverse((object) => { if (object.isMesh) scenery.push(object); });
    for (const level of LEVELS.filter((entry) => entry.available)) {
      const polygon = new THREE.Shape(level.outline.map(([x, z]) => new THREE.Vector2(x, z)));
      const points = polygon.getPoints().slice(0, -1);
      const triangles = THREE.ShapeUtils.triangulateShape(points, []);
      const samples = [];
      for (let x = -7.6; x <= 7.6; x += 0.4) {
        for (let z = -5.8; z <= 6.8; z += 0.4) {
          // Raycast the level's actual polygon rather than its enclosing rectangle.
          const probe = new THREE.Vector2(x, z);
          if (triangles.some(([a, b, c]) => THREE.Triangle.containsPoint(
            new THREE.Vector3(probe.x, probe.y, 0),
            new THREE.Vector3(points[a].x, points[a].y, 0),
            new THREE.Vector3(points[b].x, points[b].y, 0),
            new THREE.Vector3(points[c].x, points[c].y, 0),
          ))) samples.push([x, z]);
        }
      }
      for (const [x, z] of samples) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, 8, z), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObjects(scenery)[0];
        expect(hit?.point.y ?? -Infinity, `level ${level.id}: scenery at ${x},${z}`).toBeLessThan(0);
      }
      for (const [x, z, width, depth] of level.walls) {
        const clearance = new THREE.Box3(
          new THREE.Vector3(x - width / 2 - 0.05, 0, z - depth / 2 - 0.05),
          new THREE.Vector3(x + width / 2 + 0.05, 8, z + depth / 2 + 0.05),
        );
        for (const object of scenery) {
          expect(clearance.intersectsBox(new THREE.Box3().setFromObject(object)), `level ${level.id}: ${object.name} wall clearance`).toBe(false);
        }
      }
    }
    environment.dispose();
  });

  it('keeps resource and geometry growth small while reusing cached materials', () => {
    const environment = createEnvironment(new THREE.Scene());
    const meshes = [];
    environment.root.traverse((object) => { if (object.isMesh) meshes.push(object); });
    expect(meshes.length).toBeLessThanOrEqual(186);
    const triangles = meshes.reduce((total, object) => total + (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3, 0);
    expect(triangles).toBeLessThan(5800);
    expect(new Set(meshes.map((object) => object.material)).size).toBeLessThan(55);
    const benches = meshes.filter((object) => object.name === 'Boat bench');
    expect(benches[0].material).toBe(benches[1].material);
    environment.dispose();
  });

  it('shares only identical jetty board geometry within each environment without changing its rendering', () => {
    const environment = createEnvironment(new THREE.Scene());
    const second = createEnvironment(new THREE.Scene());
    const boards = named(environment.root, 'Shaded waterfront jetty').children
      .filter((object) => object.name === 'Jetty deck board');
    const expected = new THREE.BoxGeometry(1.8, 0.09, 0.18);
    try {
      expect(boards).toHaveLength(16);
      expect(new Set(boards.map((board) => board.geometry)).size).toBe(1);
      expect(boards[0].geometry).not.toBe(named(second.root, 'Jetty deck board').geometry);
      expect(boards[0].geometry).not.toBe(named(environment.root, 'Bridge plank').geometry);
      for (const [i, board] of boards.entries()) {
        expect(board.geometry.attributes).toEqual(expected.attributes);
        expect(board.geometry.index).toEqual(expected.index);
        expect(board.geometry.groups).toEqual(expected.groups);
        expect(board.geometry.parameters).toEqual(expected.parameters);
        expect(snapshot(board)).toEqual({
          position: [0, 0, -0.1 + i * 0.2], rotation: [0, 0, 0, 'XYZ'], scale: [1, 1, 1],
        });
        expect(board.material.color.getHexString()).toBe(i % 3 ? 'ac8055' : 'c59868');
        expect(board.material).toBe(boards[i % 3 ? 1 : 0].material);
        expect(board.castShadow).toBe(true);
        expect(board.receiveShadow).toBe(true);
      }
      const attributes = boards[0].geometry.attributes.position.array.slice();
      environment.update(7.4);
      environment.update(0);
      expect(boards[0].geometry.attributes.position.array).toEqual(attributes);
    } finally {
      environment.dispose();
      second.dispose();
      expected.dispose();
    }
  });

  it('disposes owned resources once and leaves foreign scene resources alone', () => {
    const scene = new THREE.Scene();
    const foreign = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    scene.add(foreign);
    let foreignDisposals = 0;
    foreign.geometry.addEventListener('dispose', () => { foreignDisposals += 1; });
    foreign.material.addEventListener('dispose', () => { foreignDisposals += 1; });

    const environment = createEnvironment(scene);
    const owned = [];
    environment.root.traverse((object) => {
      if (object.isMesh) owned.push(object.geometry, object.material);
    });
    const disposals = new Map(owned.map((resource) => [resource, 0]));
    disposals.forEach((_, resource) => resource.addEventListener('dispose', () => {
      disposals.set(resource, disposals.get(resource) + 1);
    }));

    environment.dispose();
    environment.dispose();
    environment.update(2);

    expect([...disposals.values()].every((count) => count === 1)).toBe(true);
    expect(foreign.parent).toBe(scene);
    expect(foreignDisposals).toBe(0);
    foreign.geometry.dispose();
    foreign.material.dispose();
  });
});
