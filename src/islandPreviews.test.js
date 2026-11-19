import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createIslandPreview } from './islandPreviews.js';

const ids = ['qeshm', 'kish', 'khark', 'hengam'];

function meshes(root) {
  const result = [];
  root.traverse((object) => { if (object.isMesh) result.push(object); });
  return result;
}

describe('island preview lifecycle', () => {
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
});
