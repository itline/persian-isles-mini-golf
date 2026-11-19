import {it,expect} from 'vitest';
import {ISLANDS,LEVELS,playableLevel,levelRecordKey,journeySummary,clampZoom} from './journey.js';
it('offers five browsable islands but only Hormuz is playable',()=>{
 expect(ISLANDS.map(i=>i.id)).toEqual(['qeshm','kish','khark','hormuz','hengam']);
 expect(ISLANDS.filter(i=>i.playable).map(i=>i.id)).toEqual(['hormuz']);
 expect(LEVELS).toHaveLength(10);expect(LEVELS.filter(i=>i.available)).toHaveLength(3);
 expect(playableLevel(1).id).toBe(1);expect(playableLevel(4)).toBeNull();expect(playableLevel(0)).toBeNull();
});
it('keeps records isolated by level and rejects incomplete journeys',()=>{
 expect(levelRecordKey(1)).not.toBe(levelRecordKey(2));
 expect(journeySummary([2,3])).toBeNull();expect(journeySummary([2,0,4])).toBeNull();
 expect(journeySummary([2,3,4])).toEqual({scores:[2,3,4],strokes:9,par:9});
 expect(clampZoom(.2)).toBe(1);expect(clampZoom(9)).toBe(1.85);expect(clampZoom(NaN)).toBe(1);
});
