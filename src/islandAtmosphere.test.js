import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { createIslandAtmosphere, islandSceneProfile } from './islandAtmosphere.js';
const ISLANDS = ['hormuz', 'qeshm', 'kish', 'khark', 'hengam'];

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

describe('island-specific distant atmosphere', () => {
  it('returns distinct, bounded vessel profiles for every island and viewport', () => {
    expect(islandSceneProfile).toBeTypeOf('function');
    const profiles = ISLANDS.flatMap((id) => [false, true].map((portrait) => ({
      id,
      portrait,
      profile: islandSceneProfile(id, portrait),
    })));
    for (const { id, portrait, profile } of profiles) {
      expect(profile).toEqual({
        anchors: expect.any(Array),
        yaws: expect.any(Array),
        widths: expect.any(Array),
        kinds: expect.any(Array),
      });
      expect(profile.anchors).toHaveLength(2);
      expect(profile.yaws).toHaveLength(profile.anchors.length);
      expect(profile.widths).toHaveLength(profile.anchors.length);
      expect(profile.anchors.flat()).toSatisfy((values) => values.every((value) => Number.isFinite(value) && value >= 0 && value <= 1));
      expect(profile.widths).toSatisfy((widths) => widths.every((width) => width >= (portrait ? 14 : 25) && width <= (portrait ? 24 : 42)));
      expect(profile.anchors.every(([, y]) => portrait ? y < 0.36 : y < 0.90)).toBe(true);
      expect(Math.abs(profile.anchors[0][0]-profile.anchors[1][0])).toBeGreaterThan(0.4);
      expect(profile.kinds).toEqual({hormuz:['lenj','cargo'],qeshm:['lenj','cargo'],kish:['passenger','fishing'],khark:['tanker','cargo'],hengam:['fishing','lenj']}[id]);
      expect(() => islandSceneProfile(id, portrait)).not.toThrow();
    }
    const signatures = profiles.map(({ profile }) => JSON.stringify(profile));
    expect(new Set(signatures).size).toBe(ISLANDS.length * 2);
    expect(() => islandSceneProfile('atlantis', false)).toThrow(RangeError);
  });

  it('keeps compact landscape placements beside the left-hand selection rail', () => {
    for(const id of ISLANDS){
      const profile=islandSceneProfile(id,false,true);
      expect(profile.anchors[0][0]).toBeGreaterThan(0.43);
      expect(profile.anchors[0][1]).toBeLessThan(0.30);
    }
  });

  it('attaches eight independently placeable non-Hormuz details with an initially quiet Hormuz scene', () => {
    expect(createIslandAtmosphere).toBeTypeOf('function');
    const parent = new THREE.Group();
    const atmosphere = createIslandAtmosphere(parent);
    expect(atmosphere.root.isGroup).toBe(true);
    expect(atmosphere.root.parent).toBe(parent);
    expect(atmosphere.details).toHaveLength(8);
    expect(atmosphere.details).toEqual(atmosphere.root.children);
    expect(atmosphere.setIsland).toBeTypeOf('function');
    expect(atmosphere.update).toBeTypeOf('function');
    expect(atmosphere.dispose).toBeTypeOf('function');
    for (const id of ISLANDS.slice(1)) {
      expect(atmosphere.details.filter((detail) => detail.userData.islandId === id)).toHaveLength(2);
    }
    for (const detail of atmosphere.details) {
      expect(detail.isGroup).toBe(true);
      expect(detail.position.toArray()).toEqual([0, 0, 0]);
      expect(detail.visible).toBe(false);
      expect(meshes(detail).length).toBeGreaterThan(0);
    }
    atmosphere.dispose();
  });

  it('selects only the two matching details, leaving Hormuz to its existing stacks', () => {
    const atmosphere = createIslandAtmosphere(new THREE.Scene());
    for (const id of [...ISLANDS, 'qeshm', 'hormuz', 'kish']) {
      atmosphere.setIsland(id);
      expect(atmosphere.details.filter((detail) => detail.visible)).toHaveLength(id === 'hormuz' ? 0 : 2);
      for (const detail of atmosphere.details) {
        expect(detail.visible).toBe(detail.userData.islandId === id);
      }
    }
    expect(() => atmosphere.setIsland('atlantis')).toThrow(RangeError);
    expect(atmosphere.details.filter((detail) => detail.visible).every((detail) => detail.userData.islandId === 'kish')).toBe(true);
    atmosphere.dispose();
  });

  it('provides separate, small rocklet placement away from boats, panels and island center', () => {
    const atmosphere = createIslandAtmosphere(new THREE.Scene());
    for (const detail of atmosphere.details) {
      expect(detail.userData.anchors).toEqual({ landscape: expect.any(Array), portrait: expect.any(Array) });
      expect(detail.userData.widthPx).toEqual({ landscape: expect.any(Number), portrait: expect.any(Number) });
      for (const portrait of [false, true]) {
        const mode = portrait ? 'portrait' : 'landscape';
        const [x, y] = detail.userData.anchors[mode];
        const width = detail.userData.widthPx[mode];
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(width).toBeGreaterThanOrEqual(portrait ? 14 : 25);
        expect(width).toBeLessThanOrEqual(portrait ? 24 : 42);
        expect(x).toBeGreaterThanOrEqual(portrait ? 0.08 : 0.30);
        expect(x).toBeLessThanOrEqual(0.94);
        expect(y).toBeGreaterThanOrEqual(0.15);
        expect(y).toBeLessThanOrEqual(portrait ? 0.40 : 0.84);
        expect(portrait ? x < 0.25 || x > 0.78 : x >= 0.30).toBe(true);
        for (const boat of islandSceneProfile(detail.userData.islandId, portrait).anchors) {
          expect(Math.hypot(x - boat[0], y - boat[1])).toBeGreaterThan(0.085);
        }
      }
    }
    atmosphere.dispose();
  });
  it('rejects non-Three parents before allocating or attaching resources', () => {
    for (const parent of [undefined, null, {}, { add: true }]) {
      expect(() => createIslandAtmosphere(parent)).toThrowError('createIslandAtmosphere requires a Three.js parent');
    }
  });

  it('preserves parent placement and finite deterministic reduced-motion baselines for every timestamp', () => {
    const atmosphere = createIslandAtmosphere(new THREE.Scene());
    atmosphere.root.position.set(2, -3.65, 5);
    atmosphere.root.rotation.y = 0.18;
    atmosphere.details.forEach((detail, index) => {
      detail.position.set(index * 2, -3.65, -index);
      detail.rotation.y = index * 0.1;
      detail.scale.setScalar(0.7);
    });
    const before = snapshot(atmosphere.root);
    for (const time of [0, 1, -3, 1042, NaN, Infinity, -Infinity, Number.MAX_VALUE, undefined, 0, 0]) {
      atmosphere.update(time);
      expect(snapshot(atmosphere.root)).toEqual(before);
    }
    atmosphere.setIsland('khark');
    atmosphere.setIsland('khark');
    expect(snapshot(atmosphere.root)).toEqual(before);
    atmosphere.dispose();
  });

  it('returns independent vessel profiles that consumers can alter without poisoning later calls', () => {
    for (const id of ISLANDS) {
      const expected = islandSceneProfile(id, true);
      const profile = islandSceneProfile(id, true);
      profile.anchors[0][0] = 99;
      profile.yaws[0] = 99;
      profile.widths.pop();
      expect(islandSceneProfile(id, true)).toEqual(expected);
    }
    for (const id of [undefined, null, '', 'constructor', '__proto__']) {
      expect(() => islandSceneProfile(id)).toThrow(RangeError);
    }
  });

  it('disposes owned shared resources exactly once without affecting siblings or allowing resurrection', () => {
    const parent = new THREE.Scene();
    const sibling = new THREE.Group();
    parent.add(sibling);
    const atmosphere = createIslandAtmosphere(parent);
    atmosphere.setIsland('qeshm');
    const objects = meshes(atmosphere.root);
    const resources = new Set(objects.flatMap((mesh) => [mesh.geometry, mesh.material]));
    const counts = new Map([...resources].map((resource) => [resource, 0]));
    resources.forEach((resource) => resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1)));
    const before = snapshot(atmosphere.root);
    const visibility = atmosphere.details.map((detail) => detail.visible);
    atmosphere.dispose();
    expect(atmosphere.root.parent).toBeNull();
    expect(parent.children).toEqual([sibling]);
    atmosphere.dispose();
    atmosphere.update(Number.MAX_VALUE);
    atmosphere.setIsland('kish');
    expect([...counts.values()]).toEqual([...resources].map(() => 1));
    expect(snapshot(atmosphere.root)).toEqual(before);
    expect(atmosphere.details.map((detail) => detail.visible)).toEqual(visibility);
  });

  it('uses low grounded silhouettes with island-specific natural strata within the full resource budget', () => {
    const atmosphere = createIslandAtmosphere(new THREE.Scene());
    const allMeshes = meshes(atmosphere.root);
    expect(allMeshes.length).toBeLessThanOrEqual(20);
    const triangles = allMeshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
    expect(triangles).toBeLessThan(1200);
    expect(new Set(allMeshes.map((mesh) => mesh.geometry)).size).toBeLessThan(allMeshes.length);
    expect(new Set(allMeshes.map((mesh) => mesh.material)).size).toBeLessThan(allMeshes.length);
    const styleSignatures = new Set();
    for (const id of ISLANDS.slice(1)) {
      const details = atmosphere.details.filter((detail) => detail.userData.islandId === id);
      styleSignatures.add(JSON.stringify(details.map((detail) => meshes(detail).map((mesh) => [mesh.scale.toArray(), mesh.material.color.getHexString()]))));
      for (const detail of details) {
        const box = new THREE.Box3().setFromObject(detail);
        const size = box.getSize(new THREE.Vector3());
        expect(box.min.y).toBeLessThan(0);
        expect(box.max.y).toBeGreaterThan(0.05);
        expect(size.y / size.x).toBeLessThan(0.36);
        expect(size.x).toBeGreaterThan(1);
        expect(size.x).toBeLessThanOrEqual(2.1);
        if (id === 'qeshm') expect(meshes(detail).length).toBeGreaterThanOrEqual(3);
      }
    }
    expect(styleSignatures.size).toBe(4);
    for (const mesh of allMeshes) {
      expect(mesh.castShadow).toBe(false);
      expect(mesh.receiveShadow).toBe(false);
      expect(mesh.material.isMeshStandardMaterial).toBe(true);
      expect(mesh.material.roughness).toBeGreaterThanOrEqual(0.9);
      expect(mesh.material.metalness).toBe(0);
      expect(Object.values(mesh.material).some((value) => value?.isTexture)).toBe(false);
    }
    atmosphere.dispose();
  });
});
