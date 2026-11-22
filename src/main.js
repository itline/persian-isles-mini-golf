import * as THREE from 'three';
import { createEnvironment } from './environment.js';
import { createHormuzCourse, COURSE } from './course.js';
import { readJourneyProgress, writeJourneyProgress, clearJourneyProgress, recordCompletedJourney } from './journeyProgress.js';
import { readInvitation, resultShare } from './resultShare.js';
import { initialHormuzState, clampPower, scoreLabel } from './game.js';
import { shotSpeed, captureCup, saveBest } from './shot.js';
import { PhysicsWorld } from './vendor/physics/PhysicsWorld';
import { BallController } from './vendor/player/BallController';
import {
  ISLANDS,
  LEVELS,
  playableLevel,
  levelRecordKey,
  journeySummary,
  clampZoom,
  levelsForIsland,
  nextLevel,
} from './journey.js';
import { createCoastalAudio } from './audio.js';
import { createShotStatusView } from './shotStatus.js';
import { touchCourseView, updateCameraFraming } from './cameraView.js';
import { projectedBounds, screenAnchorToPlane } from './projection.js';
import { updateIslandMotion } from './sceneMotion.js';
import { createDistantFleet } from './distantFleet.js';
import { createIslandAtmosphere, islandSceneProfile } from './islandAtmosphere.js';
import { version as GAME_VERSION } from '../package.json';
import './styles.css';
import './mobile.css';
import './collection.css';
import './refresh.css';
import './release.css';
import './typography.css';

const $ = (selector) => document.querySelector(selector);
function courseSketch(level) {
  const points = level.outline.map(([x, z]) => `${x},${z}`).join(' ');
  return `<svg class="course-sketch" viewBox="-10 -8 20 18" aria-hidden="true"><ellipse cx="0" cy="1" rx="9.5" ry="7.5" fill="#d4d7b4"/><polygon points="${points}" fill="#839d73" stroke="#fff5db" stroke-width=".7" stroke-linejoin="round"/><circle cx="${level.start.x}" cy="${level.start.z}" r=".45" fill="#fff9ed"/><circle cx="${level.hole.x}" cy="${level.hole.z}" r=".45" fill="#234c48"/><path d="M${level.hole.x},${level.hole.z}v-2.1l1.6,.6-1.6,.5" fill="#df6852" stroke="#df6852" stroke-width=".22"/></svg>`;
}
$('#app').innerHTML = `
  <canvas id="scene" aria-label="Three dimensional miniature golf course inspired by Hormuz Island"></canvas>
  <section id="menu" class="menu">
    <div class="brand" aria-label="Persian Isles Mini Golf"><img class="brand-icon" src="/icon.svg" alt="" width="44" height="44"><div class="brand-copy"><span class="brand-name">Persian Isles Mini Golf</span><small class="brand-slogan">A little golf. A world away.</small></div></div>
    <div class="hero-copy"><h1>Choose your island</h1>
    <p class="lede" id="islandDescription">Find your line through a little world of red earth, salt-white cliffs and turquoise water.</p>
    <div class="island-nav"><button id="prevIsland" aria-label="Previous island">←</button><strong id="selectedIslandName">Hormuz</strong><button id="nextIsland" aria-label="Next island">→</button></div><div class="island-switcher" aria-label="Choose an island">${ISLANDS.map((island) => `<button class="island-tab ${island.id === 'hormuz' ? 'selected' : ''}" data-island="${island.id}"><span>${island.name}</span>${island.playable ? '' : '<b class="preview-dot" aria-hidden="true">○</b>'}</button>`).join('')}</div>
    <div class="island-availability hidden" id="islandAvailability" role="status"></div>
    <button id="play" class="primary" disabled>Preparing the island…</button>
    <button id="continueJourney" class="secondary hidden" disabled>Continue Hormuz journey</button>
    <p id="journeyCheckpointNote" class="journey-note hidden">Completed holes are saved. An interrupted hole restarts from its tee.</p>
    <div id="invitation" class="invitation hidden"><p id="invitationLabel"></p><button id="invitationPlay" class="secondary">Play invited hole</button></div>
    <div id="journeyNote" class="journey-note"><b data-ui="Practice a hole">Practice a hole</b></div>
    <div id="levelGrid" class="level-grid" aria-label="Hormuz holes">${LEVELS.map((level) => `<button class="level-button" data-level="${level.id}"><span>${String(level.id).padStart(2, '0')}</span><small>${level.name}</small>${courseSketch(level)}<i class="level-complete"></i></button>`).join('')}</div>
    <div class="edition hidden" id="edition">HORMUZ <span>•</span> RAINBOW RUN <span>•</span> PAR 4</div></div>
    <aside class="postcard"><span class="eyebrow" id="postcardEyebrow">THE RAINBOW ISLAND</span><b id="postcardName">Hormuz Island</b><small id="postcardText">A miniature inspired by Iran’s rainbow island.<br>Playful geography, not a map.</small></aside>
    <button id="menuSound" class="circle-btn menu-sound" aria-label="Sound settings" title="Sound settings"></button>
    <footer class="menu-footer"><span>FIVE ISLANDS. ONE COAST.</span><div><a class="text-btn" href="https://github.com/itline/persian-isles-mini-golf/issues" target="_blank" rel="noopener noreferrer" title="Report a bug or suggest an improvement on GitHub. A GitHub account is required; reports are public.">Feedback ↗</a><a class="text-btn" href="https://github.com/itline/persian-isles-mini-golf" target="_blank" rel="noopener noreferrer">GitHub ↗</a><button id="helpFooter" class="text-btn">How to play</button><button id="creditsOpen" class="text-btn">About</button></div></footer>
  </section>
  <section id="game" class="hidden"><div id="cupCelebration" aria-hidden="true">Nice line.</div>
    <header class="topbar"><div class="game-title" role="group" aria-label="Round information"><div class="course-context"><span id="courseIsland">Hormuz</span> · Hole <span id="holeNumber">1</span></div><strong id="levelName">Red Shore</strong><div class="round-stats"><span>Strokes <b id="strokes">0</b></span><span class="stat-divider" aria-hidden="true">·</span><span>Par <b id="coursePar">2</b></span></div></div>
    <div class="game-navigation"><button id="sound" class="circle-btn" aria-label="Sound settings" title="Sound settings">♪</button><button id="pause" class="circle-btn" aria-label="Pause game" title="Pause game"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg></button></div></header>
    <span id="status" class="sr-only" aria-live="polite">Loading</span>
    <div class="zoom-controls" role="group" aria-label="Camera controls"><button id="zoomOut" aria-label="Zoom out" title="Zoom out">−</button><button id="zoomIn" aria-label="Zoom in" title="Zoom in">+</button><button id="overview" aria-label="Reset camera" title="Reset camera">⤢</button></div>
    <div id="hint" class="hint"><span class="gesture-demo" aria-hidden="true">○ ┄ ↙</span><b data-ui="Drag back, release to putt.">Drag back, release to putt.</b><span data-ui="Scroll or pinch to zoom.">Scroll or pinch to zoom.</span></div>
  </section>
  <section id="pausePanel" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="pauseTitle"><div class="panel"><p class="eyebrow">ON ISLAND TIME</p><h2 id="pauseTitle">Take a breath.</h2><p>The coast can wait. Your next line is right where you left it.</p><button id="resume" class="primary">Resume</button><button id="restart" class="secondary">Restart</button><button id="backHome" class="text-btn">Back to the coast</button></div></section>
  <section id="resultPanel" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="resultTitle"><div class="panel result"><p class="eyebrow" id="resultEyebrow">HORMUZ / HOLE COMPLETE</p><h2 id="resultTitle">A line to remember.</h2><div class="score-number"><b id="resultStrokes">0</b><div><span id="resultScore">PAR</span><small id="resultSubscore">strokes · par 2</small></div></div><div class="result-metrics"><span>Par <b id="resultPar">2</b></span><span>Best <b id="resultBest">—</b></span><span>Previous <b id="resultPreviousBest">—</b></span></div><p id="recordNote"></p><div id="journeyResults" class="journey-results hidden"></div><button id="resultRetry" class="primary">Find a better line ↗</button><button id="resultNext" class="secondary">Next open hole</button><button id="resultShare" class="secondary">Share result</button><p id="shareNotice" role="status" aria-live="polite"></p><label id="shareFallback" class="hidden">Your result<textarea id="shareText" readonly rows="5"></textarea></label><button id="resultHome" class="text-btn">Back to the coast</button></div></section>
  <section id="credits" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="creditTitle"><div class="panel credits"><p class="eyebrow">ABOUT THE GAME</p><h2 id="creditTitle">A coast of our own.</h2><p class="about-intro">Persian Isles Mini Golf is a little escape to the Iranian islands. Find your line across red earth, pale cliffs and turquoise water, with thoughtful shots and a coast worth exploring.</p><p class="game-version">Version ${GAME_VERSION}</p><h3>Credits</h3><p>Created by <a href="https://github.com/itline" target="_blank" rel="noopener">itline</a>.</p><p>Procedural landscapes, course, interface and synthesized audio created for this project. No models or art were taken from the benchmark game.</p><p>Ball & fixed-step physics adapted from <a href="https://github.com/LCmaster/minigolf" target="_blank" rel="noopener">Mini Golf Mania</a> by Luiz Vicente (MIT). Three.js (MIT), Rapier (Apache-2.0). Required notices ship with the build.</p><p>Nature reference: <a href="https://science.nasa.gov/earth/earth-observatory/irans-rainbow-island-147428" target="_blank" rel="noopener">NASA Earth Observatory, Iran’s Rainbow Island</a>.</p><button id="creditsClose" class="primary">Back</button></div></section>
  <section id="audioPanel" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="audioTitle"><div class="panel"><p class="eyebrow">COASTAL SOUNDS</p><h2 id="audioTitle">A quieter rhythm.</h2><p>Original, softly synthesized island music. Music and game sounds are optional and saved separately on this device.</p><label class="audio-option"><span>Island music</span><input id="musicToggle" type="checkbox"></label><label class="audio-option"><span>Shot &amp; completion sounds</span><input id="effectsToggle" type="checkbox"></label><p id="audioNotice" aria-live="polite"></p><button id="audioClose" class="primary">Back</button></div></section>
  <section id="leavePanel" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="leaveTitle"><div class="panel"><p class="eyebrow">BACK TO THE COAST</p><h2 id="leaveTitle">Back to the islands?</h2><p>Your progress in this round will be lost. Saved best scores will stay.</p><button id="leaveCancel" class="primary">Keep playing</button><button id="leaveConfirm" class="secondary">Back to islands</button></div></section>
  <div id="sceneFade" aria-hidden="true"></div>
  <section id="helpPanel" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="helpTitle"><div class="panel"><h2 id="helpTitle" data-ui="How to play">How to play</h2><ol class="help-steps"><li data-ui="Drag back, release to putt.">Drag back, release to putt.</li><li data-ui="Longer drag, more power.">Longer drag, more power.</li><li data-ui="Scroll or pinch to zoom.">Scroll or pinch to zoom.</li><li data-ui="Arrows aim and set power. Space puts.">Arrows aim and set power. Space puts.</li></ol><button id="helpClose" class="primary" data-ui="Back">Back</button></div></section>
  <div id="loadError" class="load-error hidden" role="alert"></div>`;

