import * as THREE from 'three';
import { COURSE } from './courseData.js';

export function createHormuzCourse(scene, physics, level = COURSE) {
  const { world, rapier } = physics;
  const group = new THREE.Group(); group.name = 'Hormuz rainbow coast fairway'; scene.add(group);
  const bodies=[];
  const material=(color)=>new THREE.MeshStandardMaterial({color, roughness:.88, flatShading:true});
  const cream=material('#e9c995'), red=material('#ac463d'), salt=material('#f4e6ce'), gold=material('#d59353');
  function box(x,y,z,w,h,d,mat,physical=true) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    if(physical) {const body=world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(x,y,z));bodies.push(body);world.createCollider(rapier.ColliderDesc.cuboid(w/2,h/2,d/2).setFriction(.25).setRestitution(.55),body);}
    return mesh;
  }
  // One continuous U-shaped fairway. Its exact visible triangles are also the collider.
  const outline=level.outline ?? [[-7.8,7],[-7.8,-6],[7.8,-6],[7.8,7],[4.2,7],[4.2,-2.4],[-4.2,-2.4],[-4.2,7]];
  const shape=new THREE.Shape(outline.map(([x,z])=>new THREE.Vector2(x,-z)));
  const opening=new THREE.Path(); opening.absarc(level.hole.x,-level.hole.z,.29,0,Math.PI*2,true); shape.holes.push(opening);
  const geo=new THREE.ShapeGeometry(shape,32);geo.rotateX(-Math.PI/2);
  const fairway=new THREE.Mesh(geo,cream);fairway.receiveShadow=true;group.add(fairway);
  const ground=world.createRigidBody(rapier.RigidBodyDesc.fixed());bodies.push(ground);
  world.createCollider(rapier.ColliderDesc.trimesh(new Float32Array(geo.attributes.position.array),new Uint32Array(geo.index.array)).setFriction(.45).setRestitution(.08),ground);
  // Dark-red foundation gives the course a toy-diorama edge without using external models.
  const foundationGeo=new THREE.ExtrudeGeometry(shape,{depth:.34,bevelEnabled:false,curveSegments:32});foundationGeo.rotateX(-Math.PI/2);const foundation=new THREE.Mesh(foundationGeo,red);foundation.position.y=-.36;foundation.castShadow=true;foundation.receiveShadow=true;group.add(foundation);
  // Red mineral curb with pale salt caps. All solid walls match their colliders.
  const walls=level.walls ?? [[-7.94,.5,.22,13.5],[7.94,.5,.22,13.5],[0,-6.14,16.1,.22],[-4.06,2.36,.22,9.5],[4.06,2.36,.22,9.5],[0,-2.26,8.3,.22],[-6,7.14,4,.22],[6,7.14,4,.22]];
  for(const [x,z,w,d] of walls){box(x,.16,z,w,.42,d,red);box(x,.39,z,w+.04,.05,d+.04,salt,false);}
  // Twin mineral outcrops split the rear fairway; precision and bank shots remain possible.
  for(const [i,obstacle] of (level.obstacles??[[-1.8,.17,-5.5,.65,.38,.95],[1.2,.17,-2.95,.65,.38,1.05]]).entries())box(...obstacle,i%2?red:gold);
  // Sparse colour inlays: physical material stays consistent and predictable in this slice.
  for(let i=0;i<12;i++){const z=6.3-i*.95;if(z>(level.id===1?-2.3:-6)){box(-6,.006,z,3.5,.008,.025,salt,false);if(!level.id||level.id===3)box(6,.006,z,3.5,.008,.025,salt,false);}}
  if(level.id!==1)for(let i=0;i<(level.id===2?8:9);i++)box(-3.8+i,.006,-4.2,.025,.008,3.5,salt,false);
  // Below-surface cup with a genuine opening and catcher.
  const cupMaterial=new THREE.MeshStandardMaterial({color:'#173f47',roughness:1});
  const inside=new THREE.Mesh(new THREE.CylinderGeometry(.286,.286,.5,32,1,true),cupMaterial);inside.position.set(level.hole.x,-.25,level.hole.z);group.add(inside);
  box(level.hole.x,-.57,level.hole.z,.65,.12,.65,cupMaterial);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.30,.025,8,48),gold);rim.rotation.x=Math.PI/2;rim.position.set(level.hole.x,.012,level.hole.z);group.add(rim);
  let disposed=false;return {group,dispose(){if(disposed)return;disposed=true;for(const body of bodies)world.removeRigidBody(body);const materials=new Set();group.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());scene.remove(group);}};
}
export { COURSE };
