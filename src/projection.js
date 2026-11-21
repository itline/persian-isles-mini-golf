import * as THREE from 'three';

// Callers own scratch objects so independent raycasts cannot overwrite retained points.
export function screenAnchorToPlane(x, y, height, camera, raycaster, plane, ndc, target) {
  raycaster.setFromCamera(ndc.set(x * 2 - 1, 1 - Math.max(y, 100 / height) * 2), camera);
  return raycaster.ray.intersectPlane(plane, target);
}

export function projectedBounds(object, camera, width, height) {
  const box = new THREE.Box3().setFromObject(object);
  const point = new THREE.Vector3();
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        point.set(x, y, z).project(camera);
        const px = ((point.x + 1) / 2) * width,
          py = ((1 - point.y) / 2) * height;
        left = Math.min(left, px);
        top = Math.min(top, py);
        right = Math.max(right, px);
        bottom = Math.max(bottom, py);
      }
    }
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}
