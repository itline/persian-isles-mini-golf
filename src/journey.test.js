import { it, expect } from 'vitest';
import { ISLANDS, LEVELS, playableLevel, levelsForIsland, nextLevel, levelRecordKey, journeySummary, clampZoom } from './journey.js';

it('offers exactly nine playable Hormuz holes and four preview-only islands', () => {
  expect(ISLANDS.map(island => island.id)).toEqual(['hormuz', 'qeshm', 'kish', 'khark', 'hengam']);
  expect(ISLANDS.filter(island => island.playable).map(island => island.id)).toEqual(['hormuz']);
  expect(LEVELS).toHaveLength(9);
  expect(LEVELS.every(level => level.available)).toBe(true);
  expect(levelsForIsland('hormuz').map(level => level.id)).toEqual([1,2,3,4,5,6,7,8,9]);
  for (const island of ['qeshm','kish','khark','hengam','unknown']) expect(levelsForIsland(island)).toEqual([]);
  expect(playableLevel(9)).not.toBeNull();
  for (const id of [0,10,999]) expect(playableLevel(id)).toBeNull();
  expect(nextLevel(8).id).toBe(9);
  expect(nextLevel(9)).toBeNull();
});
it('preserves all Hormuz level save keys including the original three', () => {
  for (let id=1;id<=9;id++) expect(levelRecordKey(id)).toBe(`persian-isles-golf:hormuz:level-${id}:v2`);
});
it('summarizes only complete nine-hole journeys against Hormuz par', () => {
  const scores = [2,3,4,4,4,4,5,5,5];
  expect(journeySummary([2,3,4])).toBeNull();
  expect(journeySummary(scores.slice(1))).toBeNull();
  expect(journeySummary([...scores,1])).toBeNull();
  expect(journeySummary(Array(9))).toBeNull();
  for (const invalid of [0,-1,1.5,NaN,Infinity,'2']) expect(journeySummary([invalid,...scores.slice(1)])).toBeNull();
  for (const island of ['qeshm','kish','khark','hengam']) expect(journeySummary(scores,island)).toBeNull();
  expect(journeySummary(scores)).toEqual({scores,strokes:36,par:36});
  expect(clampZoom(.2)).toBe(1);
  expect(clampZoom(9)).toBe(1.85);
  expect(clampZoom(NaN)).toBe(1);
});
