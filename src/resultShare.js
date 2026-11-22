const ISLAND_NAMES = Object.freeze({ hormuz: 'Hormuz' });
const isIsland = island => island === 'hormuz';
const isHole = hole => Number.isInteger(hole) && hole >= 1 && hole <= 9;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function safeUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)
      || /[\s\u0000-\u001f\u007f\\<>"'`]/u.test(value)
      || /%(?![\da-f]{2})/i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.hostname && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function courseLink(baseUrl, selection) {
  if (!isRecord(selection) || !isIsland(selection.island)
      || Object.keys(selection).some(key => key !== 'island' && key !== 'hole')
      || (selection.hole !== undefined && !isHole(selection.hole))) return null;
  const { island, hole } = selection;
  const url = safeUrl(baseUrl);
  if (!url) return null;
  url.search = '';
  url.hash = '';
  url.searchParams.set('island', island);
  if (hole !== undefined) url.searchParams.set('hole', hole);
  return url.href;
}
export function readInvitation(value) {
  const url = safeUrl(value);
  if (!url) return null;
  const island = url.searchParams.get('island');
  const hole = url.searchParams.get('hole');
  if (!isIsland(island) || url.searchParams.getAll('island').length !== 1
      || url.searchParams.getAll('hole').length > 1
      || (hole !== null && !/^[1-9]$/.test(hole))) return null;
  return hole === null ? { island } : { island, hole: Number(hole) };
}
const RESULT_FIELDS = new Set([
  'island', 'islandName', 'hole', 'holeName', 'strokes', 'par', 'journey', 'baseUrl',
]);
const isScore = value => Number.isSafeInteger(value) && value > 0;
const isLabel = value => typeof value === 'string' && value.length <= 80
  && value.trim() === value && /^[A-Za-z0-9][A-Za-z0-9 .,'()-]*$/.test(value);

export function resultShare(input) {
  if (!isRecord(input) || Object.keys(input).some(key => !RESULT_FIELDS.has(key))) return null;
  const { island, islandName = ISLAND_NAMES[island], hole, holeName, strokes, par,
    journey = false, baseUrl } = input;
  if (!isIsland(island) || islandName !== ISLAND_NAMES[island]
      || !isScore(strokes) || !isScore(par) || typeof journey !== 'boolean'
      || (journey ? hole !== undefined || holeName !== undefined : !isHole(hole))
      || (holeName !== undefined && !isLabel(holeName))) return null;
  const url = courseLink(baseUrl, journey ? { island } : { island, hole });
  if (!url) return null;
  const subject = journey ? '9-hole journey' : `Hole ${hole}${holeName ? `: ${holeName}` : ''}`;
  const replay = journey ? 'journey' : 'hole';
  return {
    title: `Persian Isles Mini Golf - ${islandName}`,
    text: `${islandName} - ${subject}\n${strokes} ${strokes === 1 ? 'stroke' : 'strokes'} | Par ${par}\nSelf-reported local score. Play the same ${replay}.`,
    url,
  };
}
