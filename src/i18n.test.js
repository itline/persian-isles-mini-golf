import { describe, it, expect } from 'vitest';

const storageKey = 'persian-isles-golf:language:v1';
const memoryStorage = (initial = {}) => {
  const entries = new Map(Object.entries(initial));
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), entries };
};

describe('saving language preferences', () => {
  it('round-trips en/fa without overwriting unrelated progress or sound settings', async () => {
    const { readLanguage, saveLanguage } = await import('./i18n.js');
    const storage = memoryStorage({ progress: '9', music: 'true' });
    expect(saveLanguage(storage, 'fa')).toBe('fa');
    expect(readLanguage(storage)).toBe('fa');
    expect(storage.entries.get(storageKey)).toBe('fa');
    expect(saveLanguage(storage, 'en')).toBe('en');
    expect(readLanguage(storage)).toBe('en');
    expect(storage.entries.get('progress')).toBe('9');
    expect(storage.entries.get('music')).toBe('true');
  });

  it('normalizes unsupported choices to English', async () => {
    const { readLanguage, saveLanguage } = await import('./i18n.js');
    const storage = memoryStorage({ [storageKey]: 'fa' });
    for (const value of ['fr', 'FA', '', null, undefined]) {
      expect(saveLanguage(storage, value)).toBe('en');
      expect(readLanguage(storage)).toBe('en');
    }
  });

  it('returns the chosen language even when persistence is unavailable', async () => {
    const { saveLanguage } = await import('./i18n.js');
    for (const storage of [null, undefined, {}, { setItem() { throw new Error('quota'); } }, { get setItem() { throw new Error('denied'); } }]) {
      expect(saveLanguage(storage, 'fa')).toBe('fa');
    }
  });
});

describe('source-string translation', () => {
  it('preserves English source and unknown keys instead of exposing lookup identifiers', async () => {
    const { t } = await import('./i18n.js');
    expect(t('en', 'Play Hormuz journey')).toBe('Play Hormuz journey');
    expect(t('fa', 'An untranslated sentence.')).toBe('An untranslated sentence.');
    expect(t('fr', 'Play Hormuz journey')).toBe('Play Hormuz journey');
    expect(t(undefined, 'Play Hormuz journey')).toBe('Play Hormuz journey');
    for (const key of ['toString', 'constructor', '__proto__', '']) expect(t('fa', key)).toBe(key);
  });

  it('interpolates repeated own placeholders without replacing missing or inherited variables', async () => {
    const { t } = await import('./i18n.js');
    expect(t('en', 'Best {n}, next {n}, {missing}', { n: 0 })).toBe('Best 0, next 0, {missing}');
    expect(t('en', '{name}: {n}', { name: '$&', n: 3 })).toBe('$&: 3');
    expect(t('en', '{inherited}', Object.create({ inherited: 'no' }))).toBe('{inherited}');
    expect(t('en', '{n}')).toBe('{n}');
    expect(t('en', '{n}', null)).toBe('{n}');
  });

  it('translates the required UI vocabulary and dynamic placeholders', async () => {
    const { t } = await import('./i18n.js');
    const required = ['Choose your island', 'Play Hormuz journey', 'Practice a hole', '3 open holes · 7 more in development', 'Preview only', 'In development', 'More holes are in development.', 'Best {n}', 'Par {n}', 'Completed', 'Not played yet', 'Next hole', 'Try again', 'Play again', 'Journey best: {n}', 'Full course view', 'Help', 'How to play', 'Drag back, release to putt.', 'Longer drag, more power.', 'Scroll or pinch to zoom.', 'Arrows aim and set power. Space puts.', 'Start playing', 'Next', 'Back', 'English', 'Persian', 'Your Hormuz postcard.', 'strokes · par {n}', '{n} strokes', 'total strokes · par {n}', 'Hole {n}', 'Music', 'Effects', 'View island', 'Back to holes', 'Coming soon · Preview only'];
    for (const key of required.filter(key => key !== 'English')) {
      expect(t('fa', key, { n: 4 }), key).toMatch(/[\u0600-\u06ff]/);
      expect(t('en', key, { n: 4 }), key).toBe(key === 'Persian' ? 'فارسی' : key.replace(/\{n\}/g, '4'));
    }
    expect(t('fa', 'Best {n}', { n: 12 })).toBe('بهترین 12');
    expect(t('fa', 'Hole {n}', { n: 3 })).toBe('مرحله 3');
  });

  it('shows each language name in its own language regardless of selection', async () => {
    const { t } = await import('./i18n.js');
    for (const lang of ['en', 'fa']) {
      expect(t(lang, 'English')).toBe('English');
      expect(t(lang, 'Persian')).toBe('فارسی');
    }
  });
});

