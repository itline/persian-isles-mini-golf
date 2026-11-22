import { journeySummary, journeyRecordKey } from './journey.js';
// Checkpoint only completed holes. An interrupted hole restarts from its tee.
export const JOURNEY_PROGRESS_KEY = 'persian-isles-golf:hormuz:journey-9:progress-v1';
const validPrefix = scores => Array.isArray(scores) && scores.length > 0 && scores.length < 9
  && Array.from(scores).every(score => Number.isSafeInteger(score) && score > 0);
export function readJourneyProgress(storage) {
  try {
    const value = JSON.parse((storage ?? localStorage).getItem(JOURNEY_PROGRESS_KEY));
    return value?.version === 1 && validPrefix(value.scores) ? [...value.scores] : null;
  } catch { return null; }
}
export function writeJourneyProgress(storage, scores) {
  if (!validPrefix(scores)) return false;
  try {
    (storage ?? localStorage).setItem(JOURNEY_PROGRESS_KEY, JSON.stringify({ version: 1, scores }));
    return true;
  } catch { return false; }
}
export function clearJourneyProgress(storage) {
  try { (storage ?? localStorage).removeItem(JOURNEY_PROGRESS_KEY); } catch {}
}
export function recordCompletedJourney(storage, scores) {
  const summary = journeySummary(scores);
  if (!summary) return null;
  let previous = null;
  try {
    const saved = Number((storage ?? localStorage).getItem(journeyRecordKey('hormuz')));
    if (Number.isSafeInteger(saved) && saved > 0) previous = saved;
  } catch {}
  const best = previous == null ? summary.strokes : Math.min(previous, summary.strokes);
  try {
    (storage ?? localStorage).setItem(journeyRecordKey('hormuz'), String(best));
    clearJourneyProgress(storage);
  } catch { /* Keep the last completed-hole checkpoint if the write fails. */ }
  return { previous, best };
}
