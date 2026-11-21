import * as THREE from 'three';

const TAU = Math.PI * 2;
const IDS = new Set(['qeshm', 'kish', 'khark', 'hengam']);

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state + 0x6d2b79f5, 1);
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createIslandPreview(scene, id) {
  if (!scene || typeof scene.add !== 'function') throw new TypeError('createIslandPreview requires a Three.js scene');
  if (!IDS.has(id)) throw new RangeError('Island preview id must be qeshm, kish, khark, or hengam');

  const root = new THREE.Group();
  root.name = `${id[0].toUpperCase()}${id.slice(1)} Island Preview`;
  const geometries = new Set();
  const materials = new Set();
  const materialCache = new Map();
  const animated = [];
  let palmBladeGeometry;
  let facetedRockGeometry;
  let disposed = false;

  function material(hex, options = {}) {
    const key = `${hex}|${JSON.stringify(options)}`;
    if (!materialCache.has(key)) {
      const value = new THREE.MeshStandardMaterial({
        color: hex, roughness: 0.9, metalness: 0, flatShading: true, ...options,
      });
      materials.add(value);
      materialCache.set(key, value);
    }
    return materialCache.get(key);
  }

  function addMesh(parent, geometry, mat, name, position = [0, 0, 0], cast = true) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, mat);
    object.name = name;
    object.position.set(...position);
    object.castShadow = cast;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function group(name, position = [0, 0, 0]) {
    const value = new THREE.Group();
    value.name = name;
    value.position.set(...position);
    root.add(value);
    return value;
  }

  function box(parent, name, size, position, hex, options = {}) {
    return addMesh(parent, new THREE.BoxGeometry(...size), material(hex, options.material), name, position, options.cast !== false);
  }

  function cylinder(parent, name, radius, height, position, hex, radialSegments = 8, options = {}) {
    return addMesh(parent, new THREE.CylinderGeometry(radius, radius * (options.bottomScale || 1.08), height, radialSegments), material(hex, options.material), name, position, options.cast !== false);
  }

  function cone(parent, name, radius, height, position, hex, radialSegments = 8) {
    return addMesh(parent, new THREE.ConeGeometry(radius, height, radialSegments), material(hex), name, position);
  }

  function patch(parent, name, points, y, hex, options = {}) {
    const shape = new THREE.Shape();
    points.forEach(([x, z], index) => index ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
    shape.closePath();
    const object = addMesh(parent, new THREE.ShapeGeometry(shape), material(hex, options), name, [0, y, 0], false);
    object.rotation.x = -Math.PI / 2;
    return object;
  }

  function extruded(parent, name, points, depth, position, hex, holes = []) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y));
    shape.closePath();
    holes.forEach((holePoints) => {
      const hole = new THREE.Path();
      holePoints.forEach(([x, y], index) => index ? hole.lineTo(x, y) : hole.moveTo(x, y));
      hole.closePath();
      shape.holes.push(hole);
    });
    return addMesh(parent, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 }), material(hex), name, position);
  }

  function facetedRock(parent, name, x, y, z, rx, ry, rz, hexes, seed) {
    const random = seeded(seed);
    // Variation lives entirely in mesh transforms; these vertices stay immutable.
    facetedRockGeometry ??= new THREE.IcosahedronGeometry(1, 1);
    const rock = addMesh(parent, facetedRockGeometry, material(hexes[seed % hexes.length]), name, [x, y, z]);
    rock.scale.set(rx * (0.92 + random() * 0.16), ry * (0.92 + random() * 0.16), rz * (0.92 + random() * 0.16));
    rock.rotation.set(random() * 0.4, random() * TAU, random() * 0.35);
    return rock;
  }

  function ringWall(name, contour, layers, palette) {
    for (let layer = 0; layer < layers.length - 1; layer += 1) {
      const [lowerY, lowerScale] = layers[layer];
      const [upperY, upperScale] = layers[layer + 1];
      const positions = [];
      const colors = [];
      for (let i = 0; i < contour.length; i += 1) {
        const j = (i + 1) % contour.length;
        const quad = [
          [contour[i][0] * lowerScale, lowerY, contour[i][1] * lowerScale],
          [contour[j][0] * lowerScale, lowerY, contour[j][1] * lowerScale],
          [contour[j][0] * upperScale, upperY, contour[j][1] * upperScale],
          [contour[i][0] * upperScale, upperY, contour[i][1] * upperScale],
        ];
        const shade = new THREE.Color(palette[(i + layer) % palette.length]);
        [0, 2, 1, 0, 3, 2].forEach((index) => {
          positions.push(...quad[index]);
          colors.push(shade.r, shade.g, shade.b);
        });
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      addMesh(root, geometry, material('#fff', { vertexColors: true }), `${name} stratum ${layer}`);
    }
  }

  function sea() {
    // Keep every menu-frustum corner on water, not on a diagonal plane edge.
    const water = addMesh(root, new THREE.PlaneGeometry(160, 160), material('#3b9eb0', { roughness: 0.55 }), 'Preview sea', [0, -3.8, 0], false);
    water.rotation.x = -Math.PI / 2;
    animated.push({ object: water, type: 'water', baseY: -3.8 });
    for (let i = 0; i < 3; i += 1) {
      const points = [];
      const radiusX = 12.2 + i * 0.65;
      const radiusZ = 10.8 + i * 0.62;
      for (let j = 0; j < 64; j += 1) {
        if (j % 13 > 8) continue;
        const a = j / 64 * TAU;
        const next = (j + 1) / 64 * TAU;
        const vertex = (angle, offset) => [Math.cos(angle) * (radiusX + offset), 0, Math.sin(angle) * (radiusZ + offset)];
        const quad = [vertex(a, 0), vertex(a, 0.045), vertex(next, 0.045), vertex(next, 0)];
        [0, 2, 1, 0, 3, 2].forEach((index) => points.push(...quad[index]));
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      geometry.computeVertexNormals();
      addMesh(root, geometry, material('#b9eee2', { transparent: true, opacity: 0.22, depthWrite: false }), `Broken shore foam ${i}`, [0, -3.77 + i * 0.006, 0], false);
    }
  }

  function palm(parent, name, x, z, scale = 1) {
    const tree = new THREE.Group();
    tree.name = name;
    tree.position.set(x, -0.34, z);
    tree.scale.setScalar(scale);
    parent.add(tree);
    const trunk = addMesh(tree, new THREE.CylinderGeometry(0.09, 0.15, 2.45, 7), material('#9b7049'), 'Wind-bent palm trunk', [0, 1.22, 0]);
    trunk.rotation.z = -0.09;
    const crown = new THREE.Group();
    crown.name = `${name} wind crown`;
    crown.position.set(-0.11, 2.42, 0);
    tree.add(crown);
    if (!palmBladeGeometry) {
      const bladeShape = new THREE.Shape();
      [[0, 0], [0.42, 0.2], [0.95, 0.08], [1.6, -0.38], [0.9, -0.09], [0.37, -0.02]].forEach(([x, y], index) => index ? bladeShape.lineTo(x, y) : bladeShape.moveTo(x, y));
      bladeShape.closePath();
      palmBladeGeometry = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.045, bevelEnabled: false, steps: 1 });
    }
    for (let i = 0; i < 8; i += 1) {
      const leaf = addMesh(crown, palmBladeGeometry, material(i % 2 ? '#34745a' : '#78a76c'), 'Swept palm frond');
      leaf.rotation.y = i / 8 * TAU;
      leaf.rotation.z = i % 2 ? 0.13 : -0.04;
      leaf.scale.z = 2.4;
    }
    if (id === 'kish') animated.push({ object: crown, type: 'palm', phase: z * 0.22 });
    return tree;
  }

  function qeshm() {
    const contour = [[-10, -8], [-7, -10], [-2, -9.3], [2, -9.8], [7.5, -8.7], [10, -6], [9.6, 1], [10.4, 7], [6.5, 9.4], [0, 9.1], [-6.2, 9.8], [-10.2, 6], [-9.5, -1]];
    patch(root, 'Qeshm canyon tableland', contour, -0.36, '#b8673f');
    ringWall('Qeshm eroded canyon', contour, [[-3.8, 0.82], [-2.95, 0.88], [-2.45, 0.93], [-1.92, 0.97], [-0.98, 1], [-0.36, 1]], ['#914d39', '#bd6846', '#db8b55', '#9f5140', '#e6ad6b']);
    // Striated ridges frame a winding valley, rather than a flat platform with isolated arches.
    for(const [ridge,x,z,rx,rz,height] of [[0,-6.7,-4.1,2,3.3,2.7],[1,-3.9,-5.5,1.8,2.8,3.2],[2,.1,-6.5,2.2,2.2,2.8],[3,5.5,-4.3,2.6,2.5,3.3],[4,6.6,1.9,1.7,2.9,2.4]]){
      for(let layer=0;layer<5;layer++){
        const rock=cylinder(root,`Qeshm stepped canyon ridge ${ridge}-${layer}`,1,height/5,[x,-.35+height/5*(layer+.5),z],['#9d563c','#b86d46','#e1a16a','#c17b4b','#ecc28a'][layer],7);
        const taper=1-layer*.13;rock.scale.x=rx*taper;rock.scale.z=rz*taper;rock.rotation.y=ridge*.26;
      }
    }
    patch(root,'Qeshm winding dry canyon floor',[[-5,7],[-4.8,3],[-2.5,1],[-2,-2],[.2,-4],[1,-2],[.5,1],[-2.7,3],[-3,7]],-.335,'#e6b97c');
    const strata = group('Qeshm exposed horizontal strata');
    [[-7, -2.6, 4.6, 0.16, '#e2a161'], [-4.2, -1.25, 3.2, 0.13, '#f0c27d'], [1.0, 0.55, 4.6, 0.14, '#d4814e'], [5.5, 2.1, 3.7, 0.12, '#f0b879'], [-1.2, 6.2, 4.8, 0.13, '#dc7c4a']].forEach(([x, z, length, height, color], i) => {
      const ledge = box(strata, `Qeshm erosion ledge ${i}`, [length, height, 0.42], [x, -0.9 + i * 0.22, z], color);
      ledge.rotation.y = (i % 2 ? -1 : 1) * 0.09;
    });
    const arches = [[-6.1, 4.7, 2.7, 2.9], [3.7, 6.3, 2.45, 2.4], [7.1, -3.8, 2.2, 2.1]];
    arches.forEach(([x, z, width, height], i) => {
      const arch = extruded(root, `Qeshm wind-carved arch ${i}`, [[-width, 0], [width, 0], [width, height * 0.72], [width * 0.74, height], [-width * 0.7, height], [-width, height * 0.72]], 0.72, [x, -0.34, z], i % 2 ? '#d48750' : '#a9513b', [[[-width * 0.56, 0], [width * 0.56, 0], [width * 0.4, height * 0.72], [0, height * 0.82], [-width * 0.4, height * 0.72]]]);
      arch.rotation.y = i * 0.17 - 0.1;
    });
    [[-8.4, -5.9, 0.8, 0.7], [-2.8, -7.2, 1.2, 0.8], [3.4, -7.1, 0.9, 0.75], [8.1, 4.6, 1.1, 0.85], [-8.1, 6.6, 0.8, 0.95]].forEach(([x, z, rx, rz], i) => facetedRock(root, `Qeshm talus ${i}`, x, -2.8, z, rx, 0.75, rz, ['#854738', '#a8573e', '#d17d4c'], 71 + i));
    const trail = box(root, 'Qeshm shaded footbridge', [4.4, 0.12, 0.3], [0, 0.24, 1.2], '#906044');
    trail.rotation.y = 0.08;
    for (const x of [-1.8, -0.9, 0, 0.9, 1.8]) box(root, 'Bridge upright', [0.08, 0.65, 0.08], [x, -0.05, 1.05], '#c69a63');
    const skiff = group('Qeshm tidal skiff', [-1.2, -3.93, 9.55]);
    const hull = extruded(skiff, 'Qeshm indigo pointed hull', [[-1.35, 0], [-0.8, -0.36], [0.8, -0.32], [1.35, 0], [0.8, 0.32], [-0.8, 0.36]], 0.42, [0, 0, 0], '#246576');
    hull.rotation.x = -Math.PI / 2;
    box(skiff, 'Qeshm honey timber deck', [1.8, 0.06, 0.5], [0, 0.43, 0], '#e0b273');
    for (const x of [-0.55, 0.35]) box(skiff, 'Qeshm skiff cross bench', [0.12, 0.08, 0.66], [x, 0.5, 0], '#f6db9e');
    const oar = box(skiff, 'Qeshm resting fishing oar', [2.15, 0.055, 0.09], [0.1, 0.58, 0], '#a16b43');
    oar.rotation.y = -0.34;
    cylinder(skiff, 'Qeshm woven fishing basket', 0.17, 0.24, [-0.1, 0.58, 0], '#c28c50', 8);
    animated.push({ object: skiff, type: 'tidal-skiff', baseY: skiff.position.y });
    sea();
  }

  function resortBuilding(parent, name, x, z, width, height, color) {
    const home = group(name, [x, -0.34, z]);
    box(home, 'White coastal building', [width, height, width * 0.72], [0, height / 2, 0], color);
    box(home, 'Building shadow plinth', [width * 1.04, 0.14, width * 0.76], [0, 0.07, 0], '#d8d0bd');
    box(home, 'Flat resort cornice', [width * 1.08, 0.12, width * 0.78], [0, height + 0.05, 0], '#f7f2df');
    for (let i = -1; i <= 1; i += 1) {
      box(home, 'Blue window', [0.34, 0.42, 0.045], [i * width * 0.25, height * 0.58, width * 0.37], '#2d7f91', { cast: false });
      box(home, 'Window shade', [0.45, 0.05, 0.08], [i * width * 0.25, height * 0.82, width * 0.4], '#e9d8ae');
    }
    return home;
  }

  function pier(parent, name, x, z, length, angle = 0) {
    const jetty = new THREE.Group();
    jetty.name = name;
    jetty.position.set(x, -3.1, z);
    jetty.rotation.y = angle;
    root.add(jetty);
    box(jetty, 'White resort pier deck', [0.9, 0.13, length], [0, 0, length / 2], '#efe7d3');
    for (let i = 0; i < 5; i += 1) {
      const pile = cylinder(jetty, 'Pale pier pile', 0.07, 1.3, [0, -0.62, i * length / 4], '#9a8e7b', 7);
      pile.castShadow = true;
    }
    return jetty;
  }

  function kish() {
    const contour = [[-10, -7], [-7, -9], [0, -9.4], [8, -8.1], [10.3, -4], [9.4, 2], [10, 7], [6, 9], [-2, 8.8], [-8.5, 8], [-10.4, 3]];
    patch(root, 'Kish pale resort island', contour, -0.36, '#e9d9b7');
    ringWall('Kish low coral coast', contour, [[-3.8, 0.91], [-2.9, 0.94], [-1.65, 0.98], [-0.36, 1]], ['#b5a188', '#d8c3a0', '#ead8b7']);
    patch(root, 'Kish luminous sand coast', [[-9.2, -7.2], [-5, -8.6], [1, -8.7], [7.5, -7.1], [8.5, -5.7], [4, -5.1], [-4, -5.6]], -0.34, '#f5e8c8');
    const promenade = box(root, 'Kish palm promenade', [1.3, 0.11, 15.5], [-6.5, -0.18, 0.4], '#d2bea0');
    promenade.rotation.y = -0.08;
    [-5.8, -2.4, 1.2, 4.9].forEach((z, i) => palm(root, `Kish promenade palm ${i}`, -7.5, z, 0.78));
    resortBuilding(root, 'Kish abstract coastal hotel', 2.4, 4.9, 2.8, 2.45, '#fff9e9');
    resortBuilding(root, 'Kish white gallery', 6.2, 1.9, 2.2, 1.75, '#f4eee1');
    resortBuilding(root, 'Kish low marina pavilion', 1.6, -2.7, 2.0, 1.15, '#fffdf2');
    pier(root, 'Kish western white pier', -0.8, 5.8, 4.0, 0.12);
    pier(root, 'Kish southern white pier', 5.0, -7.1, 4.3, -0.22);
    for (let i = 0; i < 7; i += 1) {
      const buoy = cylinder(root, 'Kish marina buoy', 0.12, 0.24, [-2.5 + i * 0.85, -3.38, 5.6 + Math.sin(i) * 0.3], i % 2 ? '#e58a52' : '#f5d26a', 6);
      buoy.rotation.x = Math.PI / 2;
      animated.push({ object: buoy, type: 'bob', baseY: buoy.position.y, phase: i * 0.7 });
    }
    sea();
  }

  function lighthouse() {
    const tower = group('Khark maritime lighthouse', [-4.8, -0.34, 5.7]);
    tower.scale.y = 0.9;
    cylinder(tower, 'Limestone lighthouse shaft', 0.48, 3.8, [0, 1.9, 0], '#d7d0bd', 9);
    box(tower, 'Lighthouse balcony', [1.18, 0.12, 1.18], [0, 3.66, 0], '#a88762');
    cylinder(tower, 'Lighthouse lantern room', 0.43, 0.54, [0, 3.98, 0], '#406d74', 8);
    cone(tower, 'Lighthouse copper cap', 0.58, 0.56, [0, 4.48, 0], '#b7774d', 8);
    return tower;
  }

  function khark() {
    const contour = [[-10, -8], [-5, -9.3], [1, -8.5], [8.7, -7.4], [10, -3.4], [9.2, 3], [7.3, 8.5], [1, 9], [-5, 8.4], [-9.2, 5.2], [-10.2, 0]];
    patch(root, 'Khark coral limestone plateau', contour, -0.36, '#c1ad8b');
    ringWall('Khark marine limestone shelf', contour, [[-3.8, 0.79], [-2.9, 0.87], [-2.3, 0.92], [-1.55, 0.97], [-0.9, 1], [-0.36, 1]], ['#776e5c', '#9a8b70', '#c3ae8c', '#e0cfac']);
    [[-7.7, -4.8, 1.6, 0.8], [-2.1, -6.7, 1.3, 0.7], [3, -6.2, 1.8, 0.9], [7.4, 3.8, 1.5, 0.8], [-7.9, 4.4, 1.1, 0.95], [5.2, 7.4, 1.25, 0.65]].forEach(([x, z, rx, rz], i) => facetedRock(root, `Khark coral outcrop ${i}`, x, -1.8, z, rx, 0.9, rz, ['#9d8d72', '#c8b18c', '#d8c5a4'], 190 + i));
    // Low broken limestone knolls and a small maritime settlement give the plateau scale.
    for(let i=0;i<11;i++){const x=-6.7+(i%4)*3.8,z=-5.2+Math.floor(i/4)*3.9;facetedRock(root,`Khark plateau limestone knoll ${i}`,x,-.1,z,.85+(i%3)*.22,.6+(i%2)*.3,.75,['#b7a17e','#dbcca7','#c4b28f'],420+i);}
    patch(root,'Khark lighthouse footpath',[[-5.4,5.7],[-4.5,1.2],[-1.5,-.2],[3.7,1],[4.6,2],[0,.8],[-3.5,2],[-4.6,5.9]],-.33,'#e5d8b9');
    resortBuilding(root,'Khark harbour keeper house',3.6,3.8,1.8,1.1,'#eae0c8');
    resortBuilding(root,'Khark storage shelter',5.8,1.4,1.2,.8,'#d5c39d');
    lighthouse();
    const jetty = group('Khark working limestone jetty', [4.8, -2.9, 7.2]);
    for (let i = 0; i < 12; i += 1) {
      const slab = box(jetty, 'Jetty stone slab', [1.45, 0.28, 0.26], [0, i * 0.16, i * 0.23], i % 3 ? '#98856b' : '#b6a080');
      slab.rotation.y = (i % 2 ? -1 : 1) * 0.04;
    }
    for (const x of [-0.55, 0.55]) cylinder(jetty, 'Dark mooring post', 0.1, 1.25, [x, -0.45, 2.2], '#4c514c', 7);
    cylinder(root, 'Khark signal pennant staff', 0.035, 1.3, [-4.45, 3.1, 5.7], '#78624b', 6);
    const flag = extruded(root, 'Khark lighthouse signal flag', [[0, 0.2], [1.15, 0.16], [0.83, -0.02], [1.15, -0.24], [0, -0.24]], 0.035, [-4.45, 3.55, 5.7], '#d97450');
    flag.rotation.y = -Math.PI / 2 - 0.22;
    flag.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    animated.push({ object: flag, type: 'pennant', baseline: flag.geometry.attributes.position.array.slice() });
    const boat = group('Khark pilot skiff', [6.2, -3.65, 8.0]);
    const hull = extruded(boat, 'Khark skiff hull', [[-0.9, 0], [-0.55, 0.32], [0.7, 0.25], [0.95, 0], [0.64, -0.24], [-0.55, -0.28]], 0.36, [0, 0, 0], '#3e7480');
    hull.rotation.x = Math.PI / 2;
    box(boat, 'Skiff ochre deck', [1.35, 0.07, 0.42], [0, 0.28, 0], '#c79c64');
    animated.push({ object: boat, type: 'boat', baseY: -3.65, phase: 1.2 });
    sea();
  }

  function dhow(parent, x, z) {
    const boat = group('Hengam lateen dhow', [x, -3.35, z]);
    const hull = extruded(boat, 'Hengam dhow hull', [[-1.15, 0], [-0.72, 0.42], [0.8, 0.3], [1.12, 0], [0.7, -0.32], [-0.75, -0.35]], 0.48, [0, 0, 0], '#6f4b39');
    hull.rotation.x = Math.PI / 2;
    box(boat, 'Dhow teak deck', [1.55, 0.08, 0.55], [0, 0.38, 0], '#d29b5c');
    const mast = cylinder(boat, 'Dhow mast', 0.035, 2.8, [0, 1.6, 0], '#866340', 6);
    mast.rotation.z = -0.07;
    const sail = extruded(boat, 'Dhow cream lateen sail', [[0, 2.9], [0, 0.7], [1.24, 1.02]], 0.04, [0, 0, 0], '#f2e2bd');
    sail.rotation.y = Math.PI / 2;
    animated.push({ object: boat, type: 'boat', baseY: -3.35, phase: 0.3 });
  }

  function dolphin(parent, x, z, phase) {
    const dolphin = group('Hengam stylized dolphin', [x, -3.38, z]);
    const body = addMesh(dolphin, new THREE.SphereGeometry(0.32, 8, 5), material('#4386a1'), 'Dolphin body', [0, 0, 0]);
    body.scale.set(1.8, 0.55, 0.65);
    body.rotation.z = 0.22;
    const fin = cone(dolphin, 'Dolphin dorsal fin', 0.16, 0.45, [0, 0.24, 0], '#356c87', 5);
    fin.rotation.x = Math.PI;
    const tail = box(dolphin, 'Dolphin tail', [0.18, 0.05, 0.55], [-0.55, -0.02, 0], '#356c87');
    tail.rotation.y = 0.5;
    animated.push({ object: dolphin, type: 'dolphin', baseY: -3.38, baseX: x, phase, tail });
  }

  function hengam() {
    const contour = [[-9.5, -7.4], [-5.5, -9.4], [-3.8, -8.3], [-3.4, -5.8], [-1.0, -4.3], [2.4, -4.8], [5.9, -6], [6.4, -8.1], [9.2, -6], [9.4, -1.2], [8.5, 4.6], [5, 8.5], [-1, 9.1], [-6.6, 8], [-10, 3.8], [-10.4, -2]];
    patch(root, 'Hengam quiet sandy shore', contour, -0.36, '#cfae83');
    ringWall('Hengam natural coastal strata', contour, [[-3.8, 0.97], [-2.4, 0.99], [-1.05, 1], [-0.36, 1]], ['#8d785e', '#b89b73', '#d8bf96']);
    patch(root, 'Hengam pale tidal beach', [[-4.1, -8.2], [-3.7, -5.5], [-1, -3.8], [2.6, -4.2], [6.1, -5.5], [6.7, -7.8], [7.8, -6.2], [6.7, -3.8], [2.5, -2.9], [-1.2, -2.6], [-5.1, -4.8]], -0.34, '#ead5aa');
    [[-8.2, 4.8, 2.1, 1.25], [-6.4, 1.9, 1.5, 1.15], [7.0, 3.8, 2.2, 1.1], [8.0, -2.2, 1.8, 1.3], [-2.7, 7.2, 1.7, 0.85], [3.7, 7.7, 1.2, 0.9]].forEach(([x, z, rx, rz], i) => facetedRock(root, `Hengam wind-shaped rock ${i}`, x, -2.0, z, rx, 1.1, rz, ['#827563', '#aa8f6d', '#c3a27a'], 310 + i));
    for (let i = 0; i < 8; i += 1) facetedRock(root, `Hengam beach stone ${i}`, -5.5 + i * 1.2, -3.0, -5.2 + Math.sin(i) * 0.42, 0.26 + (i % 2) * 0.12, 0.22, 0.38, ['#8f7d65', '#b99a71'], 340 + i);
    // Raised natural rock clusters break up the interior without a resort silhouette.
    for(const [i,x,z,rx,ry,rz] of [[0,-6,3.6,2.4,1.25,1.8],[1,-3.8,5.4,2.1,.95,1.5],[2,5.9,2.6,2.4,1.4,2],[3,5.1,-.4,1.6,.9,1.6],[4,-6.3,-1.4,1.4,.75,1.8]])facetedRock(root,`Hengam exposed coastal ridge ${i}`,x,.2,z,rx,ry,rz,['#8f7f68','#b49a76','#cdb18a'],510+i);
    patch(root,'Hengam sandy walking strand',[[-7,2],[-4,1],[0,1.5],[3,0],[4,-2],[2,-1],[0,.3],[-4,.3],[-7,1]],-.32,'#e8cda0');
    dhow(root, 1.5, -6.6);
    dolphin(root, -1.8, -7.4, 0.2);
    dolphin(root, 4.0, -6.9, 1.5);
    palm(root, 'Hengam lone shore palm', -7.9, -4.9, 0.68);
    const shell = group('Hengam shell cove', [-1.8, -0.32, 3.1]);
    for (let i = 0; i < 9; i += 1) {
      const shellRock = facetedRock(shell, 'Rounded shell cove stone', -1.2 + (i % 5) * 0.55, 0.06 + (i % 3) * 0.03, -0.65 + Math.floor(i / 5) * 0.5, 0.22, 0.13, 0.18, ['#e8d3ac', '#d7b98c'], 370 + i);
      shellRock.rotation.y = i * 0.4;
    }
    sea();
  }

  ({ qeshm, kish, khark, hengam }[id])();
  scene.add(root);

  return {
    root,
    update(t = 0) {
      if (disposed) return;
      // Every angular frequency is a multiple of 0.05; wrap at their common
      // period before multiplication so even extreme finite timestamps stay safe.
      const time = Number.isFinite(t) ? t % (TAU * 20) : 0;
      animated.forEach((item) => {
        const phase = item.phase || 0;
        if (item.type === 'water') item.object.position.y = item.baseY + Math.sin(time * 0.7) * 0.012;
        if (item.type === 'palm') {
          item.object.rotation.z = (Math.sin(time * 1.3 + phase) - Math.sin(phase)) * 0.075;
          item.object.rotation.x = (Math.sin(time * 0.9 + phase) - Math.sin(phase)) * 0.045;
        }
        if (item.type === 'tidal-skiff') {
          item.object.position.y = item.baseY + Math.sin(time * 1.15) * 0.09;
          item.object.rotation.z = Math.sin(time * 0.85) * 0.065;
        }
        if (item.type === 'bob') item.object.position.y = item.baseY + (Math.sin(time * 1.1 + phase) - Math.sin(phase)) * 0.035;
        if (item.type === 'pennant' && item.lastTime !== time) {
          const position = item.object.geometry.attributes.position;
          for (let i = 0; i < position.count; i += 1) {
            const x = item.baseline[i * 3];
            position.array[i * 3 + 2] = item.baseline[i * 3 + 2] + x * 0.12 * (Math.sin(time * 3.4 - x * 2) - Math.sin(-x * 2));
          }
          position.needsUpdate = true;
          item.object.geometry.computeVertexNormals();
          item.object.geometry.computeBoundingSphere();
          item.lastTime = time;
        }
        if (item.type === 'boat') {
          item.object.position.y = item.baseY + (Math.sin(time * 0.9 + phase) - Math.sin(phase)) * 0.09;
          item.object.rotation.z = (Math.sin(time * 0.65 + phase) - Math.sin(phase)) * 0.055;
        }
        if (item.type === 'dolphin') {
          const stroke = Math.sin(time * 1.35 + phase) - Math.sin(phase);
          item.object.position.x = item.baseX + (Math.sin(time * 0.75 + phase) - Math.sin(phase)) * 0.34;
          item.object.position.y = item.baseY + stroke * 0.32;
          item.object.rotation.z = stroke * 0.18;
          item.tail.rotation.z = (Math.sin(time * 3.4 + phase) - Math.sin(phase)) * 0.3;
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((value) => value.dispose());
      geometries.clear();
      materials.clear();
      materialCache.clear();
      root.clear();
    },
  };
}

export { createIslandPreview };
export default createIslandPreview;