describe('island and level labels', () => {
  it.each([
    ['hormuz', 'Hormuz', 'هرمز'], ['qeshm', 'Qeshm', 'قشم'], ['kish', 'Kish', 'کیش'], ['khark', 'Khark', 'خارک'], ['hengam', 'Hengam', 'هنگام'],
  ])('localizes %s without changing the identity', async (id, en, fa) => {
    const { islandName } = await import('./i18n.js');
    expect(islandName('en', id)).toBe(en);
    expect(islandName('fa', id)).toBe(fa);
    expect(islandName('unsupported', id)).toBe(en);
  });

  it.each([[1, 'Red Shore', 'ساحل سرخ'], [2, 'Salt Valley', 'دره نمک'], [3, 'Rainbow Run', 'راه رنگین‌کمان']])('localizes hole %s', async (id, en, fa) => {
    const { levelName } = await import('./i18n.js');
    expect(levelName('en', id)).toBe(en);
    expect(levelName('fa', id)).toBe(fa);
    expect(levelName('fa', String(id))).toBe(fa);
    expect(levelName(undefined, id)).toBe(en);
  });

  it('leaves unknown identifiers intact, including object prototype names', async () => {
    const { islandName, levelName } = await import('./i18n.js');
    expect(islandName('fa', 'unknown')).toBe('unknown');
    expect(levelName('fa', 999)).toBe('999');
    for (const key of ['constructor', '__proto__', 'toString']) {
      expect(islandName('en', key)).toBe(key);
      expect(levelName('en', key)).toBe(key);
    }
  });
});

describe('localized integer formatting', () => {
  it.each([0, 1, 9, 12, 1234, -12, 2.7])('uses Intl integer formatting for %s', async value => {
    const { formatNumber } = await import('./i18n.js');
    expect(formatNumber('en', value)).toBe(new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(value));
    expect(formatNumber('fa', value)).toBe(new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(value));
    expect(formatNumber('fr', value)).toBe(formatNumber('en', value));
  });
  it('uses Persian digits and accepts already-formatted values in templates', async () => {
    const { formatNumber, t } = await import('./i18n.js');
    expect(formatNumber('fa', 123)).toBe('۱۲۳');
    expect(t('fa', 'Best {n}', { n: formatNumber('fa', 12) })).toBe('بهترین ۱۲');
  });
});

