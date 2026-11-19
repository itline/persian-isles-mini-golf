import * as THREE from 'three';
import { createEnvironment } from './environment.js';
import { createHormuzCourse, COURSE } from './course.js';
import { initialHormuzState, clampPower, scoreLabel } from './game.js';
import { shotSpeed, captureCup, saveBest } from './shot.js';
import { PhysicsWorld } from './vendor/physics/PhysicsWorld';
import { BallController } from './vendor/player/BallController';
import { ISLANDS, LEVELS, playableLevel, levelRecordKey, journeySummary, clampZoom } from './journey.js';
import { createCoastalAudio } from './audio.js';
import './styles.css';
import './mobile.css';
import './collection.css';

const $ = selector => document.querySelector(selector);
$('#app').innerHTML = `
  <canvas id="scene" aria-label="Three dimensional miniature golf course inspired by Hormuz Island"></canvas>
  <section id="menu" class="menu">
    <div class="brand"><span class="brand-mark">✦</span> PERSIAN ISLES GOLF</div>
    <div class="hero-copy"><p class="eyebrow">THE PERSIAN GULF COLLECTION / 01</p><h1>The colour<br>of the <em>coast.</em></h1>
    <p class="lede" id="islandDescription">Find your line through a little world of red earth, salt-white cliffs and turquoise water.</p>
    <div class="island-nav"><button id="prevIsland" aria-label="Previous island">←</button><strong id="selectedIslandName">Hormuz</strong><button id="nextIsland" aria-label="Next island">→</button></div><div class="island-switcher" aria-label="Choose an island">${ISLANDS.map(island=>`<button class="island-tab ${island.id==='hormuz'?'selected':''}" data-island="${island.id}"><span>${island.name}</span><small>${island.subtitle}</small>${island.playable?'':'<b>LOCKED</b>'}</button>`).join('')}</div>
    <div class="island-availability" id="islandAvailability">Playable now · 3 of 10 holes ready</div>
    <button id="play" class="primary" disabled>Preparing the island…</button>
    <p id="journeyNote" class="journey-note">Or explore any open hole below. Your best is saved on this device.</p>
    <div id="levelGrid" class="level-grid" aria-label="Hormuz holes">${LEVELS.map(level=>`<button class="level-button" data-level="${level.id}" ${level.available?'':'disabled'}><span>${String(level.id).padStart(2,'0')}</span><small>${level.available?level.name:'In development'}</small>${level.available?'':'<b>LOCKED</b>'}</button>`).join('')}</div>
    <div class="edition" id="edition">HORMUZ <span>•</span> RAINBOW RUN <span>•</span> PAR 4</div></div>
    <aside class="postcard"><span class="eyebrow" id="postcardEyebrow">THE RAINBOW ISLAND</span><b id="postcardName">Hormuz Island</b><small id="postcardText">A miniature inspired by Iran’s rainbow island.<br>Playful geography, not a map.</small></aside>
    <footer class="menu-footer"><span>FIVE ISLANDS. ONE COAST.</span><div><button id="sceneryToggle" class="text-btn" aria-pressed="false">View island</button><button id="menuSound" class="text-btn">Sound off</button><button id="creditsOpen" class="text-btn">About & credits ↗</button></div></footer>
  </section>
  <section id="game" class="hidden">
    <header class="topbar"><div class="game-title"><span class="eyebrow">PERSIAN ISLES GOLF</span><strong>Hormuz <i id="levelTitle">01 / RED SHORE</i></strong></div>
    <div class="top-actions"><button id="sound" class="circle-btn" aria-label="Enable sound" title="Enable sound">♪<span class="slash">/</span></button><button id="view" class="circle-btn" aria-label="Change camera view" title="Change camera view">◇</button><button id="pause" class="circle-btn" aria-label="Pause game" title="Pause game">Ⅱ</button></div></header>
    <div class="hud"><div class="hole-stat"><small>HOLE</small><strong id="holeNumber">01</strong><span id="levelName">Red Shore</span></div><div><small>PAR</small><strong id="parValue">2</strong></div><div><small>STROKES</small><strong id="strokes">0</strong></div><div><small>BEST</small><strong id="best">—</strong></div></div>
    <div class="shot-controls"><div class="shot-status"><span class="ready-dot"></span><b id="status" aria-live="polite">Loading</b><button id="restartQuick" class="text-btn" aria-label="Restart hole">Restart ↺</button></div>
    <div class="power-heading"><span>POWER</span><b id="powerValue">45%</b></div><input id="power" aria-label="Shot power" type="range" min="8" max="100" value="45">
    <div class="direction-controls"><button id="aimLeft" aria-label="Aim left">↶</button><button id="putt" class="putt-btn">Putt <kbd>SPACE</kbd></button><button id="aimRight" aria-label="Aim right">↷</button></div></div>
    <div class="zoom-controls" aria-label="Camera zoom"><button id="zoomOut" aria-label="Zoom out">−</button><button id="overview" aria-label="Full course view">◇</button><button id="zoomIn" aria-label="Zoom in">+</button></div>
    <div id="hint" class="hint">Drag back anywhere to aim · release to putt <span>Arrows: aim & power · right-drag: orbit</span></div>
  </section>
  <section id="pausePanel" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="pauseTitle"><div class="panel"><p class="eyebrow">ON ISLAND TIME</p><h2 id="pauseTitle">Take a breath.</h2><p>The coast can wait. Your next line is right where you left it.</p><button id="resume" class="primary">Resume</button><button id="restart" class="secondary">Restart hole</button><button id="backHome" class="text-btn">Back to the coast</button></div></section>
  <section id="resultPanel" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="resultTitle"><div class="panel result"><p class="eyebrow">HORMUZ / HOLE COMPLETE</p><h2 id="resultTitle">A line to remember.</h2><div class="score-number"><b id="resultStrokes">0</b><div><span id="resultScore">PAR</span><small id="resultSubscore">strokes · par 2</small></div></div><p id="recordNote"></p><div id="journeyResults" class="journey-results hidden"></div><div class="nature-note">The red, gold and pale layers of Hormuz come from its remarkable geology. This course is a playful interpretation, not a real golf site.</div><button id="resultRetry" class="primary">Find a better line ↗</button><button id="resultNext" class="secondary">Next open hole</button><button id="resultHome" class="text-btn">Back to the coast</button></div></section>
  <section id="credits" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="creditTitle"><div class="panel credits"><p class="eyebrow">ABOUT THIS SLICE</p><h2 id="creditTitle">A coast of our own.</h2><p>A five-island preview with three playable Hormuz holes. The other islands are visible but remain locked while they are being built.</p><p>Procedural landscapes, course, interface and synthesized audio created for this project. No models or art were taken from the benchmark game.</p><p>Ball & fixed-step physics adapted from <a href="https://github.com/LCmaster/minigolf" target="_blank" rel="noopener">Mini Golf Mania</a> by Luiz Vicente (MIT). Three.js (MIT), Rapier (Apache-2.0). Required notices ship with the build.</p><p>Nature reference: <a href="https://science.nasa.gov/earth/earth-observatory/irans-rainbow-island-147428" target="_blank" rel="noopener">NASA Earth Observatory, Iran’s Rainbow Island</a>.</p><button id="creditsClose" class="primary">Back</button></div></section>
  <section id="audioPanel" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="audioTitle"><div class="panel"><p class="eyebrow">COASTAL SOUNDS</p><h2 id="audioTitle">A quieter rhythm.</h2><p>Original, softly synthesized island music. Music and game sounds are optional and saved separately on this device.</p><label class="audio-option"><span>Island music</span><input id="musicToggle" type="checkbox"></label><label class="audio-option"><span>Shot &amp; completion sounds</span><input id="effectsToggle" type="checkbox"></label><p id="audioNotice" aria-live="polite"></p><button id="audioClose" class="primary">Back</button></div></section>
  <div id="loadError" class="load-error hidden" role="alert"></div>`;

