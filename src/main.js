import * as THREE from 'three';
import { createEnvironment } from './environment.js';
import { createHormuzCourse, COURSE } from './course.js';
import { initialHormuzState, clampPower, scoreLabel } from './game.js';
import { shotSpeed, captureCup, saveBest } from './shot.js';
import { PhysicsWorld } from './vendor/physics/PhysicsWorld';
import { BallController } from './vendor/player/BallController';
import { ISLANDS, LEVELS, playableLevel, levelRecordKey, journeySummary, clampZoom } from './journey.js';
import { createCoastalAudio } from './audio.js';
import { updateIslandMotion } from './sceneMotion.js';
import { createDistantFleet } from './distantFleet.js';
import { createIslandAtmosphere, islandSceneProfile } from './islandAtmosphere.js';
import { version as GAME_VERSION } from '../package.json';
import './styles.css';
import './mobile.css';
import './collection.css';
import './refresh.css';
import './release.css';


const $ = selector => document.querySelector(selector);
function courseSketch(level){
 const points=level.outline.map(([x,z])=>`${x},${z}`).join(' ');
 return `<svg class="course-sketch" viewBox="-10 -8 20 18" aria-hidden="true"><ellipse cx="0" cy="1" rx="9.5" ry="7.5" fill="#d4d7b4"/><polygon points="${points}" fill="#839d73" stroke="#fff5db" stroke-width=".7" stroke-linejoin="round"/><circle cx="${level.start.x}" cy="${level.start.z}" r=".45" fill="#fff9ed"/><circle cx="${level.hole.x}" cy="${level.hole.z}" r=".45" fill="#234c48"/><path d="M${level.hole.x},${level.hole.z}v-2.1l1.6,.6-1.6,.5" fill="#df6852" stroke="#df6852" stroke-width=".22"/></svg>`;
}
$('#app').innerHTML = `
  <canvas id="scene" aria-label="Three dimensional miniature golf course inspired by Hormuz Island"></canvas>
  <section id="menu" class="menu">
    <div class="brand" aria-label="Persian Isles Mini Golf"><img class="brand-icon" src="/icon.svg" alt="" width="44" height="44"><div class="brand-copy"><span class="brand-name">Persian Isles Mini Golf</span><small class="brand-slogan">Find your line through the islands.</small></div></div>
    <div class="hero-copy"><h1>Choose your island</h1>
    <p class="lede" id="islandDescription">Find your line through a little world of red earth, salt-white cliffs and turquoise water.</p>
    <div class="island-nav"><button id="prevIsland" aria-label="Previous island">←</button><strong id="selectedIslandName">Hormuz</strong><button id="nextIsland" aria-label="Next island">→</button></div><div class="island-switcher" aria-label="Choose an island">${ISLANDS.map(island=>`<button class="island-tab ${island.id==='hormuz'?'selected':''}" data-island="${island.id}"><span>${island.name}</span>${island.playable?'':'<b class="preview-dot" aria-hidden="true">○</b>'}</button>`).join('')}</div>
    <div class="island-availability hidden" id="islandAvailability" role="status"></div>
    <button id="play" class="primary" disabled>Preparing the island…</button>
    <div id="journeyNote" class="journey-note"><b data-ui="Practice a hole">Practice a hole</b><span data-ui="More holes are in development.">More holes are in development.</span></div>
    <div id="levelGrid" class="level-grid" aria-label="Hormuz holes">${LEVELS.map(level=>`<button class="level-button" data-level="${level.id}" ${level.available?'':'disabled'}><span>${String(level.id).padStart(2,'0')}</span><small>${level.available?level.name:'—'}</small>${level.available?`${courseSketch(level)}<i class="level-complete"></i>`:'<i class="future-marker" aria-hidden="true">Soon</i>'}</button>`).join('')}</div>
    <div class="edition hidden" id="edition">HORMUZ <span>•</span> RAINBOW RUN <span>•</span> PAR 4</div></div>
    <aside class="postcard"><span class="eyebrow" id="postcardEyebrow">THE RAINBOW ISLAND</span><b id="postcardName">Hormuz Island</b><small id="postcardText">A miniature inspired by Iran’s rainbow island.<br>Playful geography, not a map.</small></aside>
    <footer class="menu-footer"><span>FIVE ISLANDS. ONE COAST.</span><div><button id="sceneryToggle" class="text-btn" aria-pressed="false">View island</button><button id="menuSound" class="text-btn">Sound off</button><button id="creditsOpen" class="text-btn">About & credits ↗</button></div></footer>
  </section>
  <section id="game" class="hidden"><div id="cupCelebration" aria-hidden="true">Nice line.</div>
    <header class="topbar"><div class="game-title"><span class="eyebrow">PERSIAN ISLES MINI GOLF</span><strong>Hormuz <i id="levelTitle">01 / RED SHORE</i></strong></div>
    <div class="top-actions"><button id="sound" class="circle-btn" aria-label="Sound settings" title="Sound settings">♪</button><button id="helpOpen" class="circle-btn" aria-label="Help" title="Help">?</button><button id="pause" class="circle-btn" aria-label="Pause game" title="Pause game">Ⅱ</button></div><button id="gameMenuToggle" class="circle-btn" aria-label="Game tools" aria-controls="gameTools" aria-expanded="false">☰</button><div id="gameTools" class="game-tools" hidden></div></header>
    <div class="hud"><div class="hole-stat"><small>HOLE</small><strong id="holeNumber">01</strong><span id="levelName">Red Shore</span></div><div><small>STROKES</small><strong id="strokes">0</strong></div></div>
    <button id="manualToggle" class="manual-toggle" aria-expanded="false" aria-controls="manualControls">Manual controls</button><div id="manualControls" class="manual-controls" hidden><div class="shot-controls"><button id="manualClose" class="manual-close" aria-label="Close manual controls" title="Close manual controls">×</button><div class="shot-status"><span class="ready-dot"></span><b id="status" aria-live="polite">Loading</b><button id="restartQuick" class="text-btn" aria-label="Restart">Restart</button></div>
    <div class="power-heading"><span>POWER</span><b id="powerValue">45%</b></div><input id="power" aria-label="Shot power" type="range" min="8" max="100" value="45">
    <div class="direction-controls"><button id="aimLeft" aria-label="Aim left">↶</button><button id="putt" class="putt-btn">Putt <kbd>SPACE</kbd></button><button id="aimRight" aria-label="Aim right">↷</button></div></div></div>
    <div class="zoom-controls" role="group" aria-label="Camera controls"><button id="zoomOut" aria-label="Zoom out" title="Zoom out">−</button><button id="zoomIn" aria-label="Zoom in" title="Zoom in">+</button><button id="overview" aria-label="Reset camera" title="Reset camera">⤢</button></div>
    <div id="hint" class="hint"><span class="gesture-demo" aria-hidden="true">○ ┄ ↙</span><b data-ui="Drag back, release to putt.">Drag back, release to putt.</b><span data-ui="Scroll or pinch to zoom.">Scroll or pinch to zoom.</span></div>
  </section>
  <section id="pausePanel" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="pauseTitle"><div class="panel"><p class="eyebrow">ON ISLAND TIME</p><h2 id="pauseTitle">Take a breath.</h2><p>The coast can wait. Your next line is right where you left it.</p><button id="resume" class="primary">Resume</button><button id="restart" class="secondary">Restart</button><button id="backHome" class="text-btn">Back to the coast</button></div></section>
  <section id="resultPanel" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="resultTitle"><div class="panel result"><p class="eyebrow" id="resultEyebrow">HORMUZ / HOLE COMPLETE</p><h2 id="resultTitle">A line to remember.</h2><div class="score-number"><b id="resultStrokes">0</b><div><span id="resultScore">PAR</span><small id="resultSubscore">strokes · par 2</small></div></div><div class="result-metrics"><span>Par <b id="resultPar">2</b></span><span>Best <b id="resultBest">—</b></span><span>Previous <b id="resultPreviousBest">—</b></span></div><p id="recordNote"></p><div id="journeyResults" class="journey-results hidden"></div><button id="resultRetry" class="primary">Find a better line ↗</button><button id="resultNext" class="secondary">Next open hole</button><button id="resultHome" class="text-btn">Back to the coast</button></div></section>
  <section id="credits" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="creditTitle"><div class="panel credits"><p class="eyebrow">ABOUT THE GAME</p><h2 id="creditTitle">A coast of our own.</h2><p class="about-intro">Persian Isles Mini Golf is a little escape to the Iranian islands. Find your line across red earth, pale cliffs and turquoise water, with thoughtful shots and a coast worth exploring.</p><p class="game-version">Version ${GAME_VERSION}</p><h3>Credits</h3><p>Created by <a href="https://github.com/itline" target="_blank" rel="noopener">itline</a>.</p><p>Procedural landscapes, course, interface and synthesized audio created for this project. No models or art were taken from the benchmark game.</p><p>Ball & fixed-step physics adapted from <a href="https://github.com/LCmaster/minigolf" target="_blank" rel="noopener">Mini Golf Mania</a> by Luiz Vicente (MIT). Three.js (MIT), Rapier (Apache-2.0). Required notices ship with the build.</p><p>Nature reference: <a href="https://science.nasa.gov/earth/earth-observatory/irans-rainbow-island-147428" target="_blank" rel="noopener">NASA Earth Observatory, Iran’s Rainbow Island</a>.</p><button id="creditsClose" class="primary">Back</button></div></section>
  <section id="audioPanel" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="audioTitle"><div class="panel"><p class="eyebrow">COASTAL SOUNDS</p><h2 id="audioTitle">A quieter rhythm.</h2><p>Original, softly synthesized island music. Music and game sounds are optional and saved separately on this device.</p><label class="audio-option"><span>Island music</span><input id="musicToggle" type="checkbox"></label><label class="audio-option"><span>Shot &amp; completion sounds</span><input id="effectsToggle" type="checkbox"></label><p id="audioNotice" aria-live="polite"></p><button id="audioClose" class="primary">Back</button></div></section>
  <div id="sceneFade" aria-hidden="true"></div>
  <section id="helpPanel" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="helpTitle"><div class="panel"><h2 id="helpTitle" data-ui="How to play">How to play</h2><ol class="help-steps"><li data-ui="Drag back, release to putt.">Drag back, release to putt.</li><li data-ui="Longer drag, more power.">Longer drag, more power.</li><li data-ui="Scroll or pinch to zoom.">Scroll or pinch to zoom.</li><li data-ui="Arrows aim and set power. Space puts.">Arrows aim and set power. Space puts.</li></ol><button id="helpClose" class="primary" data-ui="Back">Back</button></div></section>
  <div id="loadError" class="load-error hidden" role="alert"></div>`;

