import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { mergeStaticMeshes } from './staticMeshes.js';

function triangleCount(meshes) {
  return meshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
}

function expandedAttributes(meshes, root) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const result = {};
  for (const mesh of meshes) {
    const transformed = mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
    const geometry = transformed.index ? transformed.toNonIndexed() : transformed;
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      (result[name] ??= []).push(...attribute.array);
    }
    if (geometry !== transformed) geometry.dispose();
    transformed.dispose();
  }
  return result;
}

describe('explicit static mesh batching', () => {
  it('leaves transparent, hidden, mirrored, partial, animated and foreign meshes untouched', () => {
    const root = new THREE.Group();
    const material = new THREE.MeshStandardMaterial();
    const make = () => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
      root.add(mesh);
      return mesh;
    };
    const transparent = [make(), make()];
    transparent.forEach((mesh) => { mesh.material = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5 }); });
    const hiddenParent = new THREE.Group();
    hiddenParent.visible = false;
    root.add(hiddenParent);
    const hidden = [make(), make()];
    hiddenParent.add(...hidden);
    const mirrored = [make(), make()];
    mirrored.forEach((mesh) => { mesh.scale.x = -1; });
    const partial = [make(), make()];
    partial.forEach((mesh) => mesh.geometry.setDrawRange(0, 6));
    const morphs = [make(), make()];
    morphs.forEach((mesh) => { mesh.geometry.morphAttributes.position = [mesh.geometry.attributes.position.clone()]; });
    const multiMaterial = [make(), make()];
    multiMaterial.forEach((mesh) => { mesh.material = [material, material]; });
    const foreign = new THREE.Mesh(new THREE.BoxGeometry(), material);
    const all = [...transparent, ...hidden, ...mirrored, ...partial, ...morphs, ...multiMaterial, foreign];
    const parents = all.map((mesh) => mesh.parent);

    expect(mergeStaticMeshes(root, all)).toEqual([]);
    expect(all.map((mesh) => mesh.parent)).toEqual(parents);
  });

  it('keeps material identity, shadow flags, layers and attribute layouts in separate batches', () => {
    const root = new THREE.Group();
    const material = new THREE.MeshStandardMaterial();
    const variants = [
      { material, cast: false, receive: false, layer: 0, uv: true },
      { material, cast: true, receive: false, layer: 0, uv: true },
      { material, cast: false, receive: true, layer: 0, uv: true },
      { material: material.clone(), cast: false, receive: false, layer: 0, uv: true },
      { material, cast: false, receive: false, layer: 1, uv: true },
      { material, cast: false, receive: false, layer: 0, uv: false },
    ];
    const sources = variants.flatMap((variant) => Array.from({ length: 2 }, () => {
      const geometry = new THREE.BoxGeometry();
      if (!variant.uv) geometry.deleteAttribute('uv');
      const mesh = new THREE.Mesh(geometry, variant.material);
      mesh.castShadow = variant.cast;
      mesh.receiveShadow = variant.receive;
      mesh.layers.set(variant.layer);
      root.add(mesh);
      return mesh;
    }));
    const batches = mergeStaticMeshes(root, sources);
    expect(batches).toHaveLength(variants.length);
    variants.forEach((variant, i) => {
      expect(batches[i].material).toBe(variant.material);
      expect(batches[i].castShadow).toBe(variant.cast);
      expect(batches[i].receiveShadow).toBe(variant.receive);
      expect(batches[i].layers.mask).toBe(1 << variant.layer);
      expect(Boolean(batches[i].geometry.attributes.uv)).toBe(variant.uv);
    });
  });

  it('reduces same-material meshes to one submission without changing transformed vertex attributes or triangles', () => {
    expect(mergeStaticMeshes).toBeTypeOf('function');
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    root.position.set(4, 1, -3);
    root.rotation.y = 0.4;
    scene.add(root);
    const parent = new THREE.Group();
    parent.position.set(2, -1, 5);
    parent.rotation.z = 0.3;
    parent.scale.set(0.7, 1.2, 0.8);
    root.add(parent);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    const geometry = new THREE.BoxGeometry();
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(
      Array.from({ length: geometry.attributes.position.count * 3 }, (_, i) => i / 100), 3,
    ));
    const meshes = [new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material)];
    meshes[1].position.set(2, 3, 1);
    meshes[1].rotation.y = 0.6;
    meshes[1].scale.set(1.2, 0.5, 0.9);
    parent.add(...meshes);
    const before = expandedAttributes(meshes, root);
    const sourcePositions = geometry.attributes.position.array.slice();
    const triangles = triangleCount(meshes);

    const batches = mergeStaticMeshes(root, meshes);

    expect(batches).toHaveLength(1);
    expect(parent.children).toHaveLength(0);
    expect(batches[0].parent).toBe(root);
    expect(batches[0].material).toBe(material);
    expect(triangleCount(batches)).toBe(triangles);
    const after = expandedAttributes(batches, root);
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    for (const name of Object.keys(before)) {
      expect(after[name]).toHaveLength(before[name].length);
      after[name].forEach((value, i) => expect(value).toBeCloseTo(before[name][i], 5));
    }
    expect(geometry.attributes.position.array).toEqual(sourcePositions);
  });
});
