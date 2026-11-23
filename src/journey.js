import { HORMUZ_NEW_LEVELS } from './hormuzLevels.js';

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
 ...HORMUZ_NEW_LEVELS,
]);
export function playableLevel(id){return LEVELS.find(l=>l.id===id&&l.available)??null;}
export function levelsForIsland(island) {
 return LEVELS.filter(level => level.available && (level.island ?? 'hormuz') === island);
}
export function nextLevel(id) {
 const level = playableLevel(id);
 if (!level) return null;
 const levels = levelsForIsland(level.island ?? 'hormuz');
 return levels[levels.indexOf(level) + 1] ?? null;
}
export function journeyRecordKey(island) {
 if (!ISLANDS.some(value => value.id === island)) throw new RangeError('Unknown island');
 return `persian-isles-golf:${island}:journey-9:v1`;
}
export function levelRecordKey(id) {
 const level = playableLevel(id);
 return `persian-isles-golf:${level?.island ?? 'hormuz'}:level-${level?.number ?? id}:v2`;
}
export function journeySummary(scores, island = 'hormuz') {
 const levels = levelsForIsland(island);
 if (!levels.length || !Array.isArray(scores) || scores.length !== levels.length
     || !Array.from(scores).every(score => Number.isSafeInteger(score) && score > 0)) return null;
 return { scores: [...scores], strokes: scores.reduce((a,b) => a+b, 0), par: levels.reduce((n,level) => n+level.par, 0) };
}
export function clampZoom(value, minimum = 1) {
  const bounded = Math.min(1.85, Math.max(minimum, Number.isFinite(value) ? value : 1));
  return Math.abs(bounded - 1) < 1e-10 ? 1 : bounded;
}