const num = (value) => new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(value);
document.documentElement.lang = 'en';
document.documentElement.dir = 'ltr';
document.title = 'Persian Isles Mini Golf';
let audioNoticeKey = '';
let loadErrorKey = '';
function renderFailureNotices() {
  $('#audioNotice').textContent = audioNoticeKey;
  if (loadErrorKey) {
    $('#play').textContent = 'Unable to load';
    $('#loadError').textContent = loadErrorKey;
    $('#loadError').classList.remove('hidden');
  }
}
const invitation = readInvitation(location.href);
let renderer, environment, physicalCourse, courseLevel, ball;
const sceneryClock = { value: 0 };
const scene = new THREE.Scene();
scene.background = new THREE.Color('#b3dce0');
scene.fog = new THREE.Fog('#b3dce0', 58, 125);
// Visual-only parent: rigid bodies/colliders stay in their original world frame.
const menuDiorama = new THREE.Group();
scene.add(menuDiorama);
const distantFleet = createDistantFleet(scene);
const islandAtmosphere = createIslandAtmosphere(scene);
const fleetRay = new THREE.Raycaster(),
  fleetSea = new THREE.Plane(new THREE.Vector3(0, 1, 0), 3.65);
const atmosphereRay = new THREE.Raycaster(),
  atmosphereSea = new THREE.Plane(new THREE.Vector3(0, 1, 0), 3.64);
const camera = new THREE.OrthographicCamera(-18, 18, 13, -13, 0.1, 200);
const cameraAimTarget = new THREE.Vector3(),
  cameraOffset = new THREE.Vector3();
const arrowUp = new THREE.Vector3(0, 1, 0),
  arrowDirection = new THREE.Vector3();
const anchorNdc = new THREE.Vector2(),
  anchorPoint = new THREE.Vector3();
const compactDetailAnchors = [
  [0.48, 0.78],
  [0.92, 0.76],
];
let fleetLayoutKey = '',
  fleetProfile,
  fleetVessels;
function restoreDiorama() {
  updateIslandMotion(menuDiorama, 0, { active: false });
}
function islandCorners() {
  return [-11, 11].flatMap((x) =>
    [-3.8, 5.5].flatMap((y) =>
      [-9, 9].map((z) => {
        const v = menuDiorama.localToWorld(new THREE.Vector3(x, y, z)).project(camera);
        return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
      }),
    ),
  );
}
function positionDistantFleet() {
  distantFleet.root.visible = !playing;
  islandAtmosphere.root.visible = !playing;
  if (playing) return;
  camera.updateMatrixWorld();
  const portrait = innerWidth < innerHeight;
  // Match the folio's intermediate-width breakpoint in release.css.
  const compact = innerWidth <= 1100;
  const key = `${previewId || 'hormuz'}:${portrait}:${compact}`;
  if (key !== fleetLayoutKey) {
    fleetLayoutKey = key;
    fleetProfile = islandSceneProfile(previewId || 'hormuz', portrait, compact);
    fleetVessels = fleetProfile.kinds.map((kind) =>
      distantFleet.boats.find((boat) => boat.userData.kind === kind),
    );
  }
  const profile = fleetProfile;
  const unit = (camera.right - camera.left) / innerWidth;
  const vessels = fleetVessels;
  distantFleet.boats.forEach((boat) => {
    const i = vessels.indexOf(boat);
    boat.visible = i >= 0;
    if (!boat.visible) return;
    const [x, y] = profile.anchors[i];
    const point = screenAnchorToPlane(
      x,
      y,
      innerHeight,
      camera,
      fleetRay,
      fleetSea,
      anchorNdc,
      anchorPoint,
    );
    if (!point) {
      boat.visible = false;
      return;
    }
    boat.position.copy(point);
    boat.scale.setScalar((unit * profile.widths[i]) / 2);
    boat.rotation.y = profile.yaws[i];
  });
  islandAtmosphere.root.visible = !playing;
  islandAtmosphere.setIsland(previewId || 'hormuz');
  for (const detail of islandAtmosphere.details) {
    if (!detail.visible) continue;
    const mode = portrait ? 'portrait' : 'landscape';
    const [x, y] =
      !portrait && compact
        ? compactDetailAnchors[islandAtmosphere.details.indexOf(detail) % 2]
        : detail.userData.anchors[mode];
    const point = screenAnchorToPlane(
      x,
      y,
      innerHeight,
      camera,
      atmosphereRay,
      atmosphereSea,
      anchorNdc,
      anchorPoint,
    );
    if (!point) {
      detail.visible = false;
      continue;
    }
    detail.position.copy(point);
    detail.scale.setScalar((unit * detail.userData.widthPx[mode]) / 2);
  }
  distantFleet.update(reducedMotion.matches ? 0 : sceneryClock.value);
}
function fleetBounds() {
  const boats = distantFleet.boats
    .filter((b) => b.visible)
    .map((boat) => ({
      kind: boat.userData.kind,
      ...projectedBounds(boat, camera, innerWidth, innerHeight),
    }));
  const details = islandAtmosphere.details
    .filter((d) => d.visible)
    .map((detail) => projectedBounds(detail, camera, innerWidth, innerHeight));
  return { visible: distantFleet.root.visible, boats, details };
}
const physics = new PhysicsWorld();
let state = { ...initialHormuzState },
  playing = false,
  paused = false,
  ready = false;
