import {it,expect} from 'vitest';
import {shotSpeed, boundedAim, captureCup, saveBest} from './shot.js';
it('offers predictable speed without high-power random aim',()=>{expect(shotSpeed(0)).toBe(0);expect(shotSpeed(1)).toBe(10);expect(shotSpeed(.5)).toBeGreaterThan(3);expect(shotSpeed(2)).toBe(10);expect(boundedAim(0,-1)).toEqual({x:0,z:-1});});
it('captures only inside the physical cup and below its lip',()=>{expect(captureCup({x:6,y:-.08,z:5.4}, {x:6,z:5.4})).toBe(true);expect(captureCup({x:6,y:.4,z:5.4}, {x:6,z:5.4})).toBe(false);expect(captureCup({x:5,y:-.08,z:5.4}, {x:6,z:5.4})).toBe(false);});
it('never overwrites a personal best with a worse round or invalid score',()=>{expect(saveBest(3,5)).toBe(3);expect(saveBest(5,3)).toBe(3);expect(saveBest(null,4)).toBe(4);expect(saveBest(3,0)).toBe(3);});
