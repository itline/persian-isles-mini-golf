import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createEnvironment} from './environment.js';
import {createIslandPreview} from './islandPreviews.js';
it('sea covers menu frustum corners rather than exposing diagonal background wedges',()=>{
 const views=[[1440,900],[2560,1080],[390,844],[768,1024],[844,390]];
 for(const id of ['hormuz','qeshm','kish','khark','hengam']){
  const parent=new THREE.Scene(),view=id==='hormuz'?createEnvironment(parent):createIslandPreview(parent,id);
  const water=view.root.getObjectByName(id==='hormuz'?'Seawater':'Preview sea');
  parent.updateMatrixWorld(true);water.geometry.computeBoundingBox();
  for(const [w,h] of views)for(const scenery of [false,true]){
   const scale=w<h?Math.max(35,16*h/w):14.4,shift=scenery?0:w<h?-scale*.49:-2;
   const camera=new THREE.OrthographicCamera(-scale*w/h,scale*w/h,scale+shift,-scale+shift,.1,200);
   const target=new THREE.Vector3(scenery?0:w>1000?-5.8:w>h?-13:0,0,-.2);
   camera.position.copy(target).add(new THREE.Vector3(Math.sin(.62)*37,37*.87,Math.cos(.62)*37));camera.lookAt(target);camera.updateMatrixWorld(true);
   const plane=new THREE.Plane(new THREE.Vector3(0,1,0),3.8),ray=new THREE.Raycaster();
   for(const x of [-1,1])for(const y of [-1,1]){
    ray.setFromCamera(new THREE.Vector2(x,y),camera);const p=ray.ray.intersectPlane(plane,new THREE.Vector3());
    // Above-water horizon corners legitimately see the background, not a sea edge.
    if(!p)continue;water.worldToLocal(p);
    const bounds=water.geometry.boundingBox;
    expect(p.x,`${id} ${w}x${h} water x`).toBeGreaterThanOrEqual(bounds.min.x);expect(p.x).toBeLessThanOrEqual(bounds.max.x);
    expect(p.y,`${id} ${w}x${h} water y`).toBeGreaterThanOrEqual(bounds.min.y);expect(p.y).toBeLessThanOrEqual(bounds.max.y);
   }
  }
  view.dispose();
 }
});
