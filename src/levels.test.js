import {it,expect} from 'vitest';
import * as THREE from 'three';
import {PhysicsWorld} from './vendor/physics/PhysicsWorld';
import {BallController} from './vendor/player/BallController';
import {createHormuzCourse} from './course.js';
import {LEVELS} from './journey.js';
for(const level of LEVELS.filter(l=>l.available))it(`level ${level.id} renders and physically catches its own cup`,async()=>{
 const physics=new PhysicsWorld();await physics.init();const scene=new THREE.Scene();const course=createHormuzCourse(scene,physics,level);
 // Positioning the ball over the cup isolates cup-capture geometry; this does not prove whole-round playability.
 const ball=new BallController(scene,physics.world,physics.rapier);ball.radius=.145;ball.createPhysicsBody(new THREE.Vector3(level.hole.x,.16,level.hole.z));
 for(let i=0;i<150;i++){physics.step(1/120);ball.update(1,1/120);}
 expect(ball.getPosition().y).toBeLessThan(-.1);
 scene.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(level.start.x,2,level.start.z),new THREE.Vector3(0,-1,0));
 expect(ray.intersectObjects(course.group.children,true)[0].point.y).toBeLessThanOrEqual(.011);
 ball.dispose();course.dispose();physics.dispose();
});