describe('complete original interface vocabulary', () => {
  it('covers status, accessibility, island copy, lessons, scoring, and credits', async () => {
    const { t } = await import('./i18n.js');
    const keys = [
      'PERSIAN ISLES GOLF', 'PERSIAN ISLES MINI GOLF', 'THE PERSIAN GULF COLLECTION / 01', 'The colour of the coast.', 'Previous island', 'Next island', 'Choose an island', 'Language', 'LOCKED', 'Preparing the island…', 'Hormuz holes', 'Hormuz Island', '{name} Island', 'FIVE ISLANDS. ONE COAST.', 'Sound off', 'Sound on', 'Music on', 'About & credits ↗', 'Enable sound', 'Change camera view', 'Pause game', 'HOLE', 'PAR', 'STROKES', 'BEST', 'POWER', 'Restart ↺', 'Shot power', 'Aim left', 'Aim right', 'Putt', 'SPACE', 'Camera zoom', 'Zoom out', 'Zoom in', 'Drag back anywhere to aim · release to putt', 'Arrows: aim & power · right-drag: orbit', 'ON ISLAND TIME', 'ABOUT THIS SLICE', 'A coast of our own.', 'COASTAL SOUNDS', 'A quieter rhythm.', 'Preview could not load · Try another island', 'Unable to load', 'The island could not load. This game needs a WebGL-capable browser. Try reloading in a modern browser.',
      'Find a better line', 'Play the journey again', 'The island could not load. This game needs a WebGL-capable browser. Try Chrome or reload the page.', 'Three dimensional miniature golf course inspired by Hormuz Island', 'Best —', 'Red Shore', 'Salt Valley', 'Rainbow Run', 'Hormuz', 'Qeshm', 'Kish', 'Khark', 'Hengam', 'HORMUZ', 'RAINBOW RUN', 'RED SHORE', 'SALT VALLEY',
      'THE SCULPTED COAST', 'THE PALE SHORE', 'THE CORAL PLATEAU', 'THE RAINBOW ISLAND', 'THE QUIET TIDE',
      'Wander between weathered canyon walls and sea-carved arches.', 'A sunlit promenade, white piers and palms above a clear lagoon.', 'Limestone cliffs, a quiet harbour and a lighthouse facing the gulf.', 'Find your line through red earth, salt-white cliffs and turquoise water.', 'A little fishing dhow, rocky coves and dolphins beyond the shore.',
      'Find your pace. One clear lane, one gentle finish.', 'Read the corner. Take the open line or bank off the salt walls.', 'Choose your line through the long turn and mineral outcrops.',
      'HOLE IN ONE', 'ALBATROSS', 'EAGLE', 'BIRDIE', 'BOGEY', 'stroke', 'strokes', 'Your best line: {n} {strokeWord}. Try another angle.', 'Your best line: {n} strokes. Try another angle.', 'Ready to putt', 'Rolling', 'Holed!', 'Returned to your last shot · +1',
      'Ball & fixed-step physics adapted from {game} by Luiz Vicente (MIT). Three.js (MIT), Rapier (Apache-2.0). Required notices ship with the build.', 'Ball & fixed-step physics adapted from', 'by Luiz Vicente (MIT). Three.js (MIT), Rapier (Apache-2.0). Required notices ship with the build.', 'Nature reference:', 'NASA Earth Observatory, Iran’s Rainbow Island', 'Sound settings', 'Audio is unavailable in this browser. The game still works without it.',
      'Putt', 'Ready to putt', 'Rolling', 'Holed!', 'Returned to your last shot · +1', 'A line to remember.', 'A new personal best on this coast.', 'Next open hole', 'See journey results', 'Play the journey again ↗', 'Find a better line ↗', 'Back to the coast', 'Resume', 'Take a breath.', 'Restart hole',
    ];
    for (const key of keys) {
      expect(t('fa', key), key).not.toBe(key);
      expect(t('en', key), key).toBe(key);
    }
  });
});

// Import inside each test so a missing module is a visible RED test failure.
describe('language preferences', () => {
  it('defaults to English without storage or a supported saved preference', async () => {
    const { readLanguage } = await import('./i18n.js');
    for (const storage of [undefined, null, {}, memoryStorage(), memoryStorage({ [storageKey]: 'fr' }), memoryStorage({ [storageKey]: 'FA' })]) {
      expect(readLanguage(storage)).toBe('en');
    }
  });

  it('reads only the explicitly saved en/fa preference', async () => {
    const { readLanguage } = await import('./i18n.js');
    expect(readLanguage(memoryStorage({ [storageKey]: 'fa' }))).toBe('fa');
    expect(readLanguage(memoryStorage({ [storageKey]: 'en' }))).toBe('en');
  });

  it('survives denied storage reads including throwing property access', async () => {
    const { readLanguage } = await import('./i18n.js');
    expect(readLanguage({ getItem() { throw new Error('denied'); } })).toBe('en');
    expect(readLanguage({ get getItem() { throw new Error('denied'); } })).toBe('en');
  });
});