let drag = null,
  orbit = null,
  aimAngle = 0,
  power = 0.45,
  zoom = 1,
  orbitAngle = 0.62;
let selectedIsland = 'hormuz',
  selectedLevel = 1,
  preview,
  previewId = 'hormuz',
  previewVersion = 0;
let mode = 'single',
  journeyScores = [],
  journeyRecord = null,
  journeyFinished = false,
  audioWasPaused = false,
  helpWasPaused = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let sceneColorTarget = new THREE.Color('#b3dce0'),
  transitionTimer = null;
let tutorialSeen = false;
try {
  tutorialSeen = localStorage.getItem('golf:tutorial-seen') === 'yes';
} catch {}
let touchOverview = false;
let targetZoom = 1,
  cameraFrozen = false;
const pointers = new Map();
let pinch = null,
  menuSwipe = null;
const presets = {
  hormuz: '#b3dce0',
  qeshm: '#bfd4d1',
  kish: '#bbe3e5',
  khark: '#b6d4d4',
  hengam: '#a8dbe1',
};
const coastalAudio = createCoastalAudio();
let lastTime = performance.now(),
  best = null;
let cameraTarget = new THREE.Vector3(),
  cameraPosition = new THREE.Vector3(),
  completionTimer = null;
// The original slice record belongs only to the unchanged Rainbow Run (hole 3).
try {
  const old = Number(localStorage.getItem('persian-isles-golf:hormuz:course-v1'));
  if (Number.isInteger(old) && old > 0 && !localStorage.getItem(levelRecordKey(3)))
    localStorage.setItem(levelRecordKey(3), String(old));
} catch {}
const canvas = $('#scene');
const coarsePointer = matchMedia('(pointer: coarse)');
const ballMarker = new THREE.Mesh(
  new THREE.RingGeometry(0.19, 0.235, 32),
  new THREE.MeshBasicMaterial({
    color: '#143e48',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  }),
);
ballMarker.rotation.x = -Math.PI / 2;
scene.add(ballMarker);
const arrowGroup = new THREE.Group();
scene.add(arrowGroup);
const arrowMaterial = new THREE.MeshBasicMaterial({
  color: '#0e6a72',
  transparent: true,
  opacity: 0.8,
  depthTest: false,
});
const dotGeometry = new THREE.SphereGeometry(0.043, 8, 6);
const dots = [];
for (let i = 0; i < 17; i++) {
  const dot = new THREE.Mesh(dotGeometry, arrowMaterial);
  dot.renderOrder = 7;
  arrowGroup.add(dot);
  dots.push(dot);
}
const arrowTip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 3), arrowMaterial);
arrowTip.rotation.x = -Math.PI / 2;
arrowGroup.add(arrowTip);
arrowGroup.visible = false;
const targetRing = new THREE.Mesh(
  new THREE.RingGeometry(0.19, 0.23, 40),
  new THREE.MeshBasicMaterial({ color: '#f8e6ac', side: THREE.DoubleSide, depthWrite: false }),
);
targetRing.rotation.x = -Math.PI / 2;
targetRing.position.set(COURSE.start.x, 0.02, COURSE.start.z);
scene.add(targetRing);
const origin = new THREE.Mesh(
  new THREE.CircleGeometry(0.36, 32),
  new THREE.MeshBasicMaterial({
    color: '#e85d43',
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  }),
);
origin.rotation.x = -Math.PI / 2;
origin.position.set(COURSE.start.x, 0.025, COURSE.start.z);
scene.add(origin);
const finishFlag = new THREE.Group();
const flagPole = new THREE.Mesh(
  new THREE.CylinderGeometry(0.035, 0.045, 1.65, 8),
  new THREE.MeshStandardMaterial({ color: '#f7ead0', roughness: 0.65 }),
);
flagPole.position.y = 0.82;
flagPole.castShadow = true;
const flagShape = new THREE.Shape();
flagShape.moveTo(0, 1.55);
flagShape.lineTo(0.75, 1.35);
flagShape.lineTo(0, 1.12);
flagShape.closePath();
const flagMesh = new THREE.Mesh(
  new THREE.ShapeGeometry(flagShape),
  new THREE.MeshStandardMaterial({ color: '#e85d43', side: THREE.DoubleSide, roughness: 0.7 }),
);
flagMesh.position.x = 0.02;
flagMesh.castShadow = true;
finishFlag.add(flagPole, flagMesh);
finishFlag.position.set(COURSE.hole.x, 0.04, COURSE.hole.z);
scene.add(finishFlag);

