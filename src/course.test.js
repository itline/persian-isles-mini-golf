import {it, expect} from 'vitest';
import * as THREE from 'three';
import {PhysicsWorld} from './vendor/physics/PhysicsWorld';
import {BallController} from './vendor/player/BallController';
import {createHormuzCourse, COURSE} from './course.js';
const TEST_PALETTE={cream:'#d8c3a4',red:'#9c634f',salt:'#faf0da',gold:'#d7ad68'};
import {LEVELS} from './journey.js';

const HORMUZ_LEVELS=LEVELS.filter(level=>level.available&&(level.island??'hormuz')==='hormuz');

// Rapier can weld/reorder vertices: compare triangles by coordinates instead of indices.
function triangles(vertices,indices) {
 const result=[];
 for(let i=0;i<indices.length;i+=3)result.push(Array.from(indices.slice(i,i+3),index=>
  Array.from(vertices.slice(index*3,index*3+3),value=>value.toFixed(5).replace('-0.00000','0.00000')).join(','),
 ).sort().join('|'));
 return result.sort();
}

function geometryState(course) {
 return course.group.children.map(mesh=>({
  type:mesh.geometry.type,
  positions:Array.from(mesh.geometry.attributes.position.array),indices:Array.from(mesh.geometry.index?.array??[]),
  position:mesh.position.toArray(),rotation:mesh.rotation.toArray(),scale:mesh.scale.toArray(),
 }));
}