let renderer, environment, physicalCourse, ball;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#b3dce0'); scene.fog = new THREE.Fog('#b3dce0',58,125);
const camera = new THREE.OrthographicCamera(-18,18,13,-13,.1,200);
const physics = new PhysicsWorld();
let state={...initialHormuzState}, playing=false, paused=false, ready=false, destroyed=false;
let drag=null, orbit=null, aimAngle=0, power=.45, currentPower=.45, zoom=1, orbitAngle=.62;
let selectedIsland='hormuz', selectedLevel=1, preview, previewId='hormuz', previewVersion=0;
let mode='single', journeyScores=[], journeyFinished=false, audioWasPaused=false;
let targetZoom=1, cameraFrozen=false, sceneryOnly=false;const pointers=new Map();let pinch=null, menuSwipe=null;
const presets={hormuz:'#b3dce0',qeshm:'#bfd4d1',kish:'#bbe3e5',khark:'#b6d4d4',hengam:'#a8dbe1'};
const coastalAudio=createCoastalAudio();
let lastTime=performance.now(), elapsed=0, best=null, lastView={width:0,height:0};
let cameraTarget=new THREE.Vector3(), cameraPosition=new THREE.Vector3(), completionTimer=null;
// The original slice record belongs only to the unchanged Rainbow Run (hole 3).
try{const old=Number(localStorage.getItem('persian-isles-golf:hormuz:course-v1'));if(Number.isInteger(old)&&old>0&&!localStorage.getItem(levelRecordKey(3)))localStorage.setItem(levelRecordKey(3),String(old));}catch{}
const canvas=$('#scene');
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

