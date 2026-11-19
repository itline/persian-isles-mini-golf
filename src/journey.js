export const ISLANDS=Object.freeze([
 {id:'hormuz',name:'Hormuz',subtitle:'THE RAINBOW ISLAND',description:'Find your line through red earth, salt-white cliffs and turquoise water.',playable:true},
 {id:'qeshm',name:'Qeshm',subtitle:'THE SCULPTED COAST',description:'Wander between weathered canyon walls and sea-carved arches.',playable:false},
 {id:'kish',name:'Kish',subtitle:'THE PALE SHORE',description:'A sunlit promenade, white piers and palms above a clear lagoon.',playable:false},
 {id:'khark',name:'Khark',subtitle:'THE CORAL PLATEAU',description:'Limestone cliffs, a quiet harbour and a lighthouse facing the gulf.',playable:false},
 {id:'hengam',name:'Hengam',subtitle:'THE QUIET TIDE',description:'A little fishing dhow, rocky coves and dolphins beyond the shore.',playable:false},
]);
export const LEVELS=Object.freeze([
 {id:1,name:'Red Shore',par:2,available:true,lesson:'Find your pace. One clear lane, one gentle finish.',start:{x:-6.1,y:.16,z:6.1},hole:{x:-6.1,y:-.4,z:-.8},outline:[[-7.8,7],[-7.8,-2.4],[-4.2,-2.4],[-4.2,7]],walls:[[-7.94,2.3,.22,9.7],[-4.06,2.3,.22,9.7],[-6,-2.54,4.1,.22],[-6,7.14,4.1,.22]],obstacles:[]},
 {id:2,name:'Salt Valley',par:3,available:true,lesson:'Read the corner. Take the open line or bank off the salt walls.',start:{x:-6.1,y:.16,z:5.2},hole:{x:2.9,y:-.4,z:-4.2},outline:[[-7.8,7],[-7.8,-6],[4.2,-6],[4.2,-2.4],[-4.2,-2.4],[-4.2,7]],walls:[[-7.94,.5,.22,13.5],[-1.8,-6.14,12.5,.22],[-4.06,2.36,.22,9.5],[0,-2.26,8.3,.22],[-6,7.14,4,.22],[4.34,-4.2,.22,4.1]],obstacles:[[-1.5,.17,-5.45,.65,.38,1.05]]},
 {id:3,name:'Rainbow Run',par:4,available:true,lesson:'Choose your line through the long turn and mineral outcrops.',start:{x:-6.1,y:.16,z:6.5},hole:{x:6,y:-.4,z:5.4},outline:[[-7.8,7],[-7.8,-6],[7.8,-6],[7.8,7],[4.2,7],[4.2,-2.4],[-4.2,-2.4],[-4.2,7]],walls:[[-7.94,.5,.22,13.5],[7.94,.5,.22,13.5],[0,-6.14,16.1,.22],[-4.06,2.36,.22,9.5],[4.06,2.36,.22,9.5],[0,-2.26,8.3,.22],[-6,7.14,4,.22],[6,7.14,4,.22]],obstacles:[[-1.8,.17,-5.5,.65,.38,.95],[1.2,.17,-2.95,.65,.38,1.05]]},
 ...Array.from({length:7},(_,i)=>({id:i+4,name:'In development',available:false})),
]);
export function playableLevel(id){return LEVELS.find(l=>l.id===id&&l.available)??null;}
export function levelRecordKey(id){return `persian-isles-golf:hormuz:level-${id}:v2`;}
export function journeySummary(scores){if(!Array.isArray(scores)||scores.length!==3||scores.some(s=>!Number.isInteger(s)||s<=0))return null;return {scores:[...scores],strokes:scores.reduce((a,b)=>a+b,0),par:LEVELS.filter(l=>l.available).reduce((n,l)=>n+l.par,0)};}
export function clampZoom(value){return Math.min(1.85,Math.max(1,Number.isFinite(value)?value:1));}
