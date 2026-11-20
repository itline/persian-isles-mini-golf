import * as THREE from 'three';

// Entirely procedural Hormuz-inspired scenery. The playable U is intentionally empty.
// This module does not own the camera, lights, course, renderer or scene background.
const TAU = Math.PI * 2;
const TERRACOTTA = ['#ab4636', '#ce633e', '#bf5038', '#e3854b'];
const OCHRE = ['#d58b40', '#e8af57', '#b97535', '#f0c877'];
const SALT = ['#f2e6d0', '#fff3da', '#dfd4bf', '#e9dfca'];
const ROSE = ['#c96556', '#a94741', '#e58c70', '#b95145'];

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createEnvironment(scene) {
  if (!scene || typeof scene.add !== 'function') {
    throw new TypeError('createEnvironment requires a Three.js scene');
  }

  const root = new THREE.Group();
  root.name = 'HormuzProceduralEnvironment';
  const geometries = new Set();
  const materials = new Set();
  const materialCache = new Map();
  const random = seededRandom(71591);
  let disposed = false;

  function surface(hex, options = {}) {
    const key = `${hex}:${JSON.stringify(options)}`;
    if (!materialCache.has(key)) {
      const material = new THREE.MeshStandardMaterial({
        color: hex, roughness: 0.88, metalness: 0, flatShading: true, ...options,
      });
      materials.add(material);
      materialCache.set(key, material);
    }
    return materialCache.get(key);
  }

  function mesh(parent, geometry, material, name, position = [0, 0, 0], cast = true) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.position.set(...position);
    object.castShadow = cast;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function box(parent, name, size, position, hex, cast = true) {
    return mesh(parent, new THREE.BoxGeometry(...size), surface(hex), name, position, cast);
  }

  function group(name, position = [0, 0, 0]) {
    const object = new THREE.Group();
    object.name = name;
    object.position.set(...position);
    root.add(object);
    return object;
  }

  // Define shape coordinates in world x/z rather than mirroring z on rotation.
  function patch(parent, name, points, y, hex, options = {}) {
    const shape = new THREE.Shape();
    points.forEach(([x, z], index) => {
      if (index === 0) shape.moveTo(x, -z);
      else shape.lineTo(x, -z);
    });
    shape.closePath();
    const object = mesh(parent, new THREE.ShapeGeometry(shape), surface(hex, options), name, [0, y, 0], false);
    object.rotation.x = -Math.PI / 2;
    return object;
  }

  // A broad, chamfered silhouette supports the complete U, including its front corners.
  const contour = [
    [10.65, 0.6], [10.35, 3.3], [10.6, 6.1], [9.9, 8.5], [8.65, 9.1],
    [6.5, 9.55], [3.8, 9.25], [1.5, 9.75], [-1.2, 9.5], [-3.8, 9.8],
    [-6.7, 9.4], [-8.65, 9.15], [-10.2, 8.25], [-10.55, 5.9], [-10.4, 3.1],
    [-10.8, 0.3], [-10.5, -2.4], [-10.75, -5.3], [-10.1, -8.2], [-8.7, -9.25],
    [-5.8, -9.5], [-3.0, -9.2], [-0.5, -9.75], [2.6, -9.45], [5.2, -9.7],
    [8.4, -9.1], [10.0, -8.2], [10.45, -5.6], [10.2, -2.5],
  ];

  patch(root, 'Terracotta island top', contour, -0.35, '#c97049');

  // Flat polygon panels with independent normals and subtle facet-to-facet color.
  function ringWall(name, lower, upper, lowerY, upperY, palette) {
    const positions = [];
    const colors = [];
    // Shared boundary samples keep strata watertight. Only internal seams vary;
    // the top/course alignment, bottom edge and all x/z footprints stay fixed.
    const seamY = (y, index) => (y === -0.35 || y === -3.4) ? y
      : y + Math.sin(index * 1.31) * 0.075 + Math.sin(index * 2.7) * 0.025;
    for (let i = 0; i < lower.length; i += 1) {
      const j = (i + 1) % lower.length;
      const vertices = [
        [lower[i][0], seamY(lowerY, i), lower[i][1]], [upper[i][0], seamY(upperY, i), upper[i][1]],
        [upper[j][0], seamY(upperY, j), upper[j][1]], [lower[j][0], seamY(lowerY, j), lower[j][1]],
      ];
      const shade = new THREE.Color(palette[i % palette.length]);
      for (const index of [0, 1, 2, 0, 2, 3]) {
        positions.push(...vertices[index]);
        colors.push(shade.r, shade.g, shade.b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return mesh(root, geometry, surface('#ffffff', { vertexColors: true }), name);
  }

  const cliffLayers = [
    [-0.35, 1.0, TERRACOTTA], [-0.88, 1.008, TERRACOTTA],
    [-1.02, 0.995, SALT], [-1.51, 0.975, OCHRE],
    [-1.78, 0.953, ROSE], [-2.42, 0.927, TERRACOTTA],
    [-2.60, 0.913, OCHRE], [-3.4, 0.855, ROSE],
  ];
  for (let i = 1; i < cliffLayers.length; i += 1) {
    const [upperY, upperScale] = cliffLayers[i - 1];
    const [lowerY, lowerScale, palette] = cliffLayers[i];
    ringWall(`Coastal cliff stratum ${i}`,
      contour.map(([x, z]) => [x * lowerScale, z * lowerScale]),
      contour.map(([x, z]) => [x * upperScale, z * upperScale]), lowerY, upperY, palette);
  }

  // One continuous irregular, faceted stack, not a pile of intersecting cones.
  function stack(name, x, z, rx, rz, height, palette, seed, baseY = -0.35) {
    const rng = seededRandom(seed);
    const sides = 7;
    const fractions = [0, 0.21, 0.29, 0.53, 0.62, 0.82, 1];
    const radii = [1, 0.94, 1.015, 0.74, 0.81, 0.47, 0.20];
    const offsets = Array.from({ length: sides }, () => 0.86 + rng() * 0.18);
    const phase = rng() * 0.4;
    const positions = [];
    const colors = [];
    const vertices = fractions.map((fraction, level) => Array.from({ length: sides }, (_, i) => {
      const angle = TAU * i / sides + phase;
      return [
        Math.cos(angle) * rx * offsets[i] * radii[level] + rx * fraction * 0.11,
        height * fraction,
        Math.sin(angle) * rz * offsets[i] * radii[level] - rz * fraction * 0.14,
      ];
    }));
    for (let level = 0; level < vertices.length - 1; level += 1) {
      const hex = level === 1 ? SALT[seed % SALT.length]
        : level === 4 ? palette[(seed + 1) % palette.length] : palette[level % palette.length];
      for (let side = 0; side < sides; side += 1) {
        const next = (side + 1) % sides;
        const shade = new THREE.Color(hex).multiplyScalar(0.91 + rng() * 0.14);
        const quad = [vertices[level][side], vertices[level + 1][side], vertices[level + 1][next], vertices[level][next]];
        for (const index of [0, 1, 2, 0, 2, 3]) {
          positions.push(...quad[index]);
          colors.push(shade.r, shade.g, shade.b);
        }
      }
    }
    const cap = vertices[vertices.length - 1];
    for (let i = 0; i < sides; i += 1) {
      const shade = new THREE.Color(palette[palette.length - 1]);
      for (const vertex of [[rx * 0.11, height, -rz * 0.14], cap[(i + 1) % sides], cap[i]]) {
        positions.push(...vertex);
        colors.push(shade.r, shade.g, shade.b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return mesh(root, geometry, surface('#ffffff', { vertexColors: true }), name, [x, baseY, z]);
  }

  // Tallest ridges are behind play. Side formations have deliberately narrow footprints.
  [
    [-7.2, -8.3, 1.55, 0.9, 2.35, OCHRE], [-4.5, -8.55, 1.6, 0.85, 2.7, TERRACOTTA],
    [-1.4, -8.55, 1.55, 0.95, 3.10, ROSE], [1.7, -8.6, 1.6, 0.85, 2.45, OCHRE],
    [4.65, -8.5, 1.3, 0.8, 2.95, TERRACOTTA], [7.45, -8.05, 1.18, 0.85, 2.0, SALT],
    [-9.45, -5.4, 0.67, 1.35, 2.7, ROSE], [-9.45, -2.55, 0.72, 1.25, 2.95, OCHRE],
    [-9.45, 0.3, 0.7, 1.35, 2.4, TERRACOTTA], [-9.4, 3.1, 0.66, 1.25, 2.15, SALT],
    [-9.25, 6.1, 0.68, 1.2, 1.55, OCHRE],
    [9.45, -5.15, 0.7, 1.15, 2.2, TERRACOTTA], [9.45, -2.45, 0.68, 1.2, 2.5, OCHRE],
    [9.45, 0.15, 0.65, 1.15, 1.9, ROSE], [9.5, 2.8, 0.65, 1.1, 1.3, SALT],
    [9.45, 7.6, 0.57, 0.85, 1.1, TERRACOTTA],
  ].forEach(([x, z, rx, rz, height, palette], i) => stack(`Mineral ridge ${i}`, x, z, rx, rz, height, palette, 100 + i * 13));

  // Mineral fans sit below play level; the central garden stays under one metre tall.
  patch(root, 'Ochre mineral fan', [[-3.4, 0], [-2.6, -1.5], [-1.8, -1.45], [-1.2, -0.5], [-2.5, 1.15]], -0.337, '#df9b56');
  patch(root, 'Salt mineral fan', [[1.65, 4.8], [3.1, 4.3], [3.4, 5.4], [2.8, 6.2], [1.6, 5.8]], -0.336, '#ead5ac');
  stack('Low ochre canyon', -2.55, -0.15, 0.7, 0.92, 1.15, OCHRE, 213);
  stack('Low red canyon', 2.65, 4.8, 0.65, 0.9, 1.12, ROSE, 219);
  stack('Salt garden', -2.65, 5.15, 0.62, 0.67, 0.85, SALT, 227);
  stack('Canyon satellite', 2.6, -0.65, 0.52, 0.6, 0.78, TERRACOTTA, 229);

  // A decorative shallow tidal ribbon, entirely inside the non-playable central gap.
  const inlet = [[-0.75, 6.3], [-1.15, 5.3], [-0.75, 3.9], [-1.05, 2.9], [-0.35, 1.65],
    [0.25, 0.45], [0.03, -0.6], [0.85, -1.75], [1.6, -1.55], [0.95, -0.5],
    [1.2, 0.65], [0.5, 2.0], [-0.1, 3.0], [0.22, 4.05], [-0.15, 5.3], [0.3, 6.3]];
  patch(root, 'Salt banks of tidal ribbon', inlet.map(([x, z]) => [x * 1.3, z]), -0.327, '#e6d7b2');
  patch(root, 'Turquoise tidal inlet', inlet, -0.312, '#419e9d', { roughness: 0.54 });
  patch(root, 'Tidal deep channel', [[-0.6, 5.9], [-0.3, 4.1], [-0.6, 2.95], [0.2, 1.65], [0.8, 0.4],
    [0.6, -0.5], [0.95, -1.3], [0.73, 0.25], [0.45, 1.7], [-0.3, 3], [-0.05, 4.15], [-0.35, 5.9]], -0.305, '#288a92');

  const bridge = group('Decorative canyon footbridge', [-0.4, -0.1, 3.0]);
  const plankMaterial = surface('#bd8c60');
  const plankGeometry = new THREE.BoxGeometry(0.19, 0.1, 0.62);
  for (let i = 0; i < 12; i += 1) {
    mesh(bridge, plankGeometry, plankMaterial, 'Bridge plank', [-1.1 + i * 0.2, 0.08 + Math.sin(i / 11 * Math.PI) * 0.10, 0]);
  }
  for (const side of [-1, 1]) {
    box(bridge, 'Bridge handrail', [2.5, 0.065, 0.065], [0, 0.57, side * 0.29], '#e7c994');
    for (const x of [-1.1, 0, 1.1]) box(bridge, 'Bridge post', [0.065, 0.6, 0.065], [x, 0.25, side * 0.29], '#956346');
  }

  function building(name, x, z, variant) {
    const home = group(name, [x, -0.34, z]);
    const plaster = variant ? '#eee3c8' : '#fff1d7';
    box(home, 'Lime plaster walls', [1.1, 1.03, 1.0], [0, 0.515, 0], plaster);
    box(home, 'Turquoise plinth', [1.16, 0.15, 1.06], [0, 0.075, 0], '#42a6a1');
    box(home, 'Flat roof cornice', [1.2, 0.12, 1.1], [0, 1.075, 0], '#e2cda7');
    box(home, 'Roof terrace', [1.06, 0.05, 0.94], [0, 1.15, 0], '#f7ebd1');
    for (const xSide of [-1, 1]) box(home, 'Low roof parapet', [0.07, 0.17, 1.05], [xSide * 0.56, 1.18, 0], plaster);
    box(home, 'Turquoise door', [0.25, 0.57, 0.035], [-0.14, 0.39, 0.517], '#177e83');
    const arch = mesh(home, new THREE.CircleGeometry(0.125, 12, 0, Math.PI), surface('#177e83'), 'Arched door lintel', [-0.14, 0.675, 0.537], false);
    arch.rotation.z = 0;
    box(home, 'Recessed window', [0.21, 0.25, 0.035], [0.31, 0.69, 0.518], '#276a74', false);
    box(home, 'Window sill', [0.27, 0.045, 0.085], [0.31, 0.55, 0.55], '#f1dfba');
    const dome = mesh(home, new THREE.SphereGeometry(0.27, 10, 5, 0, TAU, 0, Math.PI / 2), surface('#64bab0'), 'Small turquoise roof dome', [0.12, 1.18, -0.12]);
    dome.scale.y = 0.8;
    return home;
  }
  building('Whitewashed coastal house', -9.0, 7.9, false);
  building('Turquoise fisher house', 9.25, 5.0, true);
  building('Salt coast shelter', -9.5, -6.9, true).scale.setScalar(0.78);

  // Two sparse date palms, fan-like original leaf silhouettes rather than a forest.
  function palm(name, x, z, scale) {
    const tree = group(name, [x, -0.34, z]);
    tree.scale.setScalar(scale);
    const trunk = mesh(tree, new THREE.CylinderGeometry(0.055, 0.095, 1.35, 6), surface('#94704b'), 'Date palm trunk', [0, 0.68, 0]);
    trunk.rotation.z = -0.08;
    const leafGeometry = new THREE.BufferGeometry();
    leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0, 0.38, 0.18, 0.12, 0.88, -0.14, 0,
      0, 0, 0, 0.88, -0.14, 0, 0.38, 0.18, -0.12,
    ], 3));
    leafGeometry.computeVertexNormals();
    for (let i = 0; i < 7; i += 1) {
      const leaf = mesh(tree, leafGeometry, surface(i % 2 ? '#6c9464' : '#477e66', { side: THREE.DoubleSide }), 'Date palm frond', [0.06, 1.33, 0]);
      leaf.rotation.y = i / 7 * TAU;
    }
  }
  palm('Western date palm', -8.95, 5.7, 0.70);
  palm('Eastern date palm', 9.2, 6.7, 0.62);

  // Talus adds natural contact at the foot of the cliff without encroaching on play.
  const boulderGeometry = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 25; i += 1) {
    const [x, z] = contour[i % contour.length];
    const rock = mesh(root, boulderGeometry, surface((i % 5 === 0 ? SALT : TERRACOTTA)[i % 4]), `Coastal talus ${i}`,
      [x * (0.93 + random() * 0.06), -3.27 + random() * 0.18, z * (0.94 + random() * 0.05)]);
    rock.scale.set(0.35 + random() * 0.5, 0.25 + random() * 0.38, 0.4 + random() * 0.5);
    rock.rotation.set(random(), random() * TAU, random());
  }

  // The waterfront sits below the front cliff: readable from the specified camera.
  const jetty = group('Shaded waterfront jetty', [0.9, -2.8, 10.15]);
  for (let i = 0; i < 16; i += 1) box(jetty, 'Jetty deck board', [1.8, 0.09, 0.18], [0, 0, -0.1 + i * 0.2], i % 3 ? '#ac8055' : '#c59868');
  for (const x of [-0.72, 0.72]) {
    for (const z of [0.25, 2.6]) {
      mesh(jetty, new THREE.CylinderGeometry(0.065, 0.09, 1.0, 6), surface('#755741'), 'Jetty pile', [x, -0.37, z]);
      box(jetty, 'Canopy upright', [0.055, 1.25, 0.055], [x, 0.66, z], '#dbb77d');
    }
  }
  const canopy = mesh(jetty, new THREE.BoxGeometry(1.95, 0.07, 2.75), surface('#efe0b9'), 'Woven shade canopy', [0, 1.31, 1.43]);
  canopy.rotation.z = -0.04;
  for (let i = 0; i < 7; i += 1) box(jetty, 'Canopy turquoise stripe', [0.12, 0.016, 2.75], [-0.82 + i * 0.27, 1.36, 1.43], '#57a6a0', false);
  for (let i = 0; i < 7; i += 1) box(root, 'Cliff landing step', [1.2, 0.17, 0.35], [0.9, -0.42 - i * 0.36, 8.1 + i * 0.31], '#d9ae79');
  box(jetty, 'Dock crate', [0.36, 0.36, 0.4], [-0.4, 0.23, 2.55], '#9c7147');

  const boat = group('Small turquoise fishing boat', [3.65, -3.64, 11.7]);
  boat.rotation.y = -0.35;
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, -1.12);
  hullShape.lineTo(0.46, -0.48);
  hullShape.lineTo(0.43, 0.72);
  hullShape.lineTo(0.24, 1.0);
  hullShape.lineTo(-0.24, 1.0);
  hullShape.lineTo(-0.43, 0.72);
  hullShape.lineTo(-0.46, -0.48);
  hullShape.closePath();
  const hull = mesh(boat, new THREE.ExtrudeGeometry(hullShape, { depth: 0.25, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.10, bevelThickness: 0.09 }), surface('#177e8e'), 'Faceted fishing hull');
  hull.rotation.x = -Math.PI / 2;
  const deck = patch(boat, 'Ochre boat deck', [[0, 1.03], [0.35, 0.4], [0.32, -0.66], [0.19, -0.86], [-0.19, -0.86], [-0.32, -0.66], [-0.35, 0.4]], 0.35, '#d7ad70');
  deck.receiveShadow = true;
  for (const z of [-0.45, 0.23]) box(boat, 'Boat bench', [0.72, 0.065, 0.15], [0, 0.41, z], '#f0d5a6');
  for (const x of [-0.36, 0.36]) box(boat, 'Dark boat gunwale', [0.075, 0.11, 1.45], [x, 0.40, 0.02], '#0f5f6b', false);
  const mast = mesh(boat, new THREE.CylinderGeometry(0.02, 0.035, 1.5, 5), surface('#a78256'), 'Short boat mast', [0, 1.05, -0.1]);
  mast.rotation.z = -0.04;
  const sailGeometry = new THREE.BufferGeometry();
  sailGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0.03, 1.72, -0.1, 0.03, 0.7, -0.1, 0.61, 0.75, -0.1], 3));
  sailGeometry.computeVertexNormals();
  mesh(boat, sailGeometry, surface('#f4e5c7', { side: THREE.DoubleSide }), 'Cream triangular sail');

  // A small windsock-like pennant pivots at its hoist, independently of the hull.
  const pennantShape = new THREE.Shape();
  pennantShape.moveTo(0, 0);
  pennantShape.lineTo(0.52, -0.08);
  pennantShape.lineTo(0, -0.21);
  pennantShape.closePath();
  const pennant = mesh(boat, new THREE.ShapeGeometry(pennantShape), surface('#ce633e', { side: THREE.DoubleSide }), 'Boat pennant', [0, 1.86, -0.1]);

  const sea = mesh(root, new THREE.PlaneGeometry(220, 220), surface('#71b6bf', { roughness: 0.61 }), 'Seawater', [0, -3.8, 0], false);
  sea.rotation.x = -Math.PI / 2;

  // Broken, irregular elliptical foam arcs are gentler than thick perfect toruses.
  const foamRings = [];
  for (let ring = 0; ring < 4; ring += 1) {
    const positions = [];
    const radius = 1.08 + ring * 0.095;
    const segments = 160;
    for (let i = 0; i < segments; i += 1) {
      if ((i + ring * 9) % 37 > 28) continue;
      const a = i / segments * TAU;
      const b = (i + 1) / segments * TAU;
      const wave = (angle) => 1 + Math.sin(angle * 7 + ring) * 0.009 + Math.sin(angle * 13) * 0.006;
      const point = (angle, offset) => [Math.cos(angle) * (10.5 * radius + offset) * wave(angle), 0, Math.sin(angle) * (9.7 * radius + offset) * wave(angle)];
      const width = ring ? 0.035 : 0.065;
      const quad = [point(a, -width), point(a, width), point(b, width), point(b, -width)];
      for (const index of [0, 2, 1, 0, 3, 2]) positions.push(...quad[index]);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const foam = mesh(root, geometry, surface('#d6f4e7', { transparent: true, opacity: ring ? 0.20 : 0.4, depthWrite: false }), `Soft shore foam ${ring}`, [0, -3.765 + ring * 0.004, 0], false);
    foam.receiveShadow = false;
    foamRings.push(foam);
  }

  [[-20, -11, 1.8, 0.8], [19, -15, 2.5, 1], [-23, 8, 1.4, 0.6]].forEach(([x, z, radius, height], i) => {
    stack(`Distant low island ${i}`, x, z, radius, radius * 0.65, height, i % 2 ? OCHRE : ROSE, 419 + i, -3.78);
  });

  scene.add(root);
  return {
    root,
    update(t = 0) {
      if (disposed) return;
      const time = Number.isFinite(t) ? t : 0;
      foamRings.forEach((foam, i) => {
        const pulse = 1 + (Math.sin(time * 0.45 + i * 1.4) - Math.sin(i * 1.4)) * 0.007;
        foam.scale.set(pulse, 1, pulse);
        foam.material.opacity = (i ? 0.20 : 0.4) + (Math.sin(time * 0.65 + i) - Math.sin(i)) * 0.025;
      });
      boat.position.y = -3.64 + Math.sin(time * 1.05) * 0.09;
      boat.rotation.z = Math.sin(time * 0.8) * 0.05;
      pennant.rotation.z = Math.sin(time * 1.7) * 0.16;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      geometries.clear();
      materials.clear();
      materialCache.clear();
      root.clear();
    },
  };
}

export default createEnvironment;