function colliderState(physics) {
 const colliders=[];
 physics.world.forEachCollider(collider=>colliders.push(collider));
 // Inspect after iteration: Rapier holds a WASM borrow while invoking the callback.
 return colliders.map(collider=>{
  const isFloor=collider.shapeType()===physics.rapier.ShapeType.TriMesh;
  return {
   type:collider.shapeType(),position:collider.translation(),rotation:collider.rotation(),
   friction:collider.friction(),restitution:collider.restitution(),
   shape:isFloor?triangles(collider.vertices(),collider.indices()):collider.halfExtents(),
  };
 }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

it.each([COURSE,...HORMUZ_LEVELS])('keeps visible geometry and physical floor/walls unchanged by palette for hole $id',async(level)=>{
 const physics=new PhysicsWorld();await physics.init();
 const course=createHormuzCourse(new THREE.Scene(),physics,{...level,palette:undefined});
 const originalGeometry=geometryState(course),originalColliders=colliderState(physics);
 course.dispose();
 const recolored=createHormuzCourse(new THREE.Scene(),physics,{...level,palette:TEST_PALETTE});
 try {
  expect(geometryState(recolored)).toEqual(originalGeometry);
  expect(colliderState(physics)).toEqual(originalColliders);
  const floor=recolored.group.children.find(mesh=>mesh.geometry.type==='ShapeGeometry');
  const colliders=[];physics.world.forEachCollider(collider=>colliders.push(collider));
  const ground=colliders.find(collider=>collider.shapeType()===physics.rapier.ShapeType.TriMesh);
  expect(triangles(ground.vertices(),ground.indices())).toEqual(triangles(floor.geometry.attributes.position.array,floor.geometry.index.array));
  expect(ground.friction()).toBeCloseTo(.45);expect(ground.restitution()).toBeCloseTo(.08);
  expect(colliders).toHaveLength(1+(level.walls?.length??8)+(level.obstacles?.length??2)+1);
  for(const collider of colliders.filter(entry=>entry!==ground)) {
   const {x,y,z}=collider.translation();
   const mesh=recolored.group.children.find(entry=>entry.geometry.type==='BoxGeometry'&&
    Math.abs(entry.position.x-x)<.00001&&Math.abs(entry.position.y-y)<.00001&&Math.abs(entry.position.z-z)<.00001);
   expect(mesh).toBeDefined();
   const size=mesh.geometry.parameters,half=collider.halfExtents();
   expect(half.x).toBeCloseTo(size.width/2,5);expect(half.y).toBeCloseTo(size.height/2,5);expect(half.z).toBeCloseTo(size.depth/2,5);
   expect(collider.friction()).toBeCloseTo(.25);expect(collider.restitution()).toBeCloseTo(.55);
  }
 } finally {recolored.dispose();physics.dispose();}
});

it.each([COURSE,...HORMUZ_LEVELS])('preserves default Hormuz colours and lane inlays for hole $id',async(level)=>{
 const physics=new PhysicsWorld();await physics.init();
 const course=createHormuzCourse(new THREE.Scene(),physics,level);
 try {
  const meshes=course.group.children;
  expect(meshes.find(mesh=>mesh.geometry.type==='ShapeGeometry').material.color.getHexString()).toBe('e9c995');
  expect(meshes.find(mesh=>mesh.geometry.type==='ExtrudeGeometry').material.color.getHexString()).toBe('ac463d');
  expect(meshes.find(mesh=>mesh.geometry.type==='TorusGeometry').material.color.getHexString()).toBe('d59353');
  const inlays=meshes.filter(mesh=>mesh.geometry.type==='BoxGeometry'&&mesh.geometry.parameters.height===.008);
  const expected=[];
  for(let i=0;i<(!level.id||level.id<=3?12:0);i++) {
   const z=6.3-i*.95;
   if(z>(level.id===1?-2.3:-6)) {
    expected.push([-6,.006,z]);if(!level.id||level.id===3)expected.push([6,.006,z]);
   }
  }
  if(level.id!==1&&(!level.id||level.id<=3))for(let i=0;i<(level.id===2?8:9);i++)expected.push([-3.8+i,.006,-4.2]);
  expect(inlays.map(mesh=>mesh.position.toArray())).toEqual(expected);
  for(const mesh of inlays)expect(mesh.material.color.getHexString()).toBe('f4e6ce');
 } finally {course.dispose();physics.dispose();}
});

it('keeps the Hormuz palette fixed even if stale level data contains an override',async()=>{
 const physics=new PhysicsWorld();await physics.init();
 const course=createHormuzCourse(new THREE.Scene(),physics,{...COURSE,palette:{cream:TEST_PALETTE.cream}});
 try {
  const meshes=course.group.children;
  expect(meshes.find(mesh=>mesh.geometry.type==='ShapeGeometry').material.color.getHexString()).toBe('e9c995');
  expect(meshes.find(mesh=>mesh.geometry.type==='ExtrudeGeometry').material.color.getHexString()).toBe('ac463d');
  expect(meshes.find(mesh=>mesh.geometry.type==='TorusGeometry').material.color.getHexString()).toBe('d59353');
  expect(meshes.find(mesh=>mesh.geometry.type==='BoxGeometry'&&mesh.geometry.parameters.height===.05).material.color.getHexString()).toBe('f4e6ce');
 } finally {course.dispose();physics.dispose();}
});

it.each(HORMUZ_LEVELS)('supports the tee and an open physical cup on Hormuz hole $id', async(level)=>{
 const physics=new PhysicsWorld();await physics.init();const scene=new THREE.Scene();
 const course=createHormuzCourse(scene,physics,level);
 const ball=new BallController(scene,physics.world,physics.rapier);
 try {
  scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(level.start.x,2,level.start.z),new THREE.Vector3(0,-1,0));
  const tee=ray.intersectObjects(course.group.children,true)[0];
  expect(tee.point.y).toBeLessThanOrEqual(.011);
  expect(tee.point.y).toBeGreaterThanOrEqual(-.001);
  const meshes=course.group.children;
  const floor=meshes.find(mesh=>mesh.geometry.type==='ShapeGeometry');
  const cupRay=new THREE.Raycaster(new THREE.Vector3(level.hole.x,2,level.hole.z),new THREE.Vector3(0,-1,0));
  expect(cupRay.intersectObject(floor)).toHaveLength(0);
  ball.createPhysicsBody(new THREE.Vector3(level.start.x,.15,level.start.z));
  for(let i=0;i<120;i++){physics.step(1/120);ball.update(1,1/120);}
  expect(ball.getPosition().y).toBeGreaterThan(.05);
  expect(ball.getPosition().y).toBeLessThan(.16);
  ball.dispose();
  const cupBall=new BallController(scene,physics.world,physics.rapier);
  try {
   cupBall.createPhysicsBody(new THREE.Vector3(level.hole.x,.13,level.hole.z));
   for(let i=0;i<120;i++){physics.step(1/120);cupBall.update(1,1/120);}
   expect(cupBall.getPosition().y).toBeLessThan(-.12);
   expect(cupBall.getPosition().y).toBeGreaterThan(-1);
  } finally {cupBall.dispose();}
 } finally {ball.dispose();course.dispose();physics.dispose();}
});

it('supports a rolling ball and keeps it inside the same walls shown by the course',async()=>{
 const physics = new PhysicsWorld(); await physics.init(); const scene=new THREE.Scene();
 const course=createHormuzCourse(scene,physics);
 const ball=new BallController(scene,physics.world,physics.rapier); ball.createPhysicsBody(new THREE.Vector3(-6,.15,4));
 const mass=ball.rigidBody.mass(); ball.shoot(new THREE.Vector3(mass*2,0,0));
 for(let i=0;i<600;i++){ball.capturePreviousTransform();physics.step(1/120);ball.update(1,1/120)}
 expect(ball.getPosition().x).toBeLessThan(-4.1);
 expect(ball.getPosition().y).toBeGreaterThan(0);
 expect(course.group.children.length).toBeGreaterThan(8);
 ball.dispose();course.dispose();physics.dispose();
});
it('does not render the foundation above the physical putting surface',async()=>{
 const physics=new PhysicsWorld();await physics.init();const scene=new THREE.Scene();const c=createHormuzCourse(scene,physics);
 scene.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(COURSE.start.x,2,COURSE.start.z),new THREE.Vector3(0,-1,0));
 const hits=ray.intersectObjects(c.group.children,true);
 expect(hits.length).toBeGreaterThan(0);
 expect(hits[0].point.y).toBeLessThanOrEqual(.011);
 c.dispose();physics.dispose();
});
it('has a real open cup that the physical ball drops into',async()=>{
 const physics=new PhysicsWorld(); await physics.init(); const scene=new THREE.Scene();const c=createHormuzCourse(scene,physics);
 const ball=new BallController(scene,physics.world,physics.rapier);ball.createPhysicsBody(new THREE.Vector3(COURSE.hole.x,.13,COURSE.hole.z));
 for(let i=0;i<120;i++){physics.step(1/120);ball.update(1,1/120)}
 expect(ball.getPosition().y).toBeLessThan(-.12);
 expect(ball.getPosition().y).toBeGreaterThan(-1);
 ball.dispose();c.dispose();physics.dispose();
});
