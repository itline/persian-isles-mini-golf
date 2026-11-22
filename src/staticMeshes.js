import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Only pass meshes whose transforms are static relative to root. Source geometry
// remains owned by the caller; the caller also owns each returned batch geometry.
export function mergeStaticMeshes(root, meshes) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const groups = new Map();
  for (const mesh of meshes) {
    if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || Array.isArray(mesh.material)
      || mesh.material.transparent || !mesh.material.visible || mesh.children.length
      || mesh.geometry.drawRange.start !== 0 || mesh.geometry.drawRange.count !== Infinity
      || Object.keys(mesh.geometry.morphAttributes).length
      || Object.values(mesh.geometry.attributes).some((attribute) => attribute.isInterleavedBufferAttribute)) continue;
    let ancestor = mesh;
    while (ancestor !== root && ancestor?.visible) ancestor = ancestor.parent;
    if (ancestor !== root) continue;
    const transform = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    // Mirrored winding and singular transforms require special handling; leave them alone.
    if (transform.determinant() <= 0) continue;
    const attributes = Object.entries(mesh.geometry.attributes).sort(([a], [b]) => a.localeCompare(b))
      .map(([name, attribute]) => [name, attribute.array.constructor.name, attribute.itemSize, attribute.normalized, attribute.gpuType]);
    const key = JSON.stringify([mesh.material.uuid, mesh.castShadow, mesh.receiveShadow,
      mesh.layers.mask, mesh.renderOrder, Boolean(mesh.geometry.index), attributes]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mesh);
  }

  const batches = [];
  for (const sources of groups.values()) {
    if (sources.length < 2) continue;
    const geometries = sources.map((mesh) => mesh.geometry.clone().applyMatrix4(
      new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld),
    ));
    const geometry = mergeGeometries(geometries);
    geometries.forEach((entry) => entry.dispose());
    if (!geometry) continue;
    const batch = new THREE.Mesh(geometry, sources[0].material);
    batch.name = 'Static scenery batch';
    batch.castShadow = sources[0].castShadow;
    batch.receiveShadow = sources[0].receiveShadow;
    batch.layers.mask = sources[0].layers.mask;
    batch.renderOrder = sources[0].renderOrder;
    root.add(batch);
    sources.forEach((mesh) => mesh.removeFromParent());
    batches.push(batch);
  }
  return batches;
}