const num=value=>new Intl.NumberFormat('en',{maximumFractionDigits:0}).format(value);
document.documentElement.lang='en';document.documentElement.dir='ltr';document.title='Persian Isles Mini Golf';
let audioNoticeKey='';
let loadErrorKey='';
function renderFailureNotices(){
 $('#audioNotice').textContent=audioNoticeKey;
 if(loadErrorKey){$('#play').textContent='Unable to load';$('#loadError').textContent=loadErrorKey;$('#loadError').classList.remove('hidden');}
}
let renderer, environment, physicalCourse, ball;
const sceneryClock={value:0};
const scene = new THREE.Scene(); scene.background = new THREE.Color('#b3dce0'); scene.fog = new THREE.Fog('#b3dce0',58,125);
// Visual-only parent: rigid bodies/colliders stay in their original world frame.
const menuDiorama=new THREE.Group();scene.add(menuDiorama);
const distantFleet=createDistantFleet(scene);
const islandAtmosphere=createIslandAtmosphere(scene);
const fleetRay=new THREE.Raycaster(),fleetSea=new THREE.Plane(new THREE.Vector3(0,1,0),3.65);
const atmosphereRay=new THREE.Raycaster(),atmosphereSea=new THREE.Plane(new THREE.Vector3(0,1,0),3.64);
const camera = new THREE.OrthographicCamera(-18,18,13,-13,.1,200);
function restoreDiorama(){updateIslandMotion(menuDiorama,0,{active:false});}
function islandCorners(){return [-11,11].flatMap(x=>[-3.8,5.5].flatMap(y=>[-9,9].map(z=>{const v=menuDiorama.localToWorld(new THREE.Vector3(x,y,z)).project(camera);return{x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight};})));
}
function positionDistantFleet(){
 distantFleet.root.visible=!playing;
 islandAtmosphere.root.visible=!playing;
 if(playing)return;
 camera.updateMatrixWorld();
 const portrait=innerWidth<innerHeight;
 const profile=islandSceneProfile(previewId||'hormuz',portrait);
 const unit=(camera.right-camera.left)/innerWidth;
 distantFleet.boats.forEach((boat,i)=>{
  boat.visible=i<profile.anchors.length;
  if(!boat.visible)return;
  const [x,y]=profile.anchors[i];fleetRay.setFromCamera(new THREE.Vector2(x*2-1,1-Math.max(y,100/innerHeight)*2),camera);
  const point=fleetRay.ray.intersectPlane(fleetSea,new THREE.Vector3());
  if(!point){boat.visible=false;return;}
  boat.position.copy(point);boat.scale.setScalar(unit*profile.widths[i]/2);boat.rotation.y=profile.yaws[i];
 });
 islandAtmosphere.root.visible=!playing;
 islandAtmosphere.setIsland(previewId||'hormuz');
 for(const detail of islandAtmosphere.details){
  if(!detail.visible) continue;
  const mode=portrait?'portrait':'landscape';const [x,y]=detail.userData.anchors[mode];atmosphereRay.setFromCamera(new THREE.Vector2(x*2-1,1-Math.max(y,100/innerHeight)*2),camera);const point=atmosphereRay.ray.intersectPlane(atmosphereSea,new THREE.Vector3());
  if(!point){detail.visible=false;continue;}
  detail.position.copy(point);detail.scale.setScalar(unit*detail.userData.widthPx[mode]/2);
 }
 distantFleet.update(reducedMotion.matches?0:sceneryClock.value);
}
function fleetBounds(){
 const boats=distantFleet.boats.filter(b=>b.visible).map(boat=>{
  const box=new THREE.Box3().setFromObject(boat),points=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
   const p=new THREE.Vector3(x,y,z).project(camera);points.push({x:(p.x+1)/2*innerWidth,y:(1-p.y)/2*innerHeight});
  }
  const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
  return{x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};
 });
 const details=islandAtmosphere.details.filter(d=>d.visible).map(detail=>{const box=new THREE.Box3().setFromObject(detail),points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);points.push({x:(p.x+1)/2*innerWidth,y:(1-p.y)/2*innerHeight});}const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return{x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};});
 return{visible:distantFleet.root.visible,boats,details};
}
const physics = new PhysicsWorld();
let state={...initialHormuzState}, playing=false, paused=false, ready=false, destroyed=false;
let drag=null, orbit=null, aimAngle=0, power=.45, currentPower=.45, zoom=1, orbitAngle=.62;
let selectedIsland='hormuz', selectedLevel=1, preview, previewId='hormuz', previewVersion=0;
let mode='single', journeyScores=[], journeyFinished=false, audioWasPaused=false, helpWasPaused=false;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let sceneColorTarget=new THREE.Color('#b3dce0'), transitionTimer=null;
let tutorialSeen=false;try{tutorialSeen=localStorage.getItem('golf:tutorial-seen')==='yes';}catch{}
let targetZoom=1, cameraFrozen=false, sceneryOnly=false;const pointers=new Map();let pinch=null, menuSwipe=null;
const presets={hormuz:'#b3dce0',qeshm:'#bfd4d1',kish:'#bbe3e5',khark:'#b6d4d4',hengam:'#a8dbe1'};
const coastalAudio=createCoastalAudio();
let lastTime=performance.now(), elapsed=0, best=null, lastView={width:0,height:0};
let cameraTarget=new THREE.Vector3(), cameraPosition=new THREE.Vector3(), completionTimer=null;
// The original slice record belongs only to the unchanged Rainbow Run (hole 3).
try{const old=Number(localStorage.getItem('persian-isles-golf:hormuz:course-v1'));if(Number.isInteger(old)&&old>0&&!localStorage.getItem(levelRecordKey(3)))localStorage.setItem(levelRecordKey(3),String(old));}catch{}
const canvas=$('#scene');
const compactTools=matchMedia('(max-width: 900px), (pointer: coarse) and (orientation: landscape)');
const topActions=$('.top-actions'),zoomControls=$('.zoom-controls');
function toolsOpen(){return $('#gameMenuToggle').getAttribute('aria-expanded')==='true';}
function closeTools(focus=false){$('#gameMenuToggle').setAttribute('aria-expanded','false');$('#gameTools').hidden=true;if(focus)$('#gameMenuToggle').focus();}
function layoutTools(){closeTools();if(compactTools.matches){$('#gameTools').append(topActions,zoomControls);}else{$('.topbar').insertBefore(topActions,$('#gameMenuToggle'));$('#game').append(zoomControls);}}
layoutTools();compactTools.addEventListener('change',layoutTools);
$('#gameMenuToggle').onclick=()=>{const open=!toolsOpen();cancelDrag();pointers.clear();pinch=null;if(open){$('#manualToggle').setAttribute('aria-expanded','false');$('#manualControls').hidden=true;}$('#gameMenuToggle').setAttribute('aria-expanded',String(open));$('#gameTools').hidden=!open;};
$('#manualToggle').onclick=()=>{$('#manualToggle').setAttribute('aria-expanded','true');$('#manualControls').hidden=false;$('#manualClose').focus();};
$('#manualClose').onclick=()=>{$('#manualToggle').setAttribute('aria-expanded','false');$('#manualControls').hidden=true;$('#manualToggle').focus();};
document.addEventListener('pointerdown',e=>{if(toolsOpen()&&!$('#gameTools').contains(e.target)&&!$('#gameMenuToggle').contains(e.target)){closeTools();cancelDrag();e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
document.addEventListener('focusin',e=>{if(toolsOpen()&&!$('#gameTools').contains(e.target)&&!$('#gameMenuToggle').contains(e.target))closeTools();});
const ballMarker=new THREE.Mesh(new THREE.RingGeometry(.19,.235,32),new THREE.MeshBasicMaterial({color:'#143e48',side:THREE.DoubleSide,transparent:true,opacity:.65,depthWrite:false}));ballMarker.rotation.x=-Math.PI/2;scene.add(ballMarker);
const arrowGroup=new THREE.Group();scene.add(arrowGroup);
const arrowMaterial=new THREE.MeshBasicMaterial({color:'#0e6a72',transparent:true,opacity:.8,depthTest:false});
const dots=[];for(let i=0;i<17;i++){const dot=new THREE.Mesh(new THREE.SphereGeometry(.043,8,6),arrowMaterial);dot.renderOrder=7;arrowGroup.add(dot);dots.push(dot);}
const arrowTip=new THREE.Mesh(new THREE.ConeGeometry(.14,.36,3),arrowMaterial);arrowTip.rotation.x=-Math.PI/2;arrowGroup.add(arrowTip);arrowGroup.visible=false;
const targetRing=new THREE.Mesh(new THREE.RingGeometry(.19,.23,40),new THREE.MeshBasicMaterial({color:'#f8e6ac',side:THREE.DoubleSide,depthWrite:false}));targetRing.rotation.x=-Math.PI/2;targetRing.position.set(COURSE.start.x,.02,COURSE.start.z);scene.add(targetRing);
const origin=new THREE.Mesh(new THREE.CircleGeometry(.36,32),new THREE.MeshBasicMaterial({color:'#e85d43',transparent:true,opacity:.34,depthWrite:false}));origin.rotation.x=-Math.PI/2;origin.position.set(COURSE.start.x,.025,COURSE.start.z);scene.add(origin);
const finishFlag=new THREE.Group();
const flagPole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,1.65,8),new THREE.MeshStandardMaterial({color:'#f7ead0',roughness:.65}));flagPole.position.y=.82;flagPole.castShadow=true;
const flagShape=new THREE.Shape();flagShape.moveTo(0,1.55);flagShape.lineTo(.75,1.35);flagShape.lineTo(0,1.12);flagShape.closePath();
const flagMesh=new THREE.Mesh(new THREE.ShapeGeometry(flagShape),new THREE.MeshStandardMaterial({color:'#e85d43',side:THREE.DoubleSide,roughness:.7}));flagMesh.position.x=.02;flagMesh.castShadow=true;
finishFlag.add(flagPole,flagMesh);finishFlag.position.set(COURSE.hole.x,.04,COURSE.hole.z);scene.add(finishFlag);

function renderLevelCards(){
 document.querySelectorAll('.level-button').forEach(button=>{
  const level=LEVELS.find(l=>l.id===Number(button.dataset.level));const record=readBest(level.id);
  button.querySelector('span').textContent=num(level.id);
  button.querySelector('small').textContent=level.name;
  button.title=level.name;
  button.setAttribute('aria-label',`Hole ${num(level.id)} · ${level.name}`);
  if(level.available){button.querySelector('.level-complete').textContent=record==null?'':'✓';button.querySelector('.level-complete').title=record==null?'Not played yet':'Completed';}
 });
}
function styleResultActions(){const nextPrimary=mode==='journey'&&!journeyFinished;$('#resultNext').classList.toggle('primary',nextPrimary);$('#resultNext').classList.toggle('secondary',!nextPrimary);$('#resultRetry').classList.toggle('primary',!nextPrimary);$('#resultRetry').classList.toggle('secondary',nextPrimary);}
function currentLevel(){return playableLevel(selectedLevel)||playableLevel(1);}
function setLevelUI(){
 const level=currentLevel();$('#levelTitle').textContent=`${num(level.id)} / ${level.name}`;
 $('#holeNumber').textContent=num(level.id);$('#levelName').textContent=level.name;
 $('#resultSubscore').textContent=`strokes · par ${num(level.par)}`;
 $('#edition').textContent='';
}
let statusKey='Ready to putt';
function setStatus(text){statusKey=text;$('.shot-controls').dataset.phase=text==='Holed!'?'holed':text==='Rolling'?'rolling':'ready';$('#status').textContent=text;$('#putt').disabled=!ready||state.completed||paused||ball?.state!=='aiming';}
function updateHud(){$('#strokes').textContent=num(state.strokes);$('#powerValue').textContent=`${num(Math.round(currentPower*100))}%`;$('#power').value=Math.round(power*100);}
function updateBest(){try{const stored=Number(localStorage.getItem(levelRecordKey(selectedLevel)));best=Number.isInteger(stored)&&stored>0?stored:null;}catch{best=null;}}
function sound(frequency=440,duration=.06){coastalAudio.effect(frequency,duration);}
function unlockPreferredAudio(){const {music,effects}=coastalAudio.getState();return music||effects?coastalAudio.unlock():Promise.resolve(true);}
function reset(){if(!ready)return;$('#resultEyebrow').textContent='HORMUZ / HOLE COMPLETE';$('#game').classList.remove('celebrating');const level=currentLevel();physicalCourse?.dispose();physicalCourse=createHormuzCourse(menuDiorama,physics,level);origin.visible=true;clearTimeout(completionTimer);journeyFinished=false;cameraFrozen=false;pointers.clear();pinch=null;$('#journeyResults').classList.add('hidden');$('#resultNext').classList.remove('hidden');$('#resultRetry').textContent='Find a better line ↗';$('#resultTitle').textContent='A line to remember.';$('#resultNext').textContent=mode==='journey'&&selectedLevel===3?'See journey results':'Next open hole';styleResultActions();$('#resultNext').disabled=mode!=='journey'&&selectedLevel===3;drag=null;orbit=null;state={...initialHormuzState,island:'Hormuz',par:level.par};paused=false;coastalAudio.setPaused(false);aimAngle=0;power=.45;currentPower=power;zoom=1;targetZoom=1;ball.createPhysicsBody(new THREE.Vector3(level.start.x,.16,level.start.z));ball.setBallColor('#fff9ed');ball.mesh.scale.setScalar(1);ball.ghostSphereMesh.visible=false;finishFlag.position.set(level.hole.x,.04,level.hole.z);targetRing.position.set(level.start.x,.025,level.start.z);origin.position.set(level.start.x,.025,level.start.z);$('#pausePanel').classList.add('hidden');$('#resultPanel').classList.add('hidden');$('#hint').classList.toggle('hidden',tutorialSeen);updateBest();setLevelUI();updateHud();setStatus('Ready to putt');resize();}
async function start(journey=false){if(!ready||selectedIsland!=='hormuz'||previewId!=='hormuz')return;restoreDiorama();closeTools();$('#manualToggle').setAttribute('aria-expanded','false');$('#manualControls').hidden=true;mode=journey?'journey':'single';journeyScores=[];if(journey)selectedLevel=1;playing=true;$('#menu').classList.add('hidden');$('#game').classList.remove('hidden');reset();menuDiorama.add(physicalCourse.group);resize();canvas.focus();await unlockPreferredAudio();sound(660);}
function home(){clearTimeout(completionTimer);playing=false;paused=false;drag=null;coastalAudio.setPaused(false);$('#pausePanel').classList.add('hidden');$('#resultPanel').classList.add('hidden');$('#game').classList.add('hidden');$('#menu').classList.remove('hidden');arrowGroup.visible=false;targetZoom=1;cameraFrozen=false;pointers.clear();pinch=null;mode='single';selectIsland('hormuz');$('#play').focus();}
function togglePause(){if(!playing||!ready||state.completed)return;paused=!paused;drag=null;orbit=null;coastalAudio.setPaused(paused);$('#pausePanel').classList.toggle('hidden',!paused);if(paused)$('#resume').focus();else canvas.focus();}
function aimDir(){return {x:Math.sin(aimAngle),z:-Math.cos(aimAngle)};}
function putt(p=power,dir=aimDir()){if(!ready||!playing||paused||state.completed||ball.state!=='aiming'||p<.025)return;const force=ball.rigidBody.mass()*shotSpeed(p);ball.shoot(new THREE.Vector3(dir.x*force,0,dir.z*force));state.strokes=ball.strokes;currentPower=power;updateHud();setStatus('Rolling');sound(300,.09);$('#hint').classList.add('hidden');tutorialSeen=true;try{localStorage.setItem('golf:tutorial-seen','yes');}catch{}}
function complete(){if(state.completed)return;$('#game').classList.add('celebrating');const level=currentLevel();state.completed=true;drag=null;ball.sinkAt(new THREE.Vector3(level.hole.x,-.37,level.hole.z));arrowGroup.visible=false;if(mode==='journey')journeyScores[selectedLevel-1]=state.strokes;const old=best;best=saveBest(best,state.strokes);try{localStorage.setItem(levelRecordKey(selectedLevel),String(best));}catch{}updateHud();setStatus('Holed!');sound(880,.2);$('#resultStrokes').textContent=num(state.strokes);$('#resultScore').textContent=scoreLabel(state.strokes,level.par);$('#resultPar').textContent=num(level.par);$('#resultBest').textContent=num(best);$('#resultPreviousBest').textContent=old==null?'—':num(old);$('#recordNote').textContent=old==null||state.strokes<old?'New personal best on this coast.':`Best ${num(best)}`;completionTimer=setTimeout(()=>{$('#resultPanel').classList.remove('hidden');$('#resultRetry').focus();},650);}
const raycaster=new THREE.Raycaster(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.11);
function groundPoint(x,y){const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),camera);return raycaster.ray.intersectPlane(groundPlane,new THREE.Vector3());}
function cancelDrag(){drag=null;orbit=null;cameraFrozen=false;currentPower=power;updateHud();}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
// Shared touch navigation covers the scene and non-interactive folio areas.
// pan-y keeps native vertical folio scrolling; multi-touch cancels navigation.
const menuTouches=new Set();let suppressMenuClickUntil=0;
document.addEventListener('pointerdown',e=>{
 if(e.pointerType!=='touch'||playing||!ready)return;
 menuTouches.add(e.pointerId);
 const allowed=(e.target===canvas||$('#menu').contains(e.target))&&!e.target.closest('button,a,input,select');
 menuSwipe=allowed&&menuTouches.size===1?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;
},{capture:true});
document.addEventListener('pointerup',e=>{
 menuTouches.delete(e.pointerId);
 if(!menuSwipe||menuSwipe.id!==e.pointerId)return;
 const {x,y}=menuSwipe;menuSwipe=null;const dx=e.clientX-x,dy=e.clientY-y;
 if(!playing&&Math.abs(dx)>55&&Math.abs(dy)<70&&Math.abs(dx)>Math.abs(dy)*1.5){suppressMenuClickUntil=performance.now()+350;cycleIsland(dx<0?1:-1);}
},{capture:true});
document.addEventListener('pointercancel',e=>{menuTouches.delete(e.pointerId);menuSwipe=null;},{capture:true});
document.addEventListener('click',e=>{if(performance.now()<suppressMenuClickUntil&&(e.target===canvas||$('#menu').contains(e.target))){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
canvas.addEventListener('pointerdown',e=>{
 if(!ready)return;
 if(!playing)return;
 if(paused||state.completed||!$('#audioPanel').classList.contains('hidden'))return;
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
 if(pointers.size>=2){cancelDrag();const a=[...pointers.values()];pinch={distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),zoom:targetZoom};return;}
 if(e.button===2){orbit={x:e.clientX};return;}
 if(e.button!==0||ball.state!=='aiming')return;
 const point=groundPoint(e.clientX,e.clientY);if(!point)return;
 cameraFrozen=true;drag={start:point,x:e.clientX,y:e.clientY,dir:aimDir(),p:0};
});
canvas.addEventListener('pointermove',e=>{
 if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pinch){const a=[...pointers.values()];if(a.length>=2)targetZoom=clampZoom(pinch.zoom*Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/Math.max(1,pinch.distance));return;}
 if(orbit){orbitAngle=THREE.MathUtils.clamp(orbitAngle-(e.clientX-orbit.x)*.004,.1,1.3);orbit.x=e.clientX;return;}
 if(!drag)return;const p=groundPoint(e.clientX,e.clientY);if(!p)return;
 const d=drag.start.clone().sub(p);d.y=0;const dist=d.length();drag.p=clampPower(dist/3.6);currentPower=drag.p;
 if(dist>.025){d.normalize();drag.dir={x:d.x,z:d.z};aimAngle=Math.atan2(d.x,-d.z);}updateHud();
});
canvas.addEventListener('pointerup',e=>{
 pointers.delete(e.pointerId);
 if(!playing)return;
 if(pinch){if(pointers.size===0){pinch=null;cameraFrozen=false;}return;}
 if(orbit){orbit=null;return;}if(!drag)return;
 const {p,dir}=drag;drag=null;cameraFrozen=false;putt(p,dir);
});
canvas.addEventListener('pointercancel',()=>{pointers.clear();pinch=null;cancelDrag();});
addEventListener('blur',()=>{cancelDrag();if(playing&&!paused&&!state.completed)togglePause();});
canvas.addEventListener('wheel',e=>{if(!playing||paused||drag)return;e.preventDefault();targetZoom=clampZoom(targetZoom+(e.deltaY<0?.1:-.1));},{passive:false});
function changeAim(n){if(!paused&&ball?.state==='aiming')aimAngle+=n;}
addEventListener('keydown',e=>{if(e.code==='Escape'&&toolsOpen()){e.preventDefault();closeTools(true);return;}if(!$('#audioPanel').classList.contains('hidden')){if(e.code==='Escape')$('#audioClose').click();return;}if(!$('#helpPanel').classList.contains('hidden')){if(e.code==='Escape')$('#helpClose').click();return;}if(!playing||['BUTTON','INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&e.code!=='Escape')return;if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(e.code==='Escape'){if(drag)cancelDrag();else togglePause();return;}if(paused)return;if(e.code==='Space')putt();if(e.code==='ArrowLeft')changeAim(-.055);if(e.code==='ArrowRight')changeAim(.055);if(e.code==='ArrowUp')power=clampPower(power+.025);if(e.code==='ArrowDown')power=Math.max(.08,power-.025);currentPower=power;updateHud();});
async function selectIsland(id){
 const island=ISLANDS.find(value=>value.id===id);if(!island||playing||!ready)return;
 selectedIsland=id;const version=++previewVersion;delete $('#menu').dataset.previewReady;previewId=null;clearTimeout(transitionTimer);$('#sceneFade').classList.toggle('fading',!reducedMotion.matches);transitionTimer=setTimeout(()=>$('#sceneFade').classList.remove('fading'),reducedMotion.matches?0:260);
 document.querySelectorAll('.island-tab').forEach(tab=>{const selected=tab.dataset.island===id;tab.classList.toggle('selected',selected);tab.setAttribute('aria-pressed',String(selected));});
 $('#selectedIslandName').textContent=island.name;$('#islandDescription').textContent=island.description;
 $('#postcardEyebrow').textContent=island.subtitle;$('#postcardName').textContent=island.name;
 $('#postcardText').textContent=island.playable?'Three holes open now. A playful interpretation, not a map.':'A visual preview. Golf on this island is still in development.';
 $('#islandAvailability').textContent='';$('#islandAvailability').classList.add('hidden');
 $('#play').disabled=true;$('#play').innerHTML=island.playable?'Play Hormuz journey <svg class="play-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3.5 16 10 6 16.5z" fill="currentColor"/></svg>':'Preview only';
 renderLevelCards();$('#levelGrid').classList.toggle('hidden',!island.playable);$('#journeyNote').classList.toggle('hidden',!island.playable);$('#edition').classList.add('hidden');
 preview?.dispose();preview=undefined;
 environment.root.visible=id==='hormuz';physicalCourse.group.visible=id==='hormuz';ball.setVisible(id==='hormuz');finishFlag.visible=id==='hormuz';
 origin.visible=false;targetRing.visible=false;arrowGroup.visible=false;
 sceneColorTarget.set(presets[id]);coastalAudio.setIsland(id);
 if(id!=='hormuz'){
  try{const {createIslandPreview}=await import('./islandPreviews.js');if(version!==previewVersion)return;preview=createIslandPreview(menuDiorama,id);}catch(error){if(version!==previewVersion)return;$('#islandAvailability').textContent='Preview could not load · Try another island';$('#islandAvailability').classList.remove('hidden');console.error(error);return;}
 }
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 if(version!==previewVersion||playing)return;renderer.render(scene,camera);previewId=id;$('#menu').dataset.previewReady=id;$('#play').disabled=!island.playable||!ready;
}
function cycleIsland(delta){unlockPreferredAudio();const i=ISLANDS.findIndex(island=>island.id===selectedIsland);selectIsland(ISLANDS[(i+delta+ISLANDS.length)%ISLANDS.length].id);}
function selectLevel(id){const level=playableLevel(Number(id));if(!level||selectedIsland!=='hormuz'||!ready)return;selectedLevel=level.id;start(false);}
function journeyResults(){
 const summary=journeySummary(journeyScores);if(!summary)return;
 journeyFinished=true;$('#resultTitle').textContent='Your Hormuz postcard.';$('#resultStrokes').textContent=num(summary.strokes);
 $('#resultScore').textContent=scoreLabel(summary.strokes,summary.par);$('#resultSubscore').textContent=`total strokes · par ${num(summary.par)}`;
 $('#recordNote').textContent='Three shores, one journey. Replay to find a better line.';
 $('#resultEyebrow').textContent='HORMUZ / JOURNEY COMPLETE';$('#journeyResults').innerHTML=`<table><thead><tr><th>Hole</th><th>Strokes</th><th>Par</th><th>Best</th></tr></thead><tbody>${summary.scores.map((score,i)=>`<tr><td>${playableLevel(i+1).name}</td><td>${num(score)}</td><td>${num(playableLevel(i+1).par)}</td><td>${readBest(i+1)==null?'—':num(readBest(i+1))}</td></tr>`).join('')}</tbody><tfoot><tr><th>Total</th><th>${num(summary.strokes)}</th><th>${num(summary.par)}</th><th>—</th></tr></tfoot></table>`;$('#resultPar').textContent=num(summary.par);$('#resultBest').textContent=num(summary.strokes);$('#resultPreviousBest').textContent='—';
 $('#journeyResults').classList.remove('hidden');$('#resultNext').classList.add('hidden');$('#resultRetry').textContent='Play the journey again ↗';styleResultActions();
 const key='persian-isles-golf:hormuz:journey-v2';let old=null;try{const saved=Number(localStorage.getItem(key));if(Number.isInteger(saved)&&saved>0)old=saved;}catch{}
 const record=saveBest(old,summary.strokes);try{localStorage.setItem(key,String(record));}catch{}
 $('#resultBest').textContent=num(record);$('#resultPreviousBest').textContent=old==null?'—':num(old);$('#recordNote').textContent=`Journey best: ${num(record)}${old==null||summary.strokes<old?' · New personal best':''}`;
 $('#resultRetry').focus();
}
function readBest(id){try{const n=Number(localStorage.getItem(levelRecordKey(id)));return Number.isInteger(n)&&n>0?n:null;}catch{return null;}}
$('#sceneryToggle').onclick=()=>{sceneryOnly=!sceneryOnly;$('#menu').classList.toggle('scenery-only',sceneryOnly);$('#sceneryToggle').textContent=sceneryOnly?'Back to holes':'View island';$('#sceneryToggle').setAttribute('aria-pressed',String(sceneryOnly));};
$('#play').onclick=()=>start(true);
document.querySelectorAll('.island-tab').forEach(button=>button.onclick=()=>{unlockPreferredAudio();selectIsland(button.dataset.island);});
document.querySelectorAll('.level-button').forEach(button=>button.onclick=()=>selectLevel(button.dataset.level));
$('#prevIsland').onclick=()=>cycleIsland(-1);$('#nextIsland').onclick=()=>cycleIsland(1);
$('#pause').onclick=()=>{closeTools();togglePause();};$('#resume').onclick=togglePause;$('#restart').onclick=reset;
$('#resultNext').onclick=()=>{if(mode==='journey'&&selectedLevel===3){journeyResults();return;}if(selectedLevel<3){selectedLevel++;reset();canvas.focus();}};
$('#restartQuick').onclick=()=>{reset();canvas.focus();};$('#resultRetry').onclick=()=>{if(journeyFinished){journeyScores=[];selectedLevel=1;}reset();canvas.focus();};
$('#backHome').onclick=home;$('#resultHome').onclick=home;$('#putt').onclick=()=>{putt();canvas.focus();};
$('#aimLeft').onclick=()=>{changeAim(-.10);canvas.focus();};$('#aimRight').onclick=()=>{changeAim(.10);canvas.focus();};
$('#power').oninput=e=>{power=Number(e.target.value)/100;currentPower=power;updateHud();};

$('#zoomOut').onclick=()=>{if(!drag&&!paused)targetZoom=clampZoom(targetZoom-.15);};
$('#zoomIn').onclick=()=>{if(!drag&&!paused)targetZoom=clampZoom(targetZoom+.15);};
$('#overview').onclick=()=>{if(!drag&&!paused){targetZoom=1;orbitAngle=.62;}};

function syncAudioControls(){const a=coastalAudio.getState(),state=a.music&&a.effects?'on':a.music||a.effects?'mixed':'off';$('#musicToggle').checked=a.music;$('#effectsToggle').checked=a.effects;$('#menuSound').textContent=state==='on'?'Sound on':state==='off'?'Sound off':'Sound settings';$('#sound').dataset.audio=state;$('#sound').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8q5 4 0 8"/><path class="sound-off" d="M4 20 20 4"/><path class="sound-mixed" d="M17 19h4"/></svg>';$('#sound').setAttribute('aria-label',`Sound settings: music ${a.music?'on':'off'}, effects ${a.effects?'on':'off'}`);$('#sound').title=$('#sound').getAttribute('aria-label');}
function openAudio(){closeTools();audioWasPaused=paused;if(playing&&!paused&&!state.completed){paused=true;cancelDrag();}coastalAudio.setPaused(true);syncAudioControls();$('#audioPanel').classList.remove('hidden');$('#musicToggle').focus();}
$('#sound').onclick=openAudio;$('#menuSound').onclick=openAudio;
for(const [id,set] of [['musicToggle','setMusic'],['effectsToggle','setEffects']])$("#"+id).onchange=async e=>{coastalAudio[set](e.target.checked);const ok=await unlockPreferredAudio();audioNoticeKey=ok?'':'Audio is unavailable in this browser. The game still works without it.';renderFailureNotices();syncAudioControls();};
$('#audioClose').onclick=()=>{$('#audioPanel').classList.add('hidden');paused=audioWasPaused;coastalAudio.setPaused(paused);if(playing)canvas.focus();else $('#menuSound').focus();};
$('#creditsOpen').onclick=()=>{$('#credits').classList.remove('hidden');$('#creditsClose').focus();};$('#creditsClose').onclick=()=>$('#credits').classList.add('hidden');
$('#helpOpen').onclick=()=>{closeTools();helpWasPaused=paused;if(playing&&!state.completed){paused=true;cancelDrag();}coastalAudio.setPaused(true);$('#helpPanel').classList.remove('hidden');$('#helpClose').focus();};
$('#helpClose').onclick=()=>{$('#helpPanel').classList.add('hidden');paused=helpWasPaused;coastalAudio.setPaused(paused);canvas.focus();};
canvas.tabIndex=0;
function resize(){if(!renderer)return;const w=innerWidth,h=innerHeight;lastView={width:w,height:h};renderer.setSize(w,h,false);resizeCamera();}
addEventListener('resize',()=>{closeTools();resize();});
function updateCamera(dt){
 if(cameraFrozen)return;
 const next=THREE.MathUtils.lerp(zoom,playing?targetZoom:1,1-Math.exp(-dt*10));
 zoom=Math.abs(next-(playing?targetZoom:1))<.001?(playing?targetZoom:1):next;resizeCamera();
 const menuShift=!playing&&!sceneryOnly?(innerWidth>1000?-5.8:innerWidth>innerHeight?-13:0):0;
 const target=playing&&zoom>1?ball.getPosition().clone().multiplyScalar(Math.min(.8,(zoom-1)/.85*.8)):new THREE.Vector3(menuShift,0,-.2);
 target.y=0;

 const distance=37;const offset=new THREE.Vector3(Math.sin(orbitAngle)*distance,distance*.87,Math.cos(orbitAngle)*distance);
 cameraTarget.lerp(target,1-Math.exp(-dt*4));cameraPosition.copy(cameraTarget).add(offset);
 camera.position.lerp(cameraPosition,1-Math.exp(-dt*4));camera.lookAt(cameraTarget);
}
function resizeCamera(){const w=innerWidth,h=innerHeight;const portrait=w<h;const scale=(playing?(portrait?27:12):(portrait?Math.max(35,16*h/w):14.4))/zoom;camera.left=-scale*w/h;camera.right=scale*w/h;const shift=playing?(h<560&&w>h?-2.5:0):sceneryOnly?0:portrait?-scale*.49:-2;camera.top=scale+shift;camera.bottom=-scale+shift;camera.updateProjectionMatrix();}
function updatePreview(){origin.visible=playing&&!paused&&!state.completed&&ball.state==='aiming';const ringPos=ball.getPosition();origin.position.set(ringPos.x,.025,ringPos.z);arrowGroup.visible=playing&&!paused&&!state.completed&&ball.state==='aiming';if(!arrowGroup.visible)return;const dir=aimDir(),p=drag?drag.p:power,pos=ball.getPosition();const length=1+shotSpeed(p)*.36;for(let i=0;i<dots.length;i++){const distance=(i+1)/dots.length*length;dots[i].position.set(pos.x+dir.x*distance,.08,pos.z+dir.z*distance);dots[i].scale.setScalar(1-i*.025);}arrowTip.position.set(pos.x+dir.x*(length+.12),.085,pos.z+dir.z*(length+.12));arrowTip.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(dir.x,0,dir.z));targetRing.position.set(pos.x,.025,pos.z);targetRing.visible=arrowGroup.visible;}
function animate(now){if(destroyed)return;requestAnimationFrame(animate);const dt=Math.min((now-lastTime)/1000,.06);lastTime=now;elapsed+=dt;if(!ready)return;if(playing&&!paused&&!state.completed){ball.capturePreviousTransform();physics.step(dt);ball.update(physics.getInterpolationAlpha(),dt);const p=ball.rigidBody.translation();if(captureCup(p,currentLevel().hole)&&state.strokes>0)complete();else if(ball.state==='out_of_bounds'){state.strokes++;ball.strokes=state.strokes;ball.respawn();ball.mesh.scale.setScalar(1);updateHud();setStatus('Returned to your last shot · +1');}else if(ball.state==='aiming')setStatus('Ready to putt');else setStatus('Rolling');}ball.ghostSphereMesh.visible=false;ball.windTrail.group.visible=playing&&!paused;targetRing.visible=playing&&!paused&&!state.completed;updatePreview();updateCamera(dt);if(!paused&&!document.hidden&&!reducedMotion.matches)sceneryClock.value+=dt;const motionTime=reducedMotion.matches?0:sceneryClock.value;if(environment.root.visible)environment.update(motionTime);if(!playing){updateIslandMotion(menuDiorama,motionTime,{reducedMotion:reducedMotion.matches,active:true});}else{restoreDiorama();}preview?.update(motionTime);positionDistantFleet();scene.background.lerp(sceneColorTarget,reducedMotion.matches?1:1-Math.exp(-dt*6));scene.fog.color.copy(scene.background);ballMarker.visible=playing&&!state.completed;ballMarker.position.copy(ball.mesh.position);ballMarker.position.y=.023;renderer.render(scene,camera);}
renderLevelCards();
async function init(){try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;resize();scene.add(new THREE.HemisphereLight('#ffe9cc','#347a80',1.15));const sun=new THREE.DirectionalLight('#fff0d1',2.4);sun.position.set(-15,25,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:1,far:80});sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;scene.add(sun);environment=createEnvironment(menuDiorama);await physics.init();ball=new BallController(scene,physics.world,physics.rapier);ball.radius=.145;ball.mesh.geometry.dispose();ball.mesh.geometry=new THREE.SphereGeometry(ball.radius,20,16);physics.onBeforeStep=()=>ball.capturePreviousTransform();ready=true;reset();menuDiorama.add(ball.mesh,finishFlag);setLevelUI();renderLevelCards();cameraTarget.set(innerWidth>800?-5.2:0,0,-.2);camera.position.set(22,30,34);syncAudioControls();selectIsland('hormuz');requestAnimationFrame(animate);if(import.meta.env.DEV&&new URLSearchParams(location.search).has('qa'))window.__golf={state:()=>({strokes:state.strokes,completed:state.completed,ball:{...ball.rigidBody.translation()},phase:ball.state,paused,power,zoom,targetZoom,preview:previewId,level:selectedLevel,mode,sceneryTime:sceneryClock.value,menuMotion:{y:menuDiorama.position.y,yaw:menuDiorama.rotation.y},journey:[...journeyScores],audio:coastalAudio.getState(),angle:aimAngle,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),project:(x,z)=>{const v=new THREE.Vector3(x,.11,z).project(camera);return{x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight}},goal:()=>({...currentLevel().hole}),islandCorners,fleet:fleetBounds};}catch(error){console.error(error);loadErrorKey='The island could not load. This game needs a WebGL-capable browser. Try Chrome or reload the page.';renderFailureNotices();}}
addEventListener('pagehide',()=>coastalAudio.dispose());
init();
