import * as THREE from 'three';

const ISLANDS = ['qeshm', 'kish', 'khark', 'hengam'];

const DETAIL_PLACEMENTS = {
  qeshm: { landscape: [[0.89, 0.17, 38], [0.86, 0.43, 29]], portrait: [[0.86, 0.32, 23], [0.12, 0.33, 17]] },
  kish: { landscape: [[0.88, 0.27, 34], [0.94, 0.16, 25]], portrait: [[0.12, 0.30, 21], [0.86, 0.16, 15]] },
  khark: { landscape: [[0.89, 0.39, 36], [0.82, 0.19, 28]], portrait: [[0.11, 0.17, 22], [0.89, 0.29, 16]] },
  hengam: { landscape: [[0.90, 0.18, 32], [0.86, 0.44, 26]], portrait: [[0.12, 0.15, 20], [0.87, 0.20, 14]] },
};

// Screen-space formations: fisherman first, lenj second. Parent may hide any
// additional fleet boats; two deliberately suffice even in landscape.
const VESSEL_PROFILES = {
  hormuz: {
    landscape: { anchors: [[0.79, 0.20], [0.90, 0.27]], yaws: [-0.10, 0.04], widths: [28, 36] },
    portrait: { anchors: [[0.16, 0.17], [0.84, 0.13]], yaws: [-0.12, 0.08], widths: [18, 22] },
  },
  qeshm: {
    landscape: { anchors: [[0.76, 0.24], [0.94, 0.34]], yaws: [0.16, -0.08], widths: [30, 38] },
    portrait: { anchors: [[0.13, 0.22], [0.88, 0.19]], yaws: [0.12, -0.14], widths: [17, 23] },
  },
  kish: {
    landscape: { anchors: [[0.75, 0.18], [0.91, 0.43]], yaws: [-0.18, 0.10], widths: [26, 34] },
    portrait: { anchors: [[0.20, 0.16], [0.89, 0.27]], yaws: [0.16, -0.06], widths: [16, 22] },
  },
  khark: {
    landscape: { anchors: [[0.77, 0.32], [0.95, 0.22]], yaws: [0.08, -0.18], widths: [32, 40] },
    portrait: { anchors: [[0.12, 0.29], [0.86, 0.15]], yaws: [-0.08, 0.14], widths: [18, 24] },
  },
  hengam: {
    landscape: { anchors: [[0.77, 0.27], [0.93, 0.37]], yaws: [0.20, -0.12], widths: [29, 35] },
    portrait: { anchors: [[0.18, 0.25], [0.90, 0.31]], yaws: [-0.16, 0.12], widths: [15, 21] },
  },
};

/** Normalized top-left anchors, radians around +Y, and desired pixel widths.
 * Each call owns its arrays; portrait is also the conservative narrow-phone
 * profile. Parent owns projection onto its water plane and vessel visibility.
 */
export function islandSceneProfile(id, portrait = false) {
  if (!Object.hasOwn(VESSEL_PROFILES, id)) throw new RangeError(`Unknown island scene profile: ${id}`);
  const profile = VESSEL_PROFILES[id][portrait ? 'portrait' : 'landscape'];
  return {
    anchors: profile.anchors.map((anchor) => [...anchor]),
    yaws: [...profile.yaws],
    widths: [...profile.widths],
  };
}

// Stylized coastal inspiration, not a geographic reconstruction. Colors follow
// islandPreviews; every silhouette stays small, low and water-grounded.
const ROCK_STYLES = {
  qeshm: { name: 'layered limestone canyon rocklet', colors: ['#bd6846', '#db8b55', '#e6ad6b'], layers: [[0.96, 0.18, 0.42, 0.02], [0.78, 0.16, 0.35, 0.17], [0.53, 0.13, 0.29, 0.30]] },
  kish: { name: 'pale coral sand skerry', colors: ['#d8c3a0', '#ead8b7'], layers: [[0.98, 0.12, 0.44, 0.01], [0.67, 0.09, 0.34, 0.10]] },
  khark: { name: 'compact pale limestone shelf', colors: ['#c3ae8c', '#e0cfac'], layers: [[0.94, 0.18, 0.46, 0.02], [0.76, 0.15, 0.38, 0.16]] },
  hengam: { name: 'dark coastal rocklet', colors: ['#827563', '#8d785e'], layers: [[0.90, 0.19, 0.43, 0.01], [0.58, 0.20, 0.32, 0.18]] },
};

