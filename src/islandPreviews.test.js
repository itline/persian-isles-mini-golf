import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createIslandPreview } from './islandPreviews.js';

const ids = ['qeshm', 'kish', 'khark', 'hengam'];

function meshes(root) {
  const result = [];
  root.traverse((object) => { if (object.isMesh) result.push(object); });
  return result;
}

function snapshot(root) {
  const result = [];
  root.traverse((object) => {
    result.push({
      name: object.name,
      position: object.position.toArray(),
      rotation: object.rotation.toArray(),
      scale: object.scale.toArray(),
      vertices: object.isMesh ? Array.from(object.geometry.attributes.position.array) : [],
    });
  });
  return result;
}

describe('island preview lifecycle', () => {
  it('restores every local object and vertex to its construction baseline at zero', () => {
    for (const id of ids) {
      const preview = createIslandPreview(new THREE.Scene(), id);
      const baseline = snapshot(preview.root);
      preview.update(7.4);
      preview.update(0);
      expect(snapshot(preview.root), id).toEqual(baseline);
      preview.dispose();
    }
  });

  it('is independent of update order and preserves caller-owned root transforms', () => {
    for (const id of ids) {
      const preview = createIslandPreview(new THREE.Scene(), id);
      preview.root.position.set(3, 4, -2);
      preview.root.rotation.set(0.1, 0.4, -0.2);
      preview.root.scale.setScalar(0.7);
      const rootBaseline = snapshot(preview.root)[0];
      preview.update(2.6);
      const expected = snapshot(preview.root);
      for (const time of [9, -8, 1000000, 0, 2.6, 2.6]) preview.update(time);
      expect(snapshot(preview.root), id).toEqual(expected);
      expect(snapshot(preview.root)[0], id).toEqual(rootBaseline);
      preview.dispose();
    }
  });

  it('keeps motion finite for extreme finite times and uses zero for invalid times', () => {
    for (const id of ids) {
      const preview = createIslandPreview(new THREE.Scene(), id);
      const baseline = snapshot(preview.root);
      for (const time of [Number.MAX_VALUE, -Number.MAX_VALUE, 1e20]) {
        preview.update(time);
        for (const object of snapshot(preview.root)) {
          expect([...object.position, ...object.rotation.slice(0, 3), ...object.scale, ...object.vertices].every(Number.isFinite), `${id}: ${object.name}`).toBe(true);
        }
      }
      for (const time of [NaN, Infinity, -Infinity, null, '2']) {
        preview.update(time);
        expect(snapshot(preview.root), id).toEqual(baseline);
      }
      preview.dispose();
    }
  });

  it('shares palm blade geometry within each preview without sharing mutable geometry between callers', () => {
    const first = createIslandPreview(new THREE.Scene(), 'kish');
    const second = createIslandPreview(new THREE.Scene(), 'kish');
    const blades = (preview) => meshes(preview.root).filter((mesh) => mesh.name === 'Swept palm frond');
    expect(new Set(blades(first).map((mesh) => mesh.geometry)).size).toBe(1);
    expect(blades(first)[0].geometry).not.toBe(blades(second)[0].geometry);
    first.dispose();
    second.dispose();
  });

  it('keeps the procedural previews inside mobile mesh and triangle budgets while animating', () => {
    for (const id of ids) {
      const preview = createIslandPreview(new THREE.Scene(), id);
      const initialMeshes = meshes(preview.root);
      const resources = new Set(initialMeshes.flatMap((mesh) => [mesh.geometry, mesh.material]));
      const triangles = initialMeshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
      expect(initialMeshes.length, id).toBeLessThanOrEqual(100);
      expect(triangles, id).toBeLessThanOrEqual(4000);
      expect(resources.size, id).toBeLessThanOrEqual(100);
      for (const time of [0.2, 1.75, 3.5, 9, 30]) preview.update(time);
      expect(meshes(preview.root), id).toEqual(initialMeshes);
      expect(new Set(meshes(preview.root).flatMap((mesh) => [mesh.geometry, mesh.material])), id).toEqual(resources);
      preview.dispose();
    }
  });

  it('animates four named local island details, not the preview root', () => {
    const details = {
      qeshm: 'Qeshm tidal skiff',
      kish: 'Kish promenade palm 0 wind crown',
      khark: 'Khark lighthouse signal flag',
      hengam: 'Dolphin tail',
    };
    for (const id of ids) {
      const preview = createIslandPreview(new THREE.Scene(), id);
      const detail = preview.root.getObjectByName(details[id]);
      const before = {
        position: detail.position.toArray(),
        rotation: detail.rotation.toArray(),
        vertices: detail.isMesh ? Array.from(detail.geometry.attributes.position.array) : [],
      };
      const rootBefore = [preview.root.position.toArray(), preview.root.rotation.toArray(), preview.root.scale.toArray()];
      preview.update(1.75);
      const after = {
        position: detail.position.toArray(),
        rotation: detail.rotation.toArray(),
        vertices: detail.isMesh ? Array.from(detail.geometry.attributes.position.array) : [],
      };
      expect(after, id).not.toEqual(before);
      expect([preview.root.position.toArray(), preview.root.rotation.toArray(), preview.root.scale.toArray()], id).toEqual(rootBefore);
      preview.dispose();
    }
  });

  it('exports the scene-attached preview interface for the four locked islands', () => {
    for (const id of ids) {
      const scene = new THREE.Scene();
      const preview = createIslandPreview(scene, id);
      expect(preview.root.isGroup).toBe(true);
      expect(preview.root.parent).toBe(scene);
      expect(preview.update).toBeTypeOf('function');
      expect(preview.dispose).toBeTypeOf('function');
      expect(meshes(preview.root).length).toBeGreaterThan(12);
      preview.dispose();
      expect(scene.children).toHaveLength(0);
      preview.dispose();
    }
  });

  it('faces cliff panels outward so every island has continuous visible sides',()=>{
    for(const id of ids){
      const preview=createIslandPreview(new THREE.Scene(),id);const cliffs=meshes(preview.root).filter(m=>m.name.includes('stratum'));
      let outward=0,inward=0;
      for(const cliff of cliffs){const p=cliff.geometry.attributes.position,n=cliff.geometry.attributes.normal;for(let i=0;i<p.count;i+=3){const d=p.getX(i)*n.getX(i)+p.getZ(i)*n.getZ(i);if(d>0)outward++;else if(d<0)inward++;}}
      expect(outward,`${id} outward cliff triangles`).toBeGreaterThan(inward);preview.dispose();
    }
  });

  it('rejects unknown islands instead of silently creating a generic preview', () => {
    expect(() => createIslandPreview(new THREE.Scene(), 'hormuz')).toThrow(/qeshm|kish|khark|hengam/);
  });

  it('keeps silhouettes and material palettes distinct between islands', () => {
    const signatures = ids.map((id) => {
      const scene = new THREE.Scene();
      const preview = createIslandPreview(scene, id);
      const signature = meshes(preview.root).map((mesh) => `${mesh.name}:${mesh.geometry.type}`).join('|');
      preview.dispose();
      return signature;
    });
    expect(new Set(signatures).size).toBe(ids.length);
  });

  it('bounds every solid landmark within the menu island envelope', () => {
    for (const id of ids) {
      const preview = createIslandPreview(new THREE.Scene(), id);
      preview.root.updateMatrixWorld(true);
      for (const mesh of meshes(preview.root)) {
        if (mesh.name === 'Preview sea' || mesh.name.includes('shore foam')) continue;
        const bounds = new THREE.Box3().setFromObject(mesh);
        expect(bounds.min.x, `${id}: ${mesh.name}`).toBeGreaterThanOrEqual(-11.1);
        expect(bounds.max.x, `${id}: ${mesh.name}`).toBeLessThanOrEqual(11.1);
        expect(bounds.min.z, `${id}: ${mesh.name}`).toBeGreaterThanOrEqual(-10.1);
        expect(bounds.max.z, `${id}: ${mesh.name}`).toBeLessThanOrEqual(10.1);
        expect(bounds.max.y, `${id}: ${mesh.name}`).toBeLessThanOrEqual(4.0);
        const attribute = mesh.geometry.getAttribute('position');
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
        expect(mesh.material.flatShading).toBe(true);
      }
      preview.dispose();
    }
  });

  it('is deterministic and leaves scene resources untouched during idempotent disposal', () => {
    for (const id of ids) {
      const scene = new THREE.Scene();
      const foreign = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
      scene.add(foreign);
      let foreignDisposals = 0;
      foreign.geometry.addEventListener('dispose', () => { foreignDisposals += 1; });
      foreign.material.addEventListener('dispose', () => { foreignDisposals += 1; });
      const first = createIslandPreview(scene, id);
      const second = createIslandPreview(scene, id);
      const signature = (preview) => meshes(preview.root).map((mesh) => [mesh.name, Array.from(mesh.geometry.getAttribute('position').array), mesh.position.toArray(), mesh.scale.toArray(), mesh.rotation.toArray(), mesh.material.color.getHexString()]);
      expect(signature(first)).toEqual(signature(second));
      const resources = new Set(meshes(first.root).flatMap((mesh) => [mesh.geometry, mesh.material]));
      const disposals = new Map();
      resources.forEach((resource) => resource.addEventListener('dispose', () => disposals.set(resource, (disposals.get(resource) || 0) + 1)));
      first.dispose();
      first.dispose();
      first.update(1);
      expect([...disposals.values()]).toEqual([...resources].map(() => 1));
      expect(foreignDisposals).toBe(0);
      expect(foreign.parent).toBe(scene);
      expect(second.root.parent).toBe(scene);
      second.dispose();
      foreign.geometry.dispose();
      foreign.material.dispose();
    }
  });

  it('places the Hengam dhow and dolphins in open water, not underneath the island', () => {
    const preview = createIslandPreview(new THREE.Scene(), 'hengam');
    preview.root.updateMatrixWorld(true);
    const land = meshes(preview.root).filter((mesh) => /shore|beach|stratum/.test(mesh.name) && !mesh.name.includes('foam'));
    const watercraft = [];
    preview.root.traverse((object) => { if (/lateen dhow|stylized dolphin/.test(object.name)) watercraft.push(object); });
    expect(watercraft).toHaveLength(3);
    watercraft.forEach((object) => {
      const ray = new THREE.Raycaster(new THREE.Vector3(object.position.x, 8, object.position.z), new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObjects(land).filter((hit) => hit.point.y > -3.5)).toHaveLength(0);
    });
    preview.dispose();
  });

  it('animates watercraft or wildlife without changing the preview contract', () => {
    for (const id of ids) {
      const preview = createIslandPreview(new THREE.Scene(), id);
      const before = meshes(preview.root).map((mesh) => mesh.position.y + mesh.rotation.z);
      preview.update(2.5);
      const after = meshes(preview.root).map((mesh) => mesh.position.y + mesh.rotation.z);
      expect(after.some((value, index) => Math.abs(value - before[index]) > 0.00001)).toBe(true);
      preview.dispose();
    }
  });

  it('swims the Hengam dolphins with local tail strokes and a restorable baseline', () => {
    const preview = createIslandPreview(new THREE.Scene(), 'hengam');
    const dolphin = preview.root.getObjectByName('Hengam stylized dolphin');
    const tail = dolphin.getObjectByName('Dolphin tail');
    const dhow = preview.root.getObjectByName('Hengam lateen dhow');
    const baseline = [dolphin.position.toArray(), dolphin.rotation.toArray(), tail.rotation.toArray(), dhow.position.toArray(), dhow.rotation.toArray()];
    const rootBaseline = [preview.root.position.toArray(), preview.root.rotation.toArray(), preview.root.scale.toArray()];
    preview.update(1.75);
    expect(tail.rotation.toArray()).not.toEqual(baseline[2]);
    expect(dolphin.position.toArray()).not.toEqual(baseline[0]);
    expect([preview.root.position.toArray(), preview.root.rotation.toArray(), preview.root.scale.toArray()]).toEqual(rootBaseline);
    preview.update(0);
    expect([dolphin.position.toArray(), dolphin.rotation.toArray(), tail.rotation.toArray(), dhow.position.toArray(), dhow.rotation.toArray()]).toEqual(baseline);
    preview.dispose();
  });

  it('flutters the Khark signal pennant locally and restores the pilot skiff at zero', () => {
    const preview = createIslandPreview(new THREE.Scene(), 'khark');
    const flag = preview.root.getObjectByName('Khark lighthouse signal flag');
    const boat = preview.root.getObjectByName('Khark pilot skiff');
    const flagBaseline = Array.from(flag.geometry.attributes.position.array);
    const boatBaseline = [boat.position.toArray(), boat.rotation.toArray()];
    const rootBaseline = [preview.root.position.toArray(), preview.root.rotation.toArray(), preview.root.scale.toArray()];
    preview.update(1.75);
    expect(Array.from(flag.geometry.attributes.position.array)).not.toEqual(flagBaseline);
    expect(boat.position.toArray()).not.toEqual(boatBaseline[0]);
    expect([preview.root.position.toArray(), preview.root.rotation.toArray(), preview.root.scale.toArray()]).toEqual(rootBaseline);
    preview.update(0);
    expect(Array.from(flag.geometry.attributes.position.array)).toEqual(flagBaseline);
    expect([boat.position.toArray(), boat.rotation.toArray()]).toEqual(boatBaseline);
    preview.dispose();
  });

  it('sways the Kish palm crown locally while its trunk and island stay planted', () => {
    const preview = createIslandPreview(new THREE.Scene(), 'kish');
    const tree = preview.root.getObjectByName('Kish promenade palm 0');
    const crown = tree.getObjectByName('Kish promenade palm 0 wind crown');
    expect(crown).toBeTruthy();
    const trunk = tree.getObjectByName('Wind-bent palm trunk');
    const baseline = crown.rotation.toArray();
    const trunkBaseline = trunk.rotation.toArray();
    const rootBaseline = preview.root.matrix.toArray();
    preview.update(1.75);
    expect(crown.rotation.toArray()).not.toEqual(baseline);
    expect(trunk.rotation.toArray()).toEqual(trunkBaseline);
    preview.root.updateMatrix();
    expect(preview.root.matrix.toArray()).toEqual(rootBaseline);
    preview.update(0);
    expect(crown.rotation.toArray()).toEqual(baseline);
    preview.dispose();
  });

  it('gives Qeshm a local tidal skiff animation with a zero-time baseline', () => {
    const root = createIslandPreview(new THREE.Scene(), 'qeshm');
    const skiff = root.root.getObjectByName('Qeshm tidal skiff');
    expect(skiff).toBeTruthy();
    const baseline = { position: skiff.position.toArray(), rotation: skiff.rotation.toArray() };
    const rootBaseline = { position: root.root.position.toArray(), rotation: root.root.rotation.toArray(), scale: root.root.scale.toArray() };
    root.update(1.75);
    expect(skiff.position.toArray()).not.toEqual(baseline.position);
    expect(skiff.rotation.toArray()).not.toEqual(baseline.rotation);
    expect(root.root.position.toArray()).toEqual(rootBaseline.position);
    expect(root.root.rotation.toArray()).toEqual(rootBaseline.rotation);
    expect(root.root.scale.toArray()).toEqual(rootBaseline.scale);
    root.update(0);
    expect(skiff.position.toArray()).toEqual(baseline.position);
    expect(skiff.rotation.toArray()).toEqual(baseline.rotation);
    root.dispose();
  });
});
