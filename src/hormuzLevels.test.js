import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { LEVELS } from './journey.js';
import { HORMUZ_NEW_LEVELS } from './hormuzLevels.js';

it('preserves the exact original three geometry records', () => {
  const hashes=['bd30f7184bbc4ccc4bde644b40e5706a8e0e1ddbebb684d99378e779b49aca89','47b8d1f378a37b6269123b680c37f2bf72deb1d1945874f911c60aa2d2e19bf9','e0bf45e2b2a9211a16e69c98fbe600927cce177d9f7499c73ae9e4843f4a9680'];
  for (const [i,l] of LEVELS.slice(0,3).entries()) expect(createHash('sha256').update(JSON.stringify({start:l.start,hole:l.hole,outline:l.outline,walls:l.walls,obstacles:l.obstacles})).digest('hex')).toBe(hashes[i]);
});
it('adds six unique routes with increasing route-reading lessons, not placeholder holes', () => {
  expect(HORMUZ_NEW_LEVELS.map(level=>level.id)).toEqual([4,5,6,7,8,9]);
  expect(new Set(LEVELS.map(level=>JSON.stringify([level.start,level.hole,level.outline,level.obstacles]))).size).toBe(9);
  expect(new Set(LEVELS.map(level=>level.name)).size).toBe(9);
  for (const level of HORMUZ_NEW_LEVELS) {
    expect(level.island).toBe('hormuz');
    expect(level.lesson.length).toBeGreaterThan(40);
    expect(level.par).toBeGreaterThanOrEqual(4);
    expect(level.obstacles.length).toBeGreaterThan(0);
    expect(level.walls).toHaveLength(level.outline.length);
    for (const [x,z] of level.outline) expect((x>=-7.8&&x<=-4.2&&z>=-6&&z<=7)||(x>=-7.8&&x<=7.8&&z>=-6&&z<=-2.4)||(x>=4.2&&x<=7.8&&z>=-6&&z<=7)).toBe(true);
  }
});
