// New Hormuz holes stay inside the scenery's reserved U-shaped fairway.
// Coordinates and curbs are data only: the existing course/physics owns every solid.
function curbs(outline) {
  return outline.map(([x,z],i) => {
    const [nextX,nextZ] = outline[(i+1)%outline.length];
    const dx=nextX-x,dz=nextZ-z,length=Math.hypot(dx,dz);
    return [(x+nextX)/2+dz/length*.14,(z+nextZ)/2-dx/length*.14,
      Math.abs(dx)+.22,Math.abs(dz)+.22];
  });
}
const leftTurn=[[-7.8,7],[-7.8,-6],[4.2,-6],[4.2,-2.4],[-4.2,-2.4],[-4.2,7]];
const shortReturn=[[-7.8,7],[-7.8,-6],[7.8,-6],[7.8,2.4],[4.2,2.4],[4.2,-2.4],[-4.2,-2.4],[-4.2,7]];
const fullReturn=[[-7.8,7],[-7.8,-6],[7.8,-6],[7.8,7],[4.2,7],[4.2,-2.4],[-4.2,-2.4],[-4.2,7]];
function hole(id,name,par,lesson,start,cup,outline,obstacles) {
  return {id,island:'hormuz',name,par,available:true,lesson,
    start:{x:start[0],y:.16,z:start[1]},hole:{x:cup[0],y:-.4,z:cup[1]},
    outline:outline.map(point=>[...point]),walls:curbs(outline),obstacles};
}
export const HORMUZ_NEW_LEVELS=Object.freeze([
  hole(4,'Salt Gate',4,'Choose a side of the salt gate, then set up the open corner.',
    [-6.1,6.1],[2.9,-4.2],leftTurn,[[-6,.17,1.2,.65,.38,1.2]]),
  hole(5,'Ochre Switchback',4,'Play the bend in reverse. Leave room to turn after the divided crossing.',
    [2.9,-4.8],[-6.1,5.5],leftTurn,[[-1,.17,-4.2,1.2,.38,.65]]),
  hole(6,'Twin Pass',4,'Two mineral islands offer a near line and a wider, safer crossing.',
    [-6.1,5.7],[6,-.1],shortReturn,[[-1.8,.17,-4.2,.7,.38,.7],[1.8,.17,-4.2,.7,.38,.7]]),
  hole(7,'Eastern Steps',5,'Reverse the long coast. Alternate around the eastern steps before the turn.',
    [6.2,6.1],[-6.1,5.3],fullReturn,[[4.75,.17,2,1.05,.38,.65],[7.05,.17,-.5,1.05,.38,.65]]),
  hole(8,'Mineral Weave',5,'Weave between offset outcrops, then choose the upper or lower finish.',
    [-6.1,6.1],[2.9,-3.35],leftTurn,[[-7.05,.17,2.5,1.05,.38,.7],[-4.95,.17,-.5,1.05,.38,.7],[.1,.17,-4.2,.7,.38,1.15]]),
  hole(9,'Rainbow Crown',5,'Bring the whole coast together: a split ascent, an open crossing and one last gate.',
    [-6.1,6.1],[6,5.6],fullReturn,[[-6,.17,1.5,.65,.38,1.4],[0,.17,-4.2,.7,.38,.8],[6,.17,.2,.65,.38,1.3]]),
]);
