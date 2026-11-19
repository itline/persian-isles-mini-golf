import {clampPower} from './game.js';
export function shotSpeed(power){return 10*Math.pow(clampPower(power),1.3)}
export function boundedAim(x,z){const l=Math.hypot(x,z);return l>1e-8?{x:x/l,z:z/l}:{x:0,z:-1}}
export function captureCup(ball,hole){return ball.y<-.035&&Math.hypot(ball.x-hole.x,ball.z-hole.z)<.23}
export function saveBest(old,score){if(!Number.isInteger(score)||score<1)return old;return Number.isInteger(old)&&old>0?Math.min(old,score):score}
