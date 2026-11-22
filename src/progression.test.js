import { describe, expect, it } from 'vitest';
import { levelsForIsland, nextLevel, journeyRecordKey } from './journey.js';

describe('nine-hole Hormuz progression', () => {
  it('lists nine playable holes in course order and no preview gameplay', () => {
    expect(levelsForIsland('hormuz').map(level => level.id)).toEqual([1,2,3,4,5,6,7,8,9]);
    for (const island of ['qeshm','kish','khark','hengam','unknown']) expect(levelsForIsland(island)).toEqual([]);
  });
  it('advances through every hole and stops at the ninth-hole finale', () => {
    for (let id=1;id<9;id++) expect(nextLevel(id)?.id).toBe(id+1);
    expect(nextLevel(9)).toBeNull();
    expect(nextLevel(999)).toBeNull();
  });
  it('never reuses the obsolete three-hole journey best for a nine-hole round', () => {
    expect(journeyRecordKey('hormuz')).toBe('persian-isles-golf:hormuz:journey-9:v1');
    expect(journeyRecordKey('hormuz')).not.toBe('persian-isles-golf:hormuz:journey-v2');
    expect(() => journeyRecordKey('unknown')).toThrow();
  });
});