function renderLevelCards() {
  const islandLevels = levelsForIsland(selectedIsland);
  $('#levelGrid').setAttribute('aria-label', `${currentIsland().name} holes`);
  document.querySelectorAll('.level-button').forEach((button) => {
    const level = LEVELS.find((l) => l.id === Number(button.dataset.level));
    button.classList.toggle('hidden', level.available && !islandLevels.includes(level));
    button.disabled = !islandLevels.includes(level);
    const record = readBest(level.id);
    const number = level.number ?? level.id;
    button.querySelector('span').textContent = num(number);
    button.querySelector('small').textContent = level.name;
    button.title = level.name;
    button.setAttribute('aria-label', `Hole ${num(number)} · ${level.name}`);
    if (level.available) {
      button.querySelector('.level-complete').textContent = record == null ? '' : '✓';
      button.querySelector('.level-complete').title =
        record == null ? 'Not played yet' : 'Completed';
    }
  });
}
function styleResultActions() {
  const nextPrimary = mode === 'journey' && !journeyFinished;
  $('#resultNext').classList.toggle('primary', nextPrimary);
  $('#resultNext').classList.toggle('secondary', !nextPrimary);
  $('#resultRetry').classList.toggle('primary', !nextPrimary);
  $('#resultRetry').classList.toggle('secondary', nextPrimary);
}
function currentLevel() {
  return playableLevel(selectedLevel) || playableLevel(1);
}
function currentIsland() {
  return ISLANDS.find(island => island.id === selectedIsland);
}
function setLevelUI() {
  const level = currentLevel();
  $('#coursePar').textContent = num(level.par);
  $('#holeNumber').textContent = num(level.number ?? level.id);
  $('#courseIsland').textContent = currentIsland().name;
  canvas.setAttribute('aria-label', `Three dimensional miniature golf course inspired by ${currentIsland().name} Island`);
  $('#levelName').textContent = level.name;
  $('#resultSubscore').textContent = `strokes · par ${num(level.par)}`;
  $('#edition').textContent = '';
}
const renderShotStatus = createShotStatusView({
  status: $('#status'),
});
function setStatus(text) {
  renderShotStatus(text);
}
function updateHud() {
  $('#strokes').textContent = num(state.strokes);
}
function updateBest() {
  try {
    const stored = Number(localStorage.getItem(levelRecordKey(selectedLevel)));
    best = Number.isInteger(stored) && stored > 0 ? stored : null;
  } catch {
    best = null;
  }
}
function sound(frequency = 440, duration = 0.06) {
  coastalAudio.effect(frequency, duration);
}
function unlockPreferredAudio() {
  const { music, effects } = coastalAudio.getState();
  return music || effects ? coastalAudio.unlock() : Promise.resolve(true);
}
function reset() {
  if (!ready) return;
  $('#resultEyebrow').textContent = `${currentIsland().name.toUpperCase()} / HOLE COMPLETE`;
  $('#game').classList.remove('celebrating');
  const level = currentLevel();
  if (mode === 'journey') {
    journeyRecord = null;
    journeyScores = journeyScores.slice(0, levelsForIsland(selectedIsland).indexOf(level));
    if (journeyScores.length) writeJourneyProgress(undefined, journeyScores);
    else clearJourneyProgress();
  }
  environment.root.visible = selectedIsland === 'hormuz';
  if (preview) preview.root.visible = false;
  physicalCourse?.dispose();
  physicalCourse = createHormuzCourse(menuDiorama, physics, level);
  courseLevel = level.id;
  origin.visible = true;
  clearTimeout(completionTimer);
  journeyFinished = false;
  cameraFrozen = false;
  pointers.clear();
  pinch = null;
  $('#journeyResults').classList.add('hidden');
  resetShareFeedback();
  $('#resultNext').classList.remove('hidden');
  $('#resultRetry').textContent = 'Find a better line ↗';
  $('#resultTitle').textContent = 'A line to remember.';
  $('#resultNext').textContent =
    mode === 'journey' && !nextLevel(selectedLevel) ? 'See journey results' : 'Next open hole';
  styleResultActions();
  $('#resultNext').disabled = mode !== 'journey' && !nextLevel(selectedLevel);
  drag = null;
  orbit = null;
  state = { ...initialHormuzState, island: currentIsland().name, par: level.par };
  paused = false;
  coastalAudio.setPaused(false);
  aimAngle = 0;
  power = 0.45;
  zoom = 1;
  targetZoom = 1;
  touchOverview = false;
  ball.createPhysicsBody(new THREE.Vector3(level.start.x, 0.16, level.start.z));
  ball.setVisible(true);
  finishFlag.visible = true;
  ball.setBallColor('#fff9ed');
  ball.mesh.scale.setScalar(1);
  ball.ghostSphereMesh.visible = false;
  finishFlag.position.set(level.hole.x, 0.04, level.hole.z);
  targetRing.position.set(level.start.x, 0.025, level.start.z);
  origin.position.set(level.start.x, 0.025, level.start.z);
  $('#pausePanel').classList.add('hidden');
  $('#resultPanel').classList.add('hidden');
  $('#hint').classList.toggle('hidden', tutorialSeen);
  updateBest();
  setLevelUI();
  updateHud();
  setStatus('Ready to putt');
  resize();
}
async function start(journey = false, checkpoint = null) {
  if (!ready || !currentIsland().playable || previewId !== selectedIsland) return;
  restoreDiorama();
  mode = journey ? 'journey' : 'single';
  journeyScores = journey && checkpoint ? [...checkpoint] : [];
  if (journey) {
    if (!checkpoint) clearJourneyProgress();
    selectedLevel = levelsForIsland(selectedIsland)[journeyScores.length].id;
  }
  playing = true;
  history.replaceState({ ...history.state, golfView: 'menu' }, '', location.href);
  history.pushState({ ...history.state, golfView: 'game', golfReturnToMenu: true }, '', location.href);
  $('#menu').classList.add('hidden');
  $('#game').classList.remove('hidden');
  reset();
  menuDiorama.add(physicalCourse.group);
  resize();
  canvas.focus();
  await unlockPreferredAudio();
  sound(660);
}
let leavingGame = false, restoreForLeave = false, leaveWasPaused = false, leaveFocus = null;
// A synthetic game entry always has its real island menu immediately before it.
// Traverse back to that entry after reload/Forward instead of creating menu → menu.
function discardStaleGameEntry() {
  if (history.state?.golfReturnToMenu) history.back();
  else history.replaceState({ ...history.state, golfView: 'menu' }, '', location.href);
}
if (history.state?.golfView === 'game') discardStaleGameEntry();
function leaveDialog(open) {
  $('#leavePanel').classList.toggle('hidden', !open);
  for (const id of ['game', 'pausePanel', 'resultPanel', 'helpPanel', 'audioPanel']) $('#' + id).inert = open;
}
function hasRoundProgress() {
  return !journeyFinished && (state.strokes > 0 || journeyScores.length > 0);
}
function requestHome() {
  if (!playing) return;
  if (!hasRoundProgress()) return home();
  if (!$('#leavePanel').classList.contains('hidden')) return;
  leaveWasPaused = paused;
  leaveFocus = document.activeElement;
  cancelDrag();
  paused = true;
  coastalAudio.setPaused(true);
  leaveDialog(true);
  $('#leaveCancel').focus();
}
function cancelLeave() {
  if (leavingGame) return;
  leaveDialog(false);
  paused = leaveWasPaused;
  coastalAudio.setPaused(paused);
  if (leaveFocus?.isConnected && leaveFocus.getClientRects().length && !leaveFocus.closest('[inert]')) leaveFocus.focus();
  else canvas.focus();
}
function home() {
  if (history.state?.golfView === 'game') {
    if (leavingGame) return;
    leavingGame = true;
    $('#leaveCancel').disabled = true;
    $('#leaveConfirm').disabled = true;
    history.back();
    return;
  }
  showHome();
}
addEventListener('popstate', () => {
  if (!playing && history.state?.golfView === 'game') {
    discardStaleGameEntry();
  } else if (leavingGame) {
    leavingGame = false;
    showHome();
  } else if (restoreForLeave && history.state?.golfView === 'game') {
    restoreForLeave = false;
    requestHome();
  } else if (playing && history.state?.golfView !== 'game') {
    if (hasRoundProgress()) {
      restoreForLeave = true;
      history.forward();
    } else showHome();
  }
});
function showHome() {
  clearTimeout(completionTimer);
  leaveDialog(false);
  $('#leaveCancel').disabled = false;
  $('#leaveConfirm').disabled = false;
  for (const id of ['leavePanel', 'helpPanel', 'audioPanel']) $('#' + id).classList.add('hidden');
  playing = false;
  paused = false;
  drag = null;
  coastalAudio.setPaused(false);
  $('#pausePanel').classList.add('hidden');
  $('#resultPanel').classList.add('hidden');
  $('#game').classList.add('hidden');
  $('#menu').classList.remove('hidden');
  arrowGroup.visible = false;
  targetZoom = 1;
  cameraFrozen = false;
  pointers.clear();
  pinch = null;
  mode = 'single';
  selectIsland(selectedIsland);
  $('#play').focus();
}
function togglePause() {
  if (!playing || !ready || state.completed) return;
  paused = !paused;
  interruptGestures();
  coastalAudio.setPaused(paused);
  $('#pausePanel').classList.toggle('hidden', !paused);
  if (paused) $('#resume').focus();
  else canvas.focus();
}
function aimDir() {
  return { x: Math.sin(aimAngle), z: -Math.cos(aimAngle) };
}
function putt(p = power, dir = aimDir()) {
  if (!ready || !playing || paused || state.completed || ball.state !== 'aiming' || p < 0.025)
    return;
  const force = ball.rigidBody.mass() * shotSpeed(p);
  ball.shoot(new THREE.Vector3(dir.x * force, 0, dir.z * force));
  state.strokes = ball.strokes;
  updateHud();
  setStatus('Rolling');
  sound(300, 0.09);
  $('#hint').classList.add('hidden');
  tutorialSeen = true;
  try {
    localStorage.setItem('golf:tutorial-seen', 'yes');
  } catch {}
}
function complete() {
  if (state.completed) return;
  $('#game').classList.add('celebrating');
  const level = currentLevel();
  state.completed = true;
  interruptGestures();
  ball.sinkAt(new THREE.Vector3(level.hole.x, -0.37, level.hole.z));
  arrowGroup.visible = false;
  if (mode === 'journey') {
    journeyScores[levelsForIsland(selectedIsland).indexOf(level)] = state.strokes;
    if (nextLevel(selectedLevel)) writeJourneyProgress(undefined, journeyScores);
    else journeyRecord = recordCompletedJourney(undefined, journeyScores);
  }
  const old = best;
  best = saveBest(best, state.strokes);
  try {
    localStorage.setItem(levelRecordKey(selectedLevel), String(best));
  } catch {}
  updateHud();
  setStatus('Holed!');
  sound(880, 0.2);
  $('#resultStrokes').textContent = num(state.strokes);
  $('#resultScore').textContent = scoreLabel(state.strokes, level.par);
  $('#resultPar').textContent = num(level.par);
  $('#resultBest').textContent = num(best);
  $('#resultPreviousBest').textContent = old == null ? '—' : num(old);
  $('#recordNote').textContent =
    old == null || state.strokes < old ? 'New personal best on this coast.' : `Best ${num(best)}`;
  completionTimer = setTimeout(() => {
    $('#resultPanel').classList.remove('hidden');
    $(mode === 'journey' ? '#resultNext' : '#resultRetry').focus();
  }, 650);
}
const raycaster = new THREE.Raycaster(),
  groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.11);
