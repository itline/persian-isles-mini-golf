import { describe, expect, it } from 'vitest';
import { readJourneyProgress, writeJourneyProgress, clearJourneyProgress, recordCompletedJourney, JOURNEY_PROGRESS_KEY } from './journeyProgress.js';
const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
};
describe('nine-hole journey checkpoints', () => {
  it('records a complete journey before clearing recovery, without touching legacy records', () => {
    const store = storage();
    const key = 'persian-isles-golf:hormuz:journey-9:v1';
    store.setItem('persian-isles-golf:hormuz:journey-v2', '1');
    writeJourneyProgress(store, [1, 2]);
    expect(recordCompletedJourney(store, [1, 2])).toBeNull();
    expect(readJourneyProgress(store)).toEqual([1, 2]);
    expect(recordCompletedJourney(store, Array(9).fill(3))).toEqual({ previous: null, best: 27 });
    expect(store.getItem(key)).toBe('27');
    expect(readJourneyProgress(store)).toBeNull();
    expect(recordCompletedJourney(store, Array(9).fill(4))).toEqual({ previous: 27, best: 27 });
    expect(store.getItem('persian-isles-golf:hormuz:journey-v2')).toBe('1');
  });
  it('retains only completed holes; never pretends to save a mid-hole ball', () => {
    const store = storage();
    expect(readJourneyProgress(store)).toBeNull();
    expect(writeJourneyProgress(store, [1, 2, 4])).toBe(true);
    expect(readJourneyProgress(store)).toEqual([1, 2, 4]);
    clearJourneyProgress(store);
    expect(readJourneyProgress(store)).toBeNull();
  });
  it.each([[], Array(3), [0], [-1], [1.5], ['2'], [null], [Infinity], Array(9).fill(2), Array(10).fill(2)])('rejects invalid/complete score prefix %j', scores => {
    const store = storage();
    expect(writeJourneyProgress(store, scores)).toBe(false);
    store.setItem(JOURNEY_PROGRESS_KEY, JSON.stringify({ version: 1, scores }));
    expect(readJourneyProgress(store)).toBeNull();
  });
  it('isolates old three-hole checkpoints and rejects malformed or unknown versions', () => {
    const store = storage();
    store.setItem('persian-isles-golf:hormuz:journey-v2', '7');
    for (const value of ['garbage', 'null', '{"version":2,"scores":[1]}', '[1,2]']) {
      store.setItem(JOURNEY_PROGRESS_KEY, value);
      expect(readJourneyProgress(store)).toBeNull();
    }
  });
  it('does not block gameplay when browser storage is denied', () => {
    const denied = { getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); } };
    expect(readJourneyProgress(denied)).toBeNull();
    expect(writeJourneyProgress(denied, [1])).toBe(false);
    expect(() => clearJourneyProgress(denied)).not.toThrow();
    expect(recordCompletedJourney(denied, Array(9).fill(2))).toEqual({ previous: null, best: 18 });
  });
  it('retains the last checkpoint if persisting the final best fails', () => {
    const store = storage();
    writeJourneyProgress(store, Array(8).fill(2));
    store.setItem = () => { throw Error('quota'); };
    expect(recordCompletedJourney(store, Array(9).fill(2))).toEqual({ previous: null, best: 18 });
    expect(readJourneyProgress(store)).toEqual(Array(8).fill(2));
  });
});