/**
 * Creates { root, details, setIsland(id), update(timeSeconds), dispose() }.
 * `details` is a stable array of eight placeable Groups (two per non-Hormuz
 * island), initially hidden. setIsland toggles their visibility; Hormuz selects
 * none because its existing preview already owns distant stacks. Unknown IDs
 * throw RangeError. No renderer, lights, textures, random state or physics.
 *
 * Each detail exposes:
 *   userData.islandId: 'qeshm' | 'kish' | 'khark' | 'hengam'
 *   userData.anchors: { landscape: [x,y], portrait: [x,y] }
 *   userData.widthPx: { landscape: number, portrait: number }
 * Anchor coordinates are normalized, measured from the viewport's top left.
 * Widths are desired rendered widths, NOT world-unit scale factors. Parent
 * projects anchors onto its water plane, measures/scales each detail to width,
 * and owns root/detail transforms and menu/game visibility. Local y=0 is water;
 * rocks extend below it so water occludes the bases. Local +Y is up, X is width.
 * Nothing is positioned in world space or moved by update: static stone remains
 * exactly deterministic for update(0), repeated/invalid times and reduced motion.
 * dispose detaches root and releases shared owned resources exactly once; calls
 * to update/setIsland after disposal are harmless and cannot resurrect objects.
 */
export function createIslandAtmosphere(parent) {
  if (!parent || typeof parent.add !== 'function') {
    throw new TypeError('createIslandAtmosphere requires a Three.js parent');
  }
  const root = new THREE.Group();
  root.name = 'Island Distant Atmosphere';
  parent.add(root);
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 7, 1);
  const materials = new Map();
  let disposed = false;
  function material(hex) {
    if (!materials.has(hex)) materials.set(hex, new THREE.MeshStandardMaterial({
      color: hex, roughness: 0.94, metalness: 0, flatShading: true,
    }));
    return materials.get(hex);
  }
  const details = ISLANDS.flatMap((islandId) => [0, 1].map((index) => {
    const detail = new THREE.Group();
    const style = ROCK_STYLES[islandId];
    detail.name = `${islandId} distant ${style.name} ${index + 1}`;
    detail.userData.islandId = islandId;
    detail.userData.anchors = {};
    detail.userData.widthPx = {};
    for (const mode of ['landscape', 'portrait']) {
      const [x, y, width] = DETAIL_PLACEMENTS[islandId][mode][index];
      detail.userData.anchors[mode] = [x, y];
      detail.userData.widthPx[mode] = width;
    }
    detail.visible = false;
    style.layers.forEach(([x, y, z, height], layer) => {
      const rock = new THREE.Mesh(geometry, material(style.colors[layer]));
      const variation = index ? 0.84 : 1;
      rock.name = `${detail.name} stratum ${layer + 1}`;
      rock.scale.set(x * variation, y * variation, z * variation);
      rock.position.set(layer * (index ? -0.045 : 0.04), height * variation, layer * 0.015);
      rock.rotation.y = index * 0.34 + layer * 0.09;
      rock.castShadow = false;
      rock.receiveShadow = false;
      detail.add(rock);
    });
    root.add(detail);
    return detail;
  }));
  return {
    root,
    details,
    setIsland(id) {
      if (disposed) return;
      if (!Object.hasOwn(VESSEL_PROFILES, id)) throw new RangeError(`Unknown island atmosphere: ${id}`);
      details.forEach((detail) => { detail.visible = detail.userData.islandId === id; });
    },
    update() {},
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      geometry.dispose();
      materials.forEach((value) => value.dispose());
    },
  };
}
