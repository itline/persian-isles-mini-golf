import {it, expect} from 'vitest';
import * as THREE from 'three';
import {PhysicsWorld} from './vendor/physics/PhysicsWorld';
import {BallController} from './vendor/player/BallController';
import {createHormuzCourse, COURSE} from './course.js';

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