function currentLevel(){return playableLevel(selectedLevel)||playableLevel(1);}
function setLevelUI(){const level=currentLevel();$('#levelTitle').textContent=`${String(level.id).padStart(2,'0')} / ${level.name.toUpperCase()}`;$('#holeNumber').textContent=String(level.id).padStart(2,'0');$('#levelName').textContent=level.name;$('#parValue').textContent=level.par;$('#resultSubscore').textContent=`strokes · par ${level.par}`;$('#edition').innerHTML=`HORMUZ <span>•</span> ${level.name.toUpperCase()} <span>•</span> PAR ${level.par}`;}
function setStatus(text){$('#status').textContent=text;$('#putt').disabled=!ready||state.completed||paused||ball?.state!=='aiming';}
function updateHud(){$('#strokes').textContent=state.strokes;$('#best').textContent=best??'—';$('#powerValue').textContent=`${Math.round(currentPower*100)}%`;$('#power').value=Math.round(power*100);}
function updateBest(){try{const stored=Number(localStorage.getItem(levelRecordKey(selectedLevel)));best=Number.isInteger(stored)&&stored>0?stored:null;}catch{best=null;}}
function sound(frequency=440,duration=.06){coastalAudio.effect(frequency,duration);}
function reset(){if(!ready)return;const level=currentLevel();physicalCourse?.dispose();physicalCourse=createHormuzCourse(scene,physics,level);origin.visible=true;clearTimeout(completionTimer);journeyFinished=false;cameraFrozen=false;pointers.clear();pinch=null;$('#journeyResults').classList.add('hidden');$('#resultNext').classList.remove('hidden');$('#resultRetry').textContent='Find a better line ↗';$('#resultTitle').textContent='A line to remember.';$('#resultNext').textContent=mode==='journey'&&selectedLevel===3?'See journey results':'Next open hole';$('#resultNext').disabled=mode!=='journey'&&selectedLevel===3;drag=null;orbit=null;state={...initialHormuzState,island:'Hormuz',par:level.par};paused=false;coastalAudio.setPaused(false);aimAngle=0;power=.45;currentPower=power;zoom=1;targetZoom=1;ball.createPhysicsBody(new THREE.Vector3(level.start.x,.16,level.start.z));ball.setBallColor('#fff9ed');ball.mesh.scale.setScalar(1);ball.ghostSphereMesh.visible=false;finishFlag.position.set(level.hole.x,.04,level.hole.z);targetRing.position.set(level.start.x,.025,level.start.z);origin.position.set(level.start.x,.025,level.start.z);$('#pausePanel').classList.add('hidden');$('#resultPanel').classList.add('hidden');$('#hint').classList.remove('hidden');updateBest();setLevelUI();updateHud();setStatus('Ready to putt');resize();}
function start(journey=false){if(!ready||selectedIsland!=='hormuz'||previewId!=='hormuz')return;mode=journey?'journey':'single';journeyScores=[];if(journey)selectedLevel=1;playing=true;$('#menu').classList.add('hidden');$('#game').classList.remove('hidden');reset();resize();coastalAudio.unlock();sound(660);canvas.focus();}
function home(){clearTimeout(completionTimer);playing=false;paused=false;drag=null;coastalAudio.setPaused(false);$('#pausePanel').classList.add('hidden');$('#resultPanel').classList.add('hidden');$('#game').classList.add('hidden');$('#menu').classList.remove('hidden');arrowGroup.visible=false;targetZoom=1;cameraFrozen=false;pointers.clear();pinch=null;mode='single';selectIsland('hormuz');$('#play').focus();}
function togglePause(){if(!playing||!ready||state.completed)return;paused=!paused;drag=null;orbit=null;coastalAudio.setPaused(paused);$('#pausePanel').classList.toggle('hidden',!paused);if(paused)$('#resume').focus();else canvas.focus();}
function aimDir(){return {x:Math.sin(aimAngle),z:-Math.cos(aimAngle)};}
function putt(p=power,dir=aimDir()){if(!ready||!playing||paused||state.completed||ball.state!=='aiming'||p<.025)return;const force=ball.rigidBody.mass()*shotSpeed(p);ball.shoot(new THREE.Vector3(dir.x*force,0,dir.z*force));state.strokes=ball.strokes;currentPower=power;updateHud();setStatus('Rolling');sound(300,.09);$('#hint').classList.add('hidden');}
function complete(){if(state.completed)return;const level=currentLevel();state.completed=true;drag=null;ball.sinkAt(new THREE.Vector3(level.hole.x,-.37,level.hole.z));arrowGroup.visible=false;if(mode==='journey')journeyScores[selectedLevel-1]=state.strokes;const old=best;best=saveBest(best,state.strokes);try{localStorage.setItem(levelRecordKey(selectedLevel),String(best));}catch{}updateHud();setStatus('Holed!');sound(880,.2);$('#resultStrokes').textContent=state.strokes;$('#resultScore').textContent=scoreLabel(state.strokes,level.par);$('#recordNote').textContent=old==null||state.strokes<old?'A new personal best on this coast.':`Your best line: ${best} ${best===1?'stroke':'strokes'}. Try another angle.`;completionTimer=setTimeout(()=>{$('#resultPanel').classList.remove('hidden');$('#resultRetry').focus();},650);}
const raycaster=new THREE.Raycaster(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.11);
function groundPoint(x,y){const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),camera);return raycaster.ray.intersectPlane(groundPlane,new THREE.Vector3());}
function cancelDrag(){drag=null;orbit=null;cameraFrozen=false;currentPower=power;updateHud();}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
 if(!ready)return;
 if(!playing){if(e.pointerType==='touch')menuSwipe={x:e.clientX,y:e.clientY};return;}
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
 if(!playing&&menuSwipe){const d=e.clientX-menuSwipe.x;if(Math.abs(d)>55&&Math.abs(e.clientY-menuSwipe.y)<70)cycleIsland(d<0?1:-1);menuSwipe=null;return;}
 if(pinch){if(pointers.size===0){pinch=null;cameraFrozen=false;}return;}
 if(orbit){orbit=null;return;}if(!drag)return;
 const {p,dir}=drag;drag=null;cameraFrozen=false;putt(p,dir);
});
canvas.addEventListener('pointercancel',()=>{pointers.clear();pinch=null;cancelDrag();});
addEventListener('blur',()=>{cancelDrag();if(playing&&!paused&&!state.completed)togglePause();});
canvas.addEventListener('wheel',e=>{if(!playing||paused||drag)return;e.preventDefault();targetZoom=clampZoom(targetZoom+(e.deltaY<0?.1:-.1));},{passive:false});
function changeAim(n){if(!paused&&ball?.state==='aiming')aimAngle+=n;}
addEventListener('keydown',e=>{if(!$('#audioPanel').classList.contains('hidden')){if(e.code==='Escape')$('#audioClose').click();return;}if(!playing||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&e.code!=='Escape')return;if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(e.code==='Escape'){if(drag)cancelDrag();else togglePause();return;}if(paused)return;if(e.code==='Space')putt();if(e.code==='ArrowLeft')changeAim(-.055);if(e.code==='ArrowRight')changeAim(.055);if(e.code==='ArrowUp')power=clampPower(power+.025);if(e.code==='ArrowDown')power=Math.max(.08,power-.025);currentPower=power;updateHud();});
async function selectIsland(id){
 const island=ISLANDS.find(value=>value.id===id);if(!island||playing||!ready)return;
 selectedIsland=id;const version=++previewVersion;
 document.querySelectorAll('.island-tab').forEach(tab=>{const selected=tab.dataset.island===id;tab.classList.toggle('selected',selected);tab.setAttribute('aria-pressed',String(selected));});
 $('#selectedIslandName').textContent=island.name;$('#islandDescription').textContent=island.description;
 $('#postcardEyebrow').textContent=island.subtitle;$('#postcardName').textContent=`${island.name} Island`;
 $('#postcardText').textContent=island.playable?'Three holes open now. A playful interpretation, not a map.':'A visual preview. Golf on this island is still in development.';
 $('#islandAvailability').textContent=island.playable?'Playable now · 3 of 10 holes ready':'Coming soon · Preview only';
 $('#play').disabled=true;$('#play').innerHTML=island.playable?'Play Hormuz journey <span>↗</span>':'Locked · In development';
 $('#levelGrid').classList.toggle('hidden',!island.playable);$('#journeyNote').classList.toggle('hidden',!island.playable);$('#edition').classList.toggle('hidden',!island.playable);
 preview?.dispose();preview=undefined;
 environment.root.visible=id==='hormuz';physicalCourse.group.visible=id==='hormuz';ball.setVisible(id==='hormuz');finishFlag.visible=id==='hormuz';
 origin.visible=false;targetRing.visible=false;arrowGroup.visible=false;
 scene.background.set(presets[id]);scene.fog.color.set(presets[id]);coastalAudio.setIsland(id);
 if(id!=='hormuz'){
  try{const {createIslandPreview}=await import('./islandPreviews.js');if(version!==previewVersion)return;preview=createIslandPreview(scene,id);}catch(error){if(version!==previewVersion)return;$('#islandAvailability').textContent='Preview could not load · Try another island';console.error(error);return;}
 }
 if(version!==previewVersion)return;previewId=id;$('#play').disabled=!island.playable||!ready;
}
function cycleIsland(delta){const i=ISLANDS.findIndex(island=>island.id===selectedIsland);selectIsland(ISLANDS[(i+delta+ISLANDS.length)%ISLANDS.length].id);}
function selectLevel(id){const level=playableLevel(Number(id));if(!level||selectedIsland!=='hormuz'||!ready)return;selectedLevel=level.id;start(false);}
function journeyResults(){
 const summary=journeySummary(journeyScores);if(!summary)return;
 journeyFinished=true;$('#resultTitle').textContent='Your Hormuz postcard.';$('#resultStrokes').textContent=summary.strokes;
 $('#resultScore').textContent=scoreLabel(summary.strokes,summary.par);$('#resultSubscore').textContent=`total strokes · par ${summary.par}`;
 $('#recordNote').textContent='Three shores, one journey. Replay to find a better line.';
 $('#journeyResults').innerHTML=summary.scores.map((score,i)=>`<div><span>${i+1}. ${LEVELS[i].name}</span><b>${score} strokes</b><small>Best ${readBest(i+1)??'—'}</small></div>`).join('');
 $('#journeyResults').classList.remove('hidden');$('#resultNext').classList.add('hidden');$('#resultRetry').textContent='Play the journey again ↗';
 try{const key='persian-isles-golf:hormuz:journey-v2';const old=Number(localStorage.getItem(key));localStorage.setItem(key,String(saveBest(old,summary.strokes)));}catch{}
 $('#resultRetry').focus();
}
function readBest(id){try{const n=Number(localStorage.getItem(levelRecordKey(id)));return Number.isInteger(n)&&n>0?n:null;}catch{return null;}}
$('#sceneryToggle').onclick=()=>{sceneryOnly=!sceneryOnly;$('#menu').classList.toggle('scenery-only',sceneryOnly);$('#sceneryToggle').textContent=sceneryOnly?'Back to holes':'View island';$('#sceneryToggle').setAttribute('aria-pressed',String(sceneryOnly));};
$('#play').onclick=()=>start(true);
document.querySelectorAll('.island-tab').forEach(button=>button.onclick=()=>{coastalAudio.unlock();selectIsland(button.dataset.island);});
document.querySelectorAll('.level-button').forEach(button=>button.onclick=()=>selectLevel(button.dataset.level));
$('#prevIsland').onclick=()=>cycleIsland(-1);$('#nextIsland').onclick=()=>cycleIsland(1);
$('#pause').onclick=togglePause;$('#resume').onclick=togglePause;$('#restart').onclick=reset;
$('#resultNext').onclick=()=>{if(mode==='journey'&&selectedLevel===3){journeyResults();return;}if(selectedLevel<3){selectedLevel++;reset();canvas.focus();}};
$('#restartQuick').onclick=()=>{reset();canvas.focus();};$('#resultRetry').onclick=()=>{if(journeyFinished){journeyScores=[];selectedLevel=1;}reset();canvas.focus();};
$('#backHome').onclick=home;$('#resultHome').onclick=home;$('#putt').onclick=()=>{putt();canvas.focus();};
$('#aimLeft').onclick=()=>{changeAim(-.10);canvas.focus();};$('#aimRight').onclick=()=>{changeAim(.10);canvas.focus();};
$('#power').oninput=e=>{power=Number(e.target.value)/100;currentPower=power;updateHud();};
$('#zoomIn').onclick=()=>{if(!paused&&!drag)targetZoom=clampZoom(targetZoom+.15);};
$('#zoomOut').onclick=()=>{if(!paused&&!drag)targetZoom=clampZoom(targetZoom-.15);};
$('#overview').onclick=()=>{if(!drag){targetZoom=1;orbitAngle=.62;}};
$('#view').onclick=()=>{if(!drag)targetZoom=targetZoom===1?1.55:1;};
function syncAudioControls(){const a=coastalAudio.getState();$('#musicToggle').checked=a.music;$('#effectsToggle').checked=a.effects;$('#menuSound').textContent=a.music?'Music on':'Sound settings';$('#sound').innerHTML=a.music?'♪':'♪<span class="slash">/</span>';$('#sound').setAttribute('aria-label','Sound settings');$('#sound').title='Sound settings';}
function openAudio(){audioWasPaused=paused;if(playing&&!paused&&!state.completed){paused=true;cancelDrag();}coastalAudio.setPaused(true);syncAudioControls();$('#audioPanel').classList.remove('hidden');$('#musicToggle').focus();}
$('#sound').onclick=openAudio;$('#menuSound').onclick=openAudio;
for(const [id,set] of [['musicToggle','setMusic'],['effectsToggle','setEffects']])$("#"+id).onchange=async e=>{coastalAudio[set](e.target.checked);const ok=await coastalAudio.unlock();$('#audioNotice').textContent=ok?'':'Audio is unavailable in this browser. The game still works without it.';syncAudioControls();};
$('#audioClose').onclick=()=>{$('#audioPanel').classList.add('hidden');paused=audioWasPaused;coastalAudio.setPaused(paused);if(playing)canvas.focus();else $('#menuSound').focus();};
$('#creditsOpen').onclick=()=>{$('#credits').classList.remove('hidden');$('#creditsClose').focus();};$('#creditsClose').onclick=()=>$('#credits').classList.add('hidden');
canvas.tabIndex=0;
function resize(){if(!renderer)return;const w=innerWidth,h=innerHeight;lastView={width:w,height:h};renderer.setSize(w,h,false);const scale=(playing?(w<h?27:12):(w<h?20:13.4))/zoom;camera.left=-scale*w/h;camera.right=scale*w/h;const verticalShift=h<560&&w>h?-2.5:0;camera.top=scale+verticalShift;camera.bottom=-scale+verticalShift;camera.updateProjectionMatrix();}
addEventListener('resize',resize);
function updateCamera(dt){
 if(cameraFrozen)return;
 const next=THREE.MathUtils.lerp(zoom,playing?targetZoom:1,1-Math.exp(-dt*10));
 zoom=Math.abs(next-(playing?targetZoom:1))<.001?(playing?targetZoom:1):next;resizeCamera();
 const menuShift=!playing&&!sceneryOnly&&innerWidth>1000?-5.8:0;
 const target=playing&&zoom>1?ball.getPosition().clone().multiplyScalar(Math.min(.8,(zoom-1)/.85*.8)):new THREE.Vector3(menuShift,0,-.2);
 target.y=0;
 if(!playing&&innerWidth<=600)target.z=sceneryOnly?0:2;
 const distance=37;const offset=new THREE.Vector3(Math.sin(orbitAngle)*distance,distance*.87,Math.cos(orbitAngle)*distance);
 cameraTarget.lerp(target,1-Math.exp(-dt*4));cameraPosition.copy(cameraTarget).add(offset);
 camera.position.lerp(cameraPosition,1-Math.exp(-dt*4));camera.lookAt(cameraTarget);
}
function resizeCamera(){const w=innerWidth,h=innerHeight;const scale=(playing?(w<h?27:12):(w<h?20:13.4))/zoom;camera.left=-scale*w/h;camera.right=scale*w/h;const shift=h<560&&w>h?-2.5:0;camera.top=scale+shift;camera.bottom=-scale+shift;camera.updateProjectionMatrix();}
function updatePreview(){origin.visible=playing&&!paused&&!state.completed&&ball.state==='aiming';const ringPos=ball.getPosition();origin.position.set(ringPos.x,.025,ringPos.z);arrowGroup.visible=playing&&!paused&&!state.completed&&ball.state==='aiming';if(!arrowGroup.visible)return;const dir=aimDir(),p=drag?drag.p:power,pos=ball.getPosition();const length=1+shotSpeed(p)*.36;for(let i=0;i<dots.length;i++){const distance=(i+1)/dots.length*length;dots[i].position.set(pos.x+dir.x*distance,.08,pos.z+dir.z*distance);dots[i].scale.setScalar(1-i*.025);}arrowTip.position.set(pos.x+dir.x*(length+.12),.085,pos.z+dir.z*(length+.12));arrowTip.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(dir.x,0,dir.z));targetRing.position.set(pos.x,.025,pos.z);targetRing.visible=arrowGroup.visible;}
function animate(now){if(destroyed)return;requestAnimationFrame(animate);const dt=Math.min((now-lastTime)/1000,.06);lastTime=now;elapsed+=dt;if(!ready)return;if(playing&&!paused&&!state.completed){ball.capturePreviousTransform();physics.step(dt);ball.update(physics.getInterpolationAlpha(),dt);const p=ball.rigidBody.translation();if(captureCup(p,currentLevel().hole)&&state.strokes>0)complete();else if(ball.state==='out_of_bounds'){state.strokes++;ball.strokes=state.strokes;ball.respawn();ball.mesh.scale.setScalar(1);updateHud();setStatus('Returned to your last shot · +1');}else if(ball.state==='aiming')setStatus('Ready to putt');else setStatus('Rolling');}ball.ghostSphereMesh.visible=false;ball.windTrail.group.visible=playing&&!paused;targetRing.visible=playing&&!paused&&!state.completed;updatePreview();updateCamera(dt);if(environment.root.visible)environment.update(elapsed);preview?.update(elapsed);renderer.render(scene,camera);}
async function init(){try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;resize();scene.add(new THREE.HemisphereLight('#ffe9cc','#347a80',1.15));const sun=new THREE.DirectionalLight('#fff0d1',2.4);sun.position.set(-15,25,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:1,far:80});sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;scene.add(sun);environment=createEnvironment(scene);await physics.init();ball=new BallController(scene,physics.world,physics.rapier);ball.radius=.145;ball.mesh.geometry.dispose();ball.mesh.geometry=new THREE.SphereGeometry(ball.radius,20,16);physics.onBeforeStep=()=>ball.capturePreviousTransform();ready=true;reset();setLevelUI();cameraTarget.set(innerWidth>800?-5.2:0,0,-.2);camera.position.set(22,30,34);syncAudioControls();selectIsland('hormuz');requestAnimationFrame(animate);if(location.search.includes('qa'))window.__golf={state:()=>({strokes:state.strokes,completed:state.completed,ball:{...ball.rigidBody.translation()},phase:ball.state,paused,power,zoom,targetZoom,preview:previewId,level:selectedLevel,mode,journey:[...journeyScores],audio:coastalAudio.getState(),angle:aimAngle,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),project:(x,z)=>{const v=new THREE.Vector3(x,.11,z).project(camera);return{x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight}},goal:()=>({...currentLevel().hole})};}catch(error){console.error(error);$('#play').textContent='Unable to load';$('#loadError').classList.remove('hidden');$('#loadError').textContent='The island could not load. This game needs a WebGL-capable browser. Try Chrome or reload the page.';}}
addEventListener('pagehide',()=>coastalAudio.dispose());
init();
