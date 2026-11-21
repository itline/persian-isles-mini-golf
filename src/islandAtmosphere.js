import * as THREE from 'three';

const ISLANDS = ['qeshm', 'kish', 'khark', 'hengam'];

const DETAIL_PLACEMENTS = {
  qeshm: { landscape: [[0.34, 0.78, 38], [0.93, 0.59, 29]], portrait: [[0.88, 0.37, 23], [0.10, 0.33, 17]] },
  kish: { landscape: [[0.31, 0.77, 34], [0.92, 0.65, 25]], portrait: [[0.10, 0.36, 21], [0.88, 0.39, 15]] },
  khark: { landscape: [[0.35, 0.82, 36], [0.94, 0.61, 28]], portrait: [[0.10, 0.36, 22], [0.88, 0.39, 16]] },
  hengam: { landscape: [[0.33, 0.80, 32], [0.91, 0.68, 26]], portrait: [[0.10, 0.34, 20], [0.87, 0.38, 14]] },
};

// Sparse screen-space formations: one nearer coastal craft and one farther
// silhouette. Kinds select the matching procedural vessel, not an array index.
const VESSEL_PROFILES = {
  hormuz: {
    kinds: ['lenj', 'cargo'],
    landscape: { anchors: [[0.22,0.84],[0.86,0.16]], yaws: [-0.25,0.22], widths: [32,37] },
    portrait: { anchors: [[0.14,0.15],[0.87,0.27]], yaws: [-0.25,0.22], widths: [20, 24] },
  },
  qeshm: {
    kinds: ['lenj', 'cargo'],
    landscape: { anchors: [[0.19,0.82],[0.83,0.18]], yaws: [0.18,-0.28], widths: [34,39] },
    portrait: { anchors: [[0.12,0.18],[0.88,0.25]], yaws: [0.18,-0.28], widths: [20, 24] },
  },
  kish: {
    kinds: ['passenger', 'fishing'],
    landscape: { anchors: [[0.23,0.86],[0.9,0.26]], yaws: [-0.18,0.3], widths: [36,26] },
    portrait: { anchors: [[0.16,0.14],[0.88,0.28]], yaws: [-0.18,0.3], widths: [20, 24] },
  },
  khark: {
    kinds: ['tanker', 'cargo'],
    landscape: { anchors: [[0.24,0.84],[0.86,0.2]], yaws: [0.12,-0.2], widths: [40,32] },
    portrait: { anchors: [[0.12,0.22],[0.87,0.28]], yaws: [0.12,-0.2], widths: [20, 24] },
  },
  hengam: {
    kinds: ['fishing', 'lenj'],
    landscape: { anchors: [[0.2,0.86],[0.88,0.22]], yaws: [-0.3,0.18], widths: [29,35] },
    portrait: { anchors: [[0.14,0.16],[0.89,0.26]], yaws: [-0.3,0.18], widths: [20, 24] },
  },
};

/** Normalized top-left anchors, radians around +Y, and desired pixel widths.
 * Each call owns its arrays; portrait is also the conservative narrow-phone
 * profile. Parent owns projection onto its water plane and vessel visibility.
 */
export function islandSceneProfile(id, portrait = false, compact = false) {
  if (!Object.hasOwn(VESSEL_PROFILES, id)) throw new RangeError(`Unknown island scene profile: ${id}`);
  const profile = VESSEL_PROFILES[id][portrait ? 'portrait' : 'landscape'];
  return {
    anchors: profile.anchors.map((anchor, index) => compact && !portrait ? (index ? [0.94, 0.30] : [0.48, 0.16]) : [...anchor]),
    yaws: [...profile.yaws],
    widths: [...profile.widths],
    kinds: [...VESSEL_PROFILES[id].kinds],
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
