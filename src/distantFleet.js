import * as THREE from 'three';

const TAU = Math.PI * 2;
const FLEET_POSITIONS = [[-3, 0, 0], [0, 0, 0], [4, 0, 0]];

/**
 * Menu-only, entirely procedural silhouettes; no renderer, lights or physics.
 * Returns { root, boats, update(timeSeconds), dispose() }. The parent owns every
 * root/boat anchor transform, visibility and camera-unprojected placement;
 * update only changes nested bob groups. Boat anchors begin at x = -3, 0, 4,
 * y/z = 0. Local +Y is up, hull length runs along X, bows face +X.
 * At rest each vessel fits within 2 x 1.5 x 0.7 units (width/height/depth),
 * and the whole default formation fits x [-4, 5]. No positions are world-space.
 * `update(0)` restores rest exactly for reduced motion; invalid time also rests.
 * Disposal detaches the root and releases only owned resources, once.
 */
export function createDistantFleet(parent) {
  if (!parent || typeof parent.add !== 'function') {
    throw new TypeError('createDistantFleet requires a Three.js parent');
  }

  const root = new THREE.Group();
  root.name = 'Sparse Distant Fleet';
  parent.add(root);

  const geometries = new Set();
  const materials = new Set();
  const materialCache = new Map();
  const animated = [];
  let disposed = false;

  function material(hex) {
    if (!materialCache.has(hex)) {
      const value = new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.92,
        metalness: 0,
        flatShading: true,
      });
      materials.add(value);
      materialCache.set(hex, value);
    }
    return materialCache.get(hex);
  }

  const hullGeometry = new THREE.BufferGeometry();
  // A six-sided pointed footprint with a shallow raised gunwale.
  const hullVertices = [
    [-0.92, 0, 0], [-0.55, 0, -0.23], [0.58, 0, -0.19], [0.92, 0, 0], [0.58, 0, 0.19], [-0.55, 0, 0.23],
    [-0.78, 0.22, 0], [-0.49, 0.22, -0.28], [0.52, 0.22, -0.23], [0.78, 0.22, 0], [0.52, 0.22, 0.23], [-0.49, 0.22, 0.28],
  ];
  const hullIndices = [];
  const sides = 6;
  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;
    hullIndices.push(side, sides + next, next, side, sides + side, sides + next);
  }
  hullIndices.push(0, 1, 2, 0, 2, 3, 0, 3, 5, 3, 4, 5);
  hullIndices.push(6, 8, 7, 6, 9, 8, 6, 10, 9, 6, 11, 10);
  hullGeometry.setAttribute('position', new THREE.Float32BufferAttribute(hullVertices.flat(), 3));
  hullGeometry.setIndex(hullIndices);
  hullGeometry.computeVertexNormals();
  geometries.add(hullGeometry);

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const mastGeometry = new THREE.CylinderGeometry(0.035, 0.045, 1, 6);
  geometries.add(boxGeometry);
  geometries.add(mastGeometry);

  function mesh(parentObject, geometry, hex, name, position, scale = [1, 1, 1], rotationY = 0) {
    const object = new THREE.Mesh(geometry, material(hex));
    object.name = name;
    object.position.set(...position);
    object.scale.set(...scale);
    object.rotation.y = rotationY;
    object.castShadow = false;
    object.receiveShadow = false;
    parentObject.add(object);
    return object;
  }

  function hull(parentObject, name, scale = 1, hex = '#755846') {
    return mesh(parentObject, hullGeometry, hex, name, [0, 0, 0], [scale, 1, scale], 0);
  }

  function box(parentObject, name, position, scale, hex, rotationY = 0) {
    return mesh(parentObject, boxGeometry, hex, name, position, scale, rotationY);
  }

  function fishingBoat(name, position, scale, phase, yaw) {
    const boat = new THREE.Group();
    boat.name = name;
    boat.position.set(...position);
    boat.rotation.y = yaw;
    boat.scale.setScalar(scale);
    root.add(boat);

    const silhouette = new THREE.Group();
    silhouette.name = `${name} bob`;
    boat.add(silhouette);
    hull(silhouette, 'Fishing boat hull');
    box(silhouette, 'Fishing boat ivory deck', [0, 0.27, 0], [0.82, 0.065, 0.36], '#d8c9aa');
    box(silhouette, 'Fishing boat raised bow', [0.61, 0.35, 0], [0.24, 0.22, 0.34], '#a9825d', -0.12);
    box(silhouette, 'Fishing boat bench', [-0.23, 0.36, 0], [0.08, 0.06, 0.42], '#b6946b');
    animated.push({ object: silhouette, phase, baseY: 0, baseZ: 0, baseRotationZ: 0 });
    return boat;
  }

  function lenj() {
    const boat = new THREE.Group();
    boat.name = 'Distant Iranian lenj';
    boat.position.set(...FLEET_POSITIONS[1]);
    boat.rotation.y = 0.04;
    root.add(boat);

    const silhouette = new THREE.Group();
    silhouette.name = 'Lenj bob';
    boat.add(silhouette);
    hull(silhouette, 'Lenj broad wooden hull', 1.06, '#6f5140');
    box(silhouette, 'Lenj warm ivory deck', [0, 0.27, 0], [0.9, 0.07, 0.4], '#d9c8a8');
    box(silhouette, 'Lenj raised bow', [0.67, 0.43, 0], [0.27, 0.32, 0.38], '#875f46', -0.14);
    box(silhouette, 'Lenj cabin', [-0.26, 0.49, 0], [0.4, 0.34, 0.35], '#cdbb9b');
    box(silhouette, 'Lenj cabin roof', [-0.26, 0.68, 0], [0.47, 0.06, 0.4], '#eee1c4');
    mesh(silhouette, mastGeometry, '#62483b', 'Lenj mast', [-0.02, 0.88, 0], [1, 0.9, 1]);
    box(silhouette, 'Lenj short boom', [0.2, 1.12, 0], [0.42, 0.035, 0.035], '#765745', -0.18);
    animated.push({ object: silhouette, phase: 1.7, baseY: 0, baseZ: 0, baseRotationZ: 0 });
    return boat;
  }

  const boats = [
    fishingBoat('Distant fishing boat 1', FLEET_POSITIONS[0], 0.82, 0.2, -0.1),
    lenj(),
    fishingBoat('Distant fishing boat 2', FLEET_POSITIONS[2], 0.72, 2.4, 0.12),
  ];

  function update(time) {
    if (disposed) return;
    const t = Number.isFinite(time) ? time % 100000 : 0;
    if (t === 0) {
      for (const entry of animated) {
        entry.object.position.y = entry.baseY;
        entry.object.position.z = entry.baseZ;
        entry.object.rotation.z = entry.baseRotationZ;
      }
      return;
    }
    for (const entry of animated) {
      entry.object.position.y = entry.baseY + Math.sin(t * TAU / 6 + entry.phase) * 0.035;
      entry.object.position.z = entry.baseZ + Math.sin(t * TAU / 7 + entry.phase * 0.7) * 0.012;
      entry.object.rotation.z = entry.baseRotationZ + Math.sin(t * TAU / 5 + entry.phase) * 0.012;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (root.parent) root.parent.remove(root);
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((value) => value.dispose());
    animated.length = 0;
  }

  return { root, boats, update, dispose };
}