function groundPoint(x, y) {
  const rect = canvas.getBoundingClientRect();
  raycaster.setFromCamera(
    new THREE.Vector2(
      ((x - rect.left) / rect.width) * 2 - 1,
      (-(y - rect.top) / rect.height) * 2 + 1,
    ),
    camera,
  );
  return raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
}
function cancelDrag() {
  drag = null;
  orbit = null;
  cameraFrozen = false;
  updateHud();
}
function interruptGestures() {
  for (const id of pointers.keys()) {
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  pointers.clear();
  pinch = null;
  cancelDrag();
}
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// Shared touch navigation covers the scene and non-interactive folio areas.
// pan-y keeps native vertical folio scrolling; multi-touch cancels navigation.
const menuTouches = new Set();
let suppressMenuClickUntil = 0;
document.addEventListener(
  'pointerdown',
  (e) => {
    if (e.pointerType !== 'touch' || playing || !ready) return;
    menuTouches.add(e.pointerId);
    const allowed =
      (e.target === canvas || $('#menu').contains(e.target)) &&
      !e.target.closest('button,a,input,select');
    menuSwipe =
      allowed && menuTouches.size === 1 ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
  },
  { capture: true },
);
document.addEventListener(
  'pointerup',
  (e) => {
    menuTouches.delete(e.pointerId);
    if (!menuSwipe || menuSwipe.id !== e.pointerId) return;
    const { x, y } = menuSwipe;
    menuSwipe = null;
    const dx = e.clientX - x,
      dy = e.clientY - y;
    if (!playing && Math.abs(dx) > 55 && Math.abs(dy) < 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressMenuClickUntil = performance.now() + 350;
      cycleIsland(dx < 0 ? 1 : -1);
    }
  },
  { capture: true },
);
document.addEventListener(
  'pointercancel',
  (e) => {
    menuTouches.delete(e.pointerId);
    menuSwipe = null;
  },
  { capture: true },
);
document.addEventListener(
  'click',
  (e) => {
    if (
      performance.now() < suppressMenuClickUntil &&
      (e.target === canvas || $('#menu').contains(e.target))
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  { capture: true },
);
canvas.addEventListener('pointerdown', (e) => {
  if (!ready) return;
  if (!playing) return;
  if (paused || state.completed || !$('#audioPanel').classList.contains('hidden')) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.setPointerCapture(e.pointerId);
  if (pointers.size >= 2) {
    cancelDrag();
    const a = [...pointers.values()];
    pinch = { distance: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), zoom: targetZoom };
    return;
  }
  if (e.button === 2) {
    orbit = { id: e.pointerId, x: e.clientX };
    return;
  }
  // Keep a held gesture across the rolling → ready transition. putt() still
  // rejects release while moving; never queue an automatic second shot.
  if (e.button !== 0 || !['aiming', 'moving'].includes(ball.state)) return;
  const point = groundPoint(e.clientX, e.clientY);
  if (!point) return;
  cameraFrozen = true;
  drag = { id: e.pointerId, start: point, x: e.clientX, y: e.clientY, dir: aimDir(), p: 0 };
});
canvas.addEventListener('pointermove', (e) => {
  if (!playing || paused || state.completed) return;
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch) {
    const a = [...pointers.values()];
    if (a.length >= 2)
      targetZoom = clampZoom(
        (pinch.zoom * Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)) / Math.max(1, pinch.distance),
      );
    return;
  }
  if (orbit) {
    if (orbit.id !== e.pointerId) return;
    orbitAngle = THREE.MathUtils.clamp(orbitAngle - (e.clientX - orbit.x) * 0.004, 0.1, 1.3);
    orbit.x = e.clientX;
    return;
  }
  updateDrag(e);
});
function updateDrag(e) {
  if (!drag || drag.id !== e.pointerId) return;
  const p = groundPoint(e.clientX, e.clientY);
  if (!p) return;
  const d = drag.start.clone().sub(p);
  d.y = 0;
  const dist = d.length();
  drag.p = clampPower(dist / 3.6);
  if (dist > 0.025) {
    d.normalize();
    drag.dir = { x: d.x, z: d.z };
    aimAngle = Math.atan2(d.x, -d.z);
  }
  updateHud();
}
canvas.addEventListener('pointerup', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (!playing) return;
  if (pinch) {
    if (pointers.size === 0) {
      pinch = null;
      cameraFrozen = false;
    }
    return;
  }
  if (orbit) {
    if (orbit.id !== e.pointerId) return;
    orbit = null;
    return;
  }
  if (!drag || drag.id !== e.pointerId) return;
  updateDrag(e);
  const { p, dir } = drag;
  drag = null;
  cameraFrozen = false;
  putt(p, dir);
});
canvas.addEventListener('pointercancel', () => {
  pointers.clear();
  pinch = null;
  cancelDrag();
});
canvas.addEventListener('lostpointercapture', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.clear();
  pinch = null;
  cancelDrag();
});
addEventListener('blur', () => {
  interruptGestures();
  if (playing && !paused && !state.completed) togglePause();
});
canvas.addEventListener(
  'wheel',
  (e) => {
    if (!playing || paused || drag) return;
    e.preventDefault();
    targetZoom = clampZoom(targetZoom + (e.deltaY < 0 ? 0.1 : -0.1));
  },
  { passive: false },
);
function changeAim(n) {
  if (!paused && ball?.state === 'aiming') aimAngle += n;
}
addEventListener('keydown', (e) => {
  const modal = ['leavePanel', 'audioPanel', 'helpPanel', 'credits', 'resultPanel', 'pausePanel']
    .map(id => $('#' + id)).find(panel => !panel.classList.contains('hidden'));
  if (modal && e.code === 'Tab') {
    const controls = [...modal.querySelectorAll('button, input, textarea, a[href]')]
      .filter(control => !control.disabled && !control.closest('[inert]') && control.getClientRects().length);
    if (controls.length) {
      const index = controls.indexOf(document.activeElement);
      controls[(index + (e.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
    }
    e.preventDefault();
    return;
  }
  if (!$('#leavePanel').classList.contains('hidden')) {
    if (e.code === 'Escape') { e.preventDefault(); cancelLeave(); }
    return;
  }
  if (!$('#audioPanel').classList.contains('hidden')) {
    if (e.code === 'Escape') $('#audioClose').click();
    return;
  }
  if (!$('#helpPanel').classList.contains('hidden')) {
    if (e.code === 'Escape') $('#helpClose').click();
    return;
  }
  if (
    !playing ||
    (['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) &&
      e.code !== 'Escape')
  )
    return;
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code))
    e.preventDefault();
  if (e.code === 'Escape') {
    if (drag) cancelDrag();
    else togglePause();
    return;
  }
  if (paused) return;
  if (e.code === 'Space') putt();
  if (e.code === 'ArrowLeft') changeAim(-0.055);
  if (e.code === 'ArrowRight') changeAim(0.055);
  if (e.code === 'ArrowUp') power = clampPower(power + 0.025);
  if (e.code === 'ArrowDown') power = Math.max(0.08, power - 0.025);
  updateHud();
});
async function selectIsland(id) {
  const island = ISLANDS.find((value) => value.id === id);
  if (!island || playing || !ready) return;
  selectedIsland = id;
  const islandLevels = levelsForIsland(id);
  if (!islandLevels.some(level => level.id === selectedLevel) && islandLevels.length) selectedLevel = islandLevels[0].id;
  const version = ++previewVersion;
  delete $('#menu').dataset.previewReady;
  previewId = null;
  clearTimeout(transitionTimer);
  $('#sceneFade').classList.toggle('fading', !reducedMotion.matches);
  transitionTimer = setTimeout(
    () => $('#sceneFade').classList.remove('fading'),
    reducedMotion.matches ? 0 : 260,
  );
  document.querySelectorAll('.island-tab').forEach((tab) => {
    const selected = tab.dataset.island === id;
    tab.classList.toggle('selected', selected);
    tab.setAttribute('aria-pressed', String(selected));
  });
  $('#selectedIslandName').textContent = island.name;
  $('#islandDescription').textContent = island.description;
  $('#postcardEyebrow').textContent = island.subtitle;
  $('#postcardName').textContent = island.name;
  $('#postcardText').textContent = island.playable
    ? 'Nine holes, one journey. A playful interpretation, not a map.'
    : 'A visual preview. Golf on this island is still in development.';
  $('#islandAvailability').textContent = '';
  $('#islandAvailability').classList.add('hidden');
  $('#play').disabled = true;
  const checkpoint = id === 'hormuz' ? readJourneyProgress() : null;
  $('#continueJourney').classList.toggle('hidden', !checkpoint);
  $('#continueJourney').disabled = true;
  $('#journeyCheckpointNote').classList.toggle('hidden', !checkpoint);
  if (checkpoint) $('#continueJourney').textContent = `Continue Hormuz · hole ${checkpoint.length + 1} of 9`;
  $('#invitationPlay').disabled = true;
  const invitedLevel = invitation?.island === id && invitation.hole
    ? levelsForIsland(id).find(level => (level.number ?? level.id) === invitation.hole) : null;
  $('#invitation').classList.toggle('hidden', !invitedLevel);
  if (invitedLevel) $('#invitationLabel').textContent = `Invited to ${island.name} · Hole ${invitation.hole}: ${invitedLevel.name}`;
  $('#play').innerHTML = island.playable
    ? `Play ${island.name} journey <svg class="play-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3.5 16 10 6 16.5z" fill="currentColor"/></svg>`
    : 'Preview only';
  renderLevelCards();
  $('#levelGrid').classList.toggle('hidden', !island.playable);
  $('#journeyNote').classList.toggle('hidden', !island.playable);
  $('#edition').classList.add('hidden');
  preview?.dispose();
  preview = undefined;
  if (id === 'hormuz' && courseLevel !== selectedLevel) reset();
  environment.root.visible = id === 'hormuz';
  physicalCourse.group.visible = id === 'hormuz';
  ball.setVisible(id === 'hormuz');
  finishFlag.visible = id === 'hormuz';
  origin.visible = false;
  targetRing.visible = false;
  arrowGroup.visible = false;
  sceneColorTarget.set(presets[id]);
  coastalAudio.setIsland(id);
  if (id !== 'hormuz') {
    try {
      const { createIslandPreview } = await import('./islandPreviews.js');
      if (version !== previewVersion) return;
      preview = createIslandPreview(menuDiorama, id);
    } catch (error) {
      if (version !== previewVersion) return;
      $('#islandAvailability').textContent = 'Preview could not load · Try another island';
      $('#islandAvailability').classList.remove('hidden');
      console.error(error);
      return;
    }
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (version !== previewVersion || playing) return;
  renderer.render(scene, camera);
  previewId = id;
  $('#menu').dataset.previewReady = id;
  $('#play').disabled = !island.playable || !ready;
  $('#continueJourney').disabled = !checkpoint || !island.playable || !ready;
  $('#invitationPlay').disabled = !invitedLevel || !ready;
}
function cycleIsland(delta) {
  unlockPreferredAudio();
  const i = ISLANDS.findIndex((island) => island.id === selectedIsland);
  selectIsland(ISLANDS[(i + delta + ISLANDS.length) % ISLANDS.length].id);
}
function selectLevel(id) {
  const level = playableLevel(Number(id));
  if (!level || !levelsForIsland(selectedIsland).includes(level) || !ready) return;
  selectedLevel = level.id;
  start(false);
}
function journeyResults() {
  const summary = journeySummary(journeyScores, selectedIsland);
  if (!summary) return;
  journeyFinished = true;
  $('#resultTitle').textContent = `Your ${currentIsland().name} postcard.`;
  $('#resultStrokes').textContent = num(summary.strokes);
  $('#resultScore').textContent = scoreLabel(summary.strokes, summary.par);
  $('#resultSubscore').textContent = `total strokes · par ${num(summary.par)}`;
  $('#recordNote').textContent = 'Nine holes, one journey. Replay to find a better line.';
  $('#resultEyebrow').textContent = `${currentIsland().name.toUpperCase()} / JOURNEY COMPLETE`;
  const levels = levelsForIsland(selectedIsland);
  $('#journeyResults').innerHTML =
    `<table><thead><tr><th>Hole</th><th>Strokes</th><th>Par</th><th>Best</th></tr></thead><tbody>${summary.scores.map((score, i) => {
      const level = levels[i];
      const record = readBest(level.id);
      return `<tr><td>${level.name}</td><td>${num(score)}</td><td>${num(level.par)}</td><td>${record == null ? '—' : num(record)}</td></tr>`;
    }).join('')}</tbody><tfoot><tr><th>Total</th><th>${num(summary.strokes)}</th><th>${num(summary.par)}</th><th>—</th></tr></tfoot></table>`;
  $('#resultPar').textContent = num(summary.par);
  $('#resultBest').textContent = num(summary.strokes);
  $('#resultPreviousBest').textContent = '—';
  $('#journeyResults').classList.remove('hidden');
  resetShareFeedback();
  $('#resultNext').classList.add('hidden');
  $('#resultRetry').textContent = 'Play the journey again ↗';
  styleResultActions();
  const { previous: old, best: record } = journeyRecord ?? recordCompletedJourney(undefined, journeyScores);
  $('#resultBest').textContent = num(record);
  $('#resultPreviousBest').textContent = old == null ? '—' : num(old);
  $('#recordNote').textContent =
    `Journey best: ${num(record)}${old == null || summary.strokes < old ? ' · New personal best' : ''}`;
  $('#resultRetry').focus();
}
function readBest(id) {
  try {
    const n = Number(localStorage.getItem(levelRecordKey(id)));
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
$('#play').onclick = () => start(true);
$('#continueJourney').onclick = () => {
  const checkpoint = readJourneyProgress();
  if (checkpoint && selectedIsland === 'hormuz') start(true, checkpoint);
};
$('#invitationPlay').onclick = () => {
  const level = invitation?.island === selectedIsland && levelsForIsland(selectedIsland)
    .find(value => (value.number ?? value.id) === invitation.hole);
  if (level) selectLevel(level.id);
};
document.querySelectorAll('.island-tab').forEach(
  (button) =>
    (button.onclick = () => {
      unlockPreferredAudio();
      selectIsland(button.dataset.island);
    }),
);
document
  .querySelectorAll('.level-button')
  .forEach((button) => (button.onclick = () => selectLevel(button.dataset.level)));
$('#prevIsland').onclick = () => cycleIsland(-1);
$('#nextIsland').onclick = () => cycleIsland(1);
$('#pause').onclick = togglePause;
$('#resume').onclick = togglePause;
$('#restart').onclick = reset;
$('#resultNext').onclick = () => {
  if (mode === 'journey' && !nextLevel(selectedLevel)) {
    journeyResults();
    return;
  }
  const next = nextLevel(selectedLevel);
  if (next) {
    selectedLevel = next.id;
    reset();
    canvas.focus();
  }
};
$('#resultRetry').onclick = () => {
  if (journeyFinished) {
    clearJourneyProgress();
    journeyScores = [];
    selectedLevel = levelsForIsland(selectedIsland)[0].id;
  }
  reset();
  canvas.focus();
};
$('#leaveCancel').onclick = cancelLeave;
$('#leaveConfirm').onclick = home;
$('#backHome').onclick = requestHome;
$('#resultHome').onclick = requestHome;

let shareEpoch = 0;
function resetShareFeedback() {
  shareEpoch++;
  $('#shareNotice').textContent = '';
  $('#shareFallback').classList.add('hidden');
  $('#shareText').value = '';
  $('#resultShare').disabled = false;
}
$('#resultShare').onclick = async () => {
  const level = currentLevel();
  const summary = journeyFinished ? journeySummary(journeyScores, selectedIsland) : null;
  const payload = resultShare({
    island: selectedIsland,
    ...(summary ? { journey: true } : { hole: level.number ?? level.id, holeName: level.name }),
    strokes: summary?.strokes ?? state.strokes,
    par: summary?.par ?? level.par,
    baseUrl: location.href,
  });
  if (!state.completed || !payload) return;
  const epoch = shareEpoch;
  const stillCurrent = () => epoch === shareEpoch && playing && state.completed;
  $('#resultShare').disabled = true;
  $('#shareNotice').textContent = '';
  $('#shareFallback').classList.add('hidden');
  try {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(payload);
        if (stillCurrent()) $('#shareNotice').textContent = 'Result shared.';
        return;
      } catch (error) {
        if (!stillCurrent()) return;
        if (error.name === 'AbortError') {
          $('#shareNotice').textContent = 'Sharing cancelled.';
          return;
        }
        // Unsupported/denied native sharing still permits an explicit copy fallback.
      }
    }
    if (!stillCurrent()) return;
    const text = `${payload.text}\n${payload.url}`;
    try {
      await navigator.clipboard.writeText(text);
      if (stillCurrent()) $('#shareNotice').textContent = 'Result and course link copied.';
    } catch {
      if (!stillCurrent()) return;
      $('#shareNotice').textContent = 'Copy unavailable. Select and copy your result below.';
      $('#shareText').value = text;
      $('#shareFallback').classList.remove('hidden');
      $('#shareText').focus();
      $('#shareText').select();
    }
  } finally {
    if (stillCurrent()) $('#resultShare').disabled = false;
  }
};

$('#zoomOut').onclick = () => {
  if (!drag && !paused) targetZoom = clampZoom(targetZoom - 0.15);
};
$('#zoomIn').onclick = () => {
  if (!drag && !paused) targetZoom = clampZoom(targetZoom + 0.15);
};
$('#overview').onclick = () => {
  if (!drag && !paused) {
    if (currentTouchView()) touchOverview = !touchOverview;
    targetZoom = 1;
    orbitAngle = 0.62;
  }
};

function syncAudioControls() {
  const a = coastalAudio.getState(),
    state = a.music && a.effects ? 'on' : a.music || a.effects ? 'mixed' : 'off';
  $('#musicToggle').checked = a.music;
  $('#effectsToggle').checked = a.effects;
  $('#sound').dataset.audio = state;
  $('#sound').innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8q5 4 0 8"/><path class="sound-off" d="M4 20 20 4"/><path class="sound-mixed" d="M17 19h4"/></svg>';
  $('#sound').setAttribute(
    'aria-label',
    `Sound settings: music ${a.music ? 'on' : 'off'}, effects ${a.effects ? 'on' : 'off'}`,
  );
  $('#sound').title = $('#sound').getAttribute('aria-label');
  $('#menuSound').dataset.audio = state;
  $('#menuSound').innerHTML = $('#sound').innerHTML;
  $('#menuSound').setAttribute('aria-label', $('#sound').getAttribute('aria-label'));
  $('#menuSound').title = $('#sound').title;
}
function openAudio() {
  if (['pausePanel', 'resultPanel', 'leavePanel', 'helpPanel'].some(id => !$('#' + id).classList.contains('hidden'))) return;
  audioWasPaused = paused;
  if (playing && !paused && !state.completed) {
    paused = true;
    cancelDrag();
  }
  coastalAudio.setPaused(true);
  syncAudioControls();
  $('#audioPanel').classList.remove('hidden');
  $('#musicToggle').focus();
}
$('#sound').onclick = openAudio;
$('#menuSound').onclick = openAudio;
for (const [id, set] of [
  ['musicToggle', 'setMusic'],
  ['effectsToggle', 'setEffects'],
])
  $('#' + id).onchange = async (e) => {
    coastalAudio[set](e.target.checked);
    const ok = await unlockPreferredAudio();
    audioNoticeKey = ok
      ? ''
      : 'Audio is unavailable in this browser. The game still works without it.';
    renderFailureNotices();
    syncAudioControls();
  };
$('#audioClose').onclick = () => {
  $('#audioPanel').classList.add('hidden');
  paused = audioWasPaused;
  coastalAudio.setPaused(paused);
  if (playing) canvas.focus();
  else $('#menuSound').focus();
};
$('#creditsOpen').onclick = () => {
  $('#credits').classList.remove('hidden');
  $('#creditsClose').focus();
};
$('#creditsClose').onclick = () => $('#credits').classList.add('hidden');
$('#helpFooter').onclick = () => {
  helpWasPaused = paused;
  if (playing && !state.completed) {
    paused = true;
    cancelDrag();
  }
  coastalAudio.setPaused(true);
  $('#helpPanel').classList.remove('hidden');
  $('#helpClose').focus();
};
$('#helpClose').onclick = () => {
  $('#helpPanel').classList.add('hidden');
  paused = helpWasPaused;
  coastalAudio.setPaused(paused);
  if (playing) canvas.focus();
  else $('#helpFooter').focus();
};
canvas.tabIndex = 0;
function resize() {
  if (!renderer) return;
  renderer.setSize(innerWidth, innerHeight, false);
  resizeCamera();
}
addEventListener('resize', () => {
  resize();
});
function updateCamera(dt) {
  if (cameraFrozen) return;
  const next = THREE.MathUtils.lerp(zoom, playing ? targetZoom : 1, 1 - Math.exp(-dt * 10));
  zoom = Math.abs(next - (playing ? targetZoom : 1)) < 0.001 ? (playing ? targetZoom : 1) : next;
  resizeCamera();
  const menuShift = !playing ? (innerWidth > 1000 ? -5.8 : innerWidth > innerHeight ? -13 : 0) : 0;
  const touchView = currentTouchView();
  const target = cameraAimTarget;
  if (touchView) {
    if (touchOverview) target.set(touchView.x, 0, touchView.z);
    else target.copy(ball.getPosition());
  } else if (playing && zoom > 1)
    target.copy(ball.getPosition()).multiplyScalar(Math.min(0.8, ((zoom - 1) / 0.85) * 0.8));
  else target.set(menuShift, 0, -0.2);
  target.y = 0;

  const distance = 37;
  const offset = cameraOffset.set(
    Math.sin(orbitAngle) * distance,
    distance * 0.87,
    Math.cos(orbitAngle) * distance,
  );
  cameraTarget.lerp(target, 1 - Math.exp(-dt * 4));
  cameraPosition.copy(cameraTarget).add(offset);
  camera.position.lerp(cameraPosition, 1 - Math.exp(-dt * 4));
  camera.lookAt(cameraTarget);
  const overviewLabel = touchView ? (touchOverview ? 'Return to ball' : 'Show whole course') : 'Reset camera';
  if ($('#overview').getAttribute('aria-label') !== overviewLabel) {
    $('#overview').setAttribute('aria-label', overviewLabel);
    $('#overview').title = overviewLabel;
    $('#overview').setAttribute('aria-pressed', String(!!touchView && touchOverview));
  }
}
let touchViewKey = '', touchViewCache = null;
function currentTouchView() {
  if (!playing) return null;
  const key = `${innerWidth}:${innerHeight}:${coarsePointer.matches}:${selectedLevel}:${orbitAngle}`;
  if (key !== touchViewKey) {
    touchViewKey = key;
    touchViewCache = touchCourseView({
      width: innerWidth, height: innerHeight, coarsePointer: coarsePointer.matches,
      outline: currentLevel().outline, angle: orbitAngle,
    });
  }
  return touchViewCache;
}
function resizeCamera() {
  updateCameraFraming(camera, {
    width: innerWidth,
    height: innerHeight,
    playing,
    zoom,
    touchView: currentTouchView(),
    overview: touchOverview,
  });
}
function updatePreview() {
  origin.visible = playing && !paused && !state.completed && ball.state === 'aiming';
  const ringPos = ball.getPosition();
  origin.position.set(ringPos.x, 0.025, ringPos.z);
  arrowGroup.visible = playing && !paused && !state.completed && ball.state === 'aiming';
  if (!arrowGroup.visible) return;
  const dir = aimDir(),
    p = drag ? drag.p : power,
    pos = ball.getPosition();
  const length = 1 + shotSpeed(p) * 0.36;
  for (let i = 0; i < dots.length; i++) {
    const distance = ((i + 1) / dots.length) * length;
    dots[i].position.set(pos.x + dir.x * distance, 0.08, pos.z + dir.z * distance);
    dots[i].scale.setScalar(1 - i * 0.025);
  }
  arrowTip.position.set(pos.x + dir.x * (length + 0.12), 0.085, pos.z + dir.z * (length + 0.12));
  arrowTip.quaternion.setFromUnitVectors(arrowUp, arrowDirection.set(dir.x, 0, dir.z));
  targetRing.position.set(pos.x, 0.025, pos.z);
  targetRing.visible = arrowGroup.visible;
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.06);
  lastTime = now;
  if (!ready) return;
  if (playing && !paused && !state.completed) {
    ball.capturePreviousTransform();
    physics.step(dt);
    ball.update(physics.getInterpolationAlpha(), dt);
    const p = ball.rigidBody.translation();
    if (captureCup(p, currentLevel().hole) && state.strokes > 0) complete();
    else if (ball.state === 'out_of_bounds') {
      state.strokes++;
      ball.strokes = state.strokes;
      ball.respawn();
      ball.mesh.scale.setScalar(1);
      updateHud();
      setStatus('Returned to your last shot · +1');
    } else if (ball.state === 'aiming') setStatus('Ready to putt');
    else setStatus('Rolling');
  }
  ball.ghostSphereMesh.visible = false;
  ball.windTrail.group.visible = playing && !paused;
  targetRing.visible = playing && !paused && !state.completed;
  updatePreview();
  updateCamera(dt);
  if (!paused && !document.hidden && !reducedMotion.matches) sceneryClock.value += dt;
  const motionTime = reducedMotion.matches ? 0 : sceneryClock.value;
  if (environment.root.visible) environment.update(motionTime);
  if (!playing) {
    updateIslandMotion(menuDiorama, motionTime, {
      reducedMotion: reducedMotion.matches,
      active: true,
    });
  } else {
    restoreDiorama();
  }
  preview?.update(motionTime);
  positionDistantFleet();
  scene.background.lerp(sceneColorTarget, reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 6));
  scene.fog.color.copy(scene.background);
  ballMarker.visible = playing && !state.completed;
  ballMarker.position.copy(ball.mesh.position);
  ballMarker.position.y = 0.023;
  renderer.render(scene, camera);
}
renderLevelCards();
async function init() {
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    resize();
    scene.add(new THREE.HemisphereLight('#ffe9cc', '#347a80', 1.15));
    const sun = new THREE.DirectionalLight('#fff0d1', 2.4);
    sun.position.set(-15, 25, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -20,
      right: 20,
      top: 20,
      bottom: -20,
      near: 1,
      far: 80,
    });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
    scene.add(sun);
    environment = createEnvironment(menuDiorama);
    await physics.init();
    ball = new BallController(scene, physics.world, physics.rapier);
    ball.radius = 0.145;
    ball.mesh.geometry.dispose();
    ball.mesh.geometry = new THREE.SphereGeometry(ball.radius, 20, 16);
    physics.onBeforeStep = () => ball.capturePreviousTransform();
    ready = true;
    reset();
    menuDiorama.add(ball.mesh, finishFlag);
    setLevelUI();
    renderLevelCards();
    cameraTarget.set(innerWidth > 800 ? -5.2 : 0, 0, -0.2);
    camera.position.set(22, 30, 34);
    syncAudioControls();
    selectIsland(invitation?.island ?? 'hormuz');
    requestAnimationFrame(animate);
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa'))
      window.__golf = {
        state: () => ({
          strokes: state.strokes,
          completed: state.completed,
          ball: { ...ball.rigidBody.translation() },
          phase: ball.state,
          paused,
          power,
          zoom,
          targetZoom,
          cameraFrozen,
          cameraMode: currentTouchView() ? (touchOverview ? 'overview' : 'follow') : 'desktop',
          preview: previewId,
          level: selectedLevel,
          mode,
          sceneryTime: sceneryClock.value,
          menuMotion: { y: menuDiorama.position.y, yaw: menuDiorama.rotation.y },
          journey: [...journeyScores],
          audio: coastalAudio.getState(),
          angle: aimAngle,
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
        }),
        project: (x, z) => {
          const v = new THREE.Vector3(x, 0.11, z).project(camera);
          return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
        },
        goal: () => ({ ...currentLevel().hole }),
        courseBounds: () => {
          const level = currentLevel();
          const points = level.outline.map(([x, z]) => {
            const v = new THREE.Vector3(x, 0.11, z).project(camera);
            return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
          });
          const xs = points.map((point) => point.x),
            ys = points.map((point) => point.y),
            left = Math.min(...xs),
            right = Math.max(...xs),
            top = Math.min(...ys),
            bottom = Math.max(...ys);
          return {
            left,
            right,
            top,
            bottom,
            width: right - left,
            height: bottom - top,
            center: { x: (left + right) / 2, y: (top + bottom) / 2 },
          };
        },
        islandCorners,
        fleet: fleetBounds,
      };
  } catch (error) {
    console.error(error);
    loadErrorKey =
      'The island could not load. This game needs a WebGL-capable browser. Try Chrome or reload the page.';
    renderFailureNotices();
  }
}
addEventListener('pagehide', () => coastalAudio.dispose());
init();
