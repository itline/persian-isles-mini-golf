import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createDistantFleet } from './distantFleet.js';

function meshes(root) {
  const result = [];
  root.traverse((object) => { if (object.isMesh) result.push(object); });
  return result;
}

function snapshot(root) {
  const result = [];
  root.traverse((object) => result.push({
    name: object.name,
    position: object.position.toArray(),
    rotation: object.rotation.toArray(),
    scale: object.scale.toArray(),
    vertices: object.isMesh ? Array.from(object.geometry.attributes.position.array) : [],
  }));
  return result;
}

describe('sparse distant fleet', () => {
  it('attaches exactly six independently positionable vessel anchors with compact silhouettes', () => {
    const parent = new THREE.Group();
    const fleet = createDistantFleet(parent);
    expect(fleet.root.isGroup).toBe(true);
    expect(fleet.root.parent).toBe(parent);
    expect(fleet.update).toBeTypeOf('function');
    expect(fleet.dispose).toBeTypeOf('function');
    expect(fleet.boats).toEqual(fleet.root.children);
    expect(fleet.boats).toHaveLength(6);
    expect(fleet.boats.map((boat) => boat.userData.kind)).toEqual(['fishing', 'lenj', 'fishing', 'cargo', 'tanker', 'passenger']);
    expect(fleet.boats.slice(0, 3).map((boat) => boat.position.toArray())).toEqual([[-3, 0, 0], [0, 0, 0], [4, 0, 0]]);
    expect(fleet.boats.slice(0, 3).map((boat) => boat.name)).toEqual(['Distant fishing boat 1', 'Distant Iranian lenj', 'Distant fishing boat 2']);
    expect(fleet.root.getObjectByName('Lenj raised bow')).toBeTruthy();
    expect(fleet.root.getObjectByName('Lenj cabin')).toBeTruthy();
    expect(fleet.root.getObjectByName('Lenj mast')).toBeTruthy();
    for (const boat of fleet.boats) {
      const bounds = new THREE.Box3().setFromObject(boat);
      const size = bounds.getSize(new THREE.Vector3());
      expect(size.x).toBeGreaterThan(0.7);
      expect(size.x).toBeLessThanOrEqual(2);
      expect(size.y).toBeGreaterThan(0.3);
      expect(size.y).toBeLessThanOrEqual(1.5);
      expect(size.z).toBeLessThanOrEqual(0.7);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.15);
    }
    const bounds = new THREE.Box3().setFromObject(fleet.root);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-4);
    expect(bounds.max.x).toBeLessThanOrEqual(5);
    fleet.dispose();
  });

  it('appends a kind-tagged cargo ship with muted container stacks and an aft bridge', () => {
    const fleet = createDistantFleet(new THREE.Scene());
    expect(fleet.boats.slice(0, 4).map((boat) => boat.userData.kind)).toEqual(['fishing', 'lenj', 'fishing', 'cargo']);
    const cargo = fleet.boats[3];
    const containers = meshes(cargo).filter((object) => object.name.startsWith('Cargo container '));
    expect(containers.length).toBeGreaterThanOrEqual(4);
    const containerBounds = new THREE.Box3();
    for (const container of containers) {
      containerBounds.union(new THREE.Box3().setFromObject(container));
      expect(container.geometry).toBe(fleet.root.getObjectByName('Fishing boat ivory deck').geometry);
    }
    expect(containerBounds.getSize(new THREE.Vector3()).x).toBeGreaterThan(0.8);
    expect(new Set(containers.map((object) => object.material.color.getHex())).size).toBeGreaterThanOrEqual(2);
    expect(cargo.getObjectByName('Cargo aft bridge').position.x).toBeLessThan(containerBounds.min.x);
    expect(cargo.getObjectByName('Cargo hull').geometry).toBe(fleet.root.getObjectByName('Fishing boat hull').geometry);
    fleet.dispose();
  });

  it('appends a low tanker with long deck pipes and a compact manifold, not container stacks', () => {
    const fleet = createDistantFleet(new THREE.Scene());
    const tanker = fleet.boats[4];
    expect(tanker?.userData.kind).toBe('tanker');
    const deck = tanker.getObjectByName('Tanker long deck');
    const pipes = meshes(tanker).filter((object) => object.name.startsWith('Tanker deck pipe '));
    expect(deck.scale.x).toBeGreaterThan(1.3);
    expect(pipes).toHaveLength(2);
    for (const pipe of pipes) {
      expect(pipe.scale.x).toBeGreaterThan(1);
      expect(pipe.scale.y).toBeLessThan(0.06);
      expect(pipe.position.y).toBeLessThan(0.4);
      expect(pipe.geometry).toBe(deck.geometry);
    }
    const manifold = tanker.getObjectByName('Tanker manifold');
    expect(manifold.scale.x).toBeLessThan(0.3);
    expect(manifold.scale.y).toBeLessThan(0.15);
    expect(new THREE.Box3().setFromObject(tanker).max.y).toBeLessThan(0.75);
    expect(meshes(tanker).some((object) => object.name.includes('container'))).toBe(false);
    expect(tanker.getObjectByName('Tanker hull').geometry).toBe(fleet.root.getObjectByName('Cargo hull').geometry);
    fleet.dispose();
  });

  it('appends a pale passenger cabin with dark window strips on both sides and a forward wheelhouse', () => {
    const fleet = createDistantFleet(new THREE.Scene());
    const passenger = fleet.boats[5];
    expect(passenger?.userData.kind).toBe('passenger');
    const cabin = passenger.getObjectByName('Passenger pale cabin');
    const windows = meshes(passenger).filter((object) => object.name.startsWith('Passenger window strip '));
    expect(cabin.material.color.getHSL({}).l).toBeGreaterThan(0.65);
    expect(cabin.scale.x).toBeGreaterThan(0.9);
    expect(windows).toHaveLength(2);
    expect(windows.map((object) => Math.sign(object.position.z)).sort()).toEqual([-1, 1]);
    for (const strip of windows) {
      expect(strip.scale.x).toBeGreaterThan(0.8);
      expect(strip.scale.y).toBeLessThan(0.12);
      expect(Math.abs(strip.position.z)).toBeGreaterThan(cabin.scale.z / 2);
      expect(strip.material.color.getHSL({}).l).toBeLessThan(0.3);
      expect(strip.geometry).toBe(cabin.geometry);
    }
    expect(passenger.getObjectByName('Passenger forward wheelhouse').position.x).toBeGreaterThan(0);
    expect(passenger.getObjectByName('Passenger hull').geometry).toBe(fleet.root.getObjectByName('Cargo hull').geometry);
    fleet.dispose();
  });

  it('bobs only nested silhouettes while preserving caller-owned root and boat transforms', () => {
    const fleet = createDistantFleet(new THREE.Scene());
    fleet.root.position.set(12, -4, 5);
    fleet.root.rotation.set(0.2, 0.4, -0.1);
    fleet.root.scale.setScalar(0.7);
    fleet.boats.forEach((boat, index) => {
      boat.position.set(index * 2, index - 3, -index);
      boat.rotation.set(0.1, index * 0.3, 0.05);
      boat.scale.setScalar(0.8 + index * 0.1);
    });
    const anchors = [fleet.root, ...fleet.boats];
    const transforms = () => anchors.map((object) => [object.position.toArray(), object.rotation.toArray(), object.scale.toArray()]);
    const callerBaseline = transforms();
    const baseline = snapshot(fleet.root);
    fleet.update(1.75);
    expect(snapshot(fleet.root)).not.toEqual(baseline);
    expect(transforms()).toEqual(callerBaseline);
    const expected = snapshot(fleet.root);
    for (const time of [9, -8, 1e6, 1.75, 1.75]) fleet.update(time);
    expect(snapshot(fleet.root)).toEqual(expected);
    fleet.update(0);
    expect(snapshot(fleet.root)).toEqual(baseline);
    fleet.dispose();
  });

  it('uses deterministic, finite geometry and bounded motion, with invalid time returning to rest', () => {
    const fleet = createDistantFleet(new THREE.Scene());
    const other = createDistantFleet(new THREE.Scene());
    const baseline = snapshot(fleet.root);
    expect(snapshot(other.root)).toEqual(baseline);
    for (const time of [-1e308, -20, 0, 0.001, 1.5, 5, 90, 1e308]) {
      fleet.update(time);
      fleet.root.traverse((object) => {
        expect([...object.position, ...object.quaternion, ...object.scale].every(Number.isFinite)).toBe(true);
        if (object.isMesh) expect(Array.from(object.geometry.attributes.position.array).every(Number.isFinite)).toBe(true);
      });
      for (const boat of fleet.boats) {
        const bob = boat.children[0];
        expect(Math.abs(bob.position.y)).toBeLessThanOrEqual(0.035);
        expect(Math.abs(bob.position.z)).toBeLessThanOrEqual(0.012);
        expect(Math.abs(bob.rotation.z)).toBeLessThanOrEqual(0.012);
      }
    }
    for (const invalid of [NaN, Infinity, -Infinity, undefined, null, '2']) {
      fleet.update(1);
      fleet.update(invalid);
      expect(snapshot(fleet.root)).toEqual(baseline);
    }
    fleet.dispose();
    other.dispose();
  });

  it('has outward hull faces so single-sided wood remains visible from outside', () => {
    const fleet = createDistantFleet(new THREE.Scene());
    const hull = fleet.root.getObjectByName('Lenj broad wooden hull').geometry;
    const positions = hull.attributes.position;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const center = new THREE.Vector3(0, 0.11, 0);
    for (let index = 0; index < hull.index.count; index += 3) {
      a.fromBufferAttribute(positions, hull.index.getX(index));
      b.fromBufferAttribute(positions, hull.index.getX(index + 1));
      c.fromBufferAttribute(positions, hull.index.getX(index + 2));
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      const outward = a.clone().add(b).add(c).divideScalar(3).sub(center);
      expect(normal.dot(outward)).toBeGreaterThan(0);
    }
    fleet.dispose();
  });

  it('stays under the mesh/triangle budget with shared, untextured, shadow-free resources', () => {
    const fleet = createDistantFleet(new THREE.Scene());
    const objects = meshes(fleet.root);
    // Six available vessels; the caller displays only two at a time.
    expect(objects.length).toBeLessThanOrEqual(50);
    expect(objects.length).toBeGreaterThan(0);
    const triangles = objects.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
    expect(triangles).toBeLessThan(1000);
    expect(new Set(objects.map((mesh) => mesh.geometry)).size).toBe(3);
    expect(new Set(objects.map((mesh) => mesh.material)).size).toBeLessThan(objects.length);
    for (const first of fleet.boats) {
      for (const second of fleet.boats) {
        if (first === second) continue;
        const visible = [...meshes(first), ...meshes(second)];
        expect(visible.length).toBeLessThanOrEqual(25);
        const visibleTriangles = visible.reduce((sum, object) => sum + object.geometry.index.count / 3, 0);
        expect(visibleTriangles).toBeLessThan(500);
      }
    }
    const materialByColor = new Map();
    for (const object of objects) {
      const color = object.material.color.getHex();
      if (materialByColor.has(color)) expect(object.material).toBe(materialByColor.get(color));
      materialByColor.set(color, object.material);
      expect(object.castShadow).toBe(false);
      expect(object.receiveShadow).toBe(false);
      expect(object.material.isMeshStandardMaterial).toBe(true);
      expect(Object.values(object.material).some((value) => value?.isTexture)).toBe(false);
      expect(object.material.metalness).toBe(0);
      expect(object.material.roughness).toBeGreaterThan(0.8);
      const hsl = object.material.color.getHSL({});
      expect(hsl.s).toBeLessThan(0.65);
      expect(hsl.h).toBeGreaterThan(0);
      expect(hsl.h).toBeLessThan(0.2);
    }
    fleet.dispose();
  });

  it('releases each owned resource exactly once without disposing siblings or another fleet', () => {
    const parent = new THREE.Scene();
    const fleet = createDistantFleet(parent);
    const other = createDistantFleet(parent);
    const sibling = new THREE.Group();
    parent.add(sibling);
    const ownResources = new Set(meshes(fleet.root).flatMap((mesh) => [mesh.geometry, mesh.material]));
    const otherResources = new Set(meshes(other.root).flatMap((mesh) => [mesh.geometry, mesh.material]));
    const calls = new Map([...ownResources, ...otherResources].map((resource) => [resource, 0]));
    for (const resource of calls.keys()) resource.addEventListener('dispose', () => calls.set(resource, calls.get(resource) + 1));
    fleet.dispose();
    const disposedSnapshot = snapshot(fleet.root);
    expect(fleet.root.parent).toBeNull();
    expect(parent.children).toEqual([other.root, sibling]);
    expect(() => { fleet.dispose(); fleet.update(5); fleet.update(NaN); }).not.toThrow();
    expect(snapshot(fleet.root)).toEqual(disposedSnapshot);
    for (const resource of ownResources) expect(calls.get(resource)).toBe(1);
    for (const resource of otherResources) expect(calls.get(resource)).toBe(0);
    other.dispose();
  });
});
