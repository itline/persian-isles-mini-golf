import { describe, expect, it } from 'vitest';
import { courseLink, readInvitation, resultShare } from './resultShare.js';

const baseUrl = 'https://golf.example/play/index.html?qa=1&utm_source=test#debug';

// API: courseLink(baseUrl, { island, hole? }) and readInvitation(absoluteUrl)
// return a canonical URL / { island, hole? }, or null for invalid input.
// resultShare({ island, hole?, strokes, par, journey?: boolean, baseUrl,
//               islandName?: string, holeName?: string }) returns plain-text
// { title, text, url }, or null. Journey scores are caller-supplied totals;
// journey: true requires hole/holeName to be omitted. Hole is the island-local
// number (1..9), for playable Hormuz only. islandName must match the canonical
// English name; optional holeName is a trimmed ASCII label of 1..80 characters.
// Only absolute HTTP(S) URL strings are accepted. Unknown input fields return null.
describe('resultShare', () => {
  const valid = { island: 'hormuz', hole: 1, strokes: 2, par: 2, baseUrl };
  it.each([
    ...['strokes', 'par'].flatMap(key =>
      [undefined, null, 0, -1, 1.5, NaN, Infinity, -Infinity, '2', true, Number.MAX_SAFE_INTEGER + 1]
        .map(value => [`invalid ${key}: ${String(value)}`, { ...valid, [key]: value }])),
    ['missing input', undefined], ['null input', null], ['array input', []],
    ['unknown island', { ...valid, island: 'kish' }],
    ['missing individual hole', { ...valid, hole: undefined }],
    ['hole above playable range', { ...valid, hole: 10 }],
    ['string hole', { ...valid, hole: '1' }],
    ['invalid journey mode', { ...valid, journey: 'true' }],
    ['null journey mode', { ...valid, journey: null }],
    ['journey with a selected hole', { ...valid, journey: true }],
    ['journey with a hole label', { ...valid, hole: undefined, journey: true, holeName: 'Red Shore' }],
    ['missing URL', { ...valid, baseUrl: undefined }],
    ['unsafe URL', { ...valid, baseUrl: 'javascript:alert(1)' }],
    ['unexpected field', { ...valid, verified: true }],
    ['mismatched island label', { ...valid, islandName: 'Qeshm' }],
    ['markup island label', { ...valid, islandName: '<img src=x onerror=alert(1)>' }],
    ...[null, 1, '', ' Red Shore', 'Red Shore ', '<img>', 'Red\nShore', 'Salt &lt;img&gt;',
      'جزیره', 'x'.repeat(81)].map(holeName => ['unsafe hole label', { ...valid, holeName }]),
  ])('returns null for %s', (_label, input) => {
    expect(resultShare(input)).toBeNull();
  });
  it('shares a completed journey total with an island-only replay link', () => {
    expect(resultShare({ island: 'hormuz', strokes: 27, par: 30, journey: true, baseUrl })).toEqual({
      title: 'Persian Isles Mini Golf - Hormuz',
      text: 'Hormuz - 9-hole journey\n27 strokes | Par 30\nSelf-reported local score. Play the same journey.',
      url: 'https://golf.example/play/index.html?island=hormuz',
    });
  });
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])('shares and reopens Hormuz hole %i', hole => {
    const url = `https://golf.example/play/index.html?island=hormuz&hole=${hole}`;
    expect(resultShare({ island: 'hormuz', hole, strokes: 1, par: 4, baseUrl })).toEqual({
      title: 'Persian Isles Mini Golf - Hormuz',
      text: `Hormuz - Hole ${hole}\n1 stroke | Par 4\nSelf-reported local score. Play the same hole.`,
      url,
    });
    expect(courseLink(baseUrl, { island: 'hormuz', hole })).toBe(url);
    expect(readInvitation(url)).toEqual({ island: 'hormuz', hole });
  });
  it('shares an individual result as English plain text with an explicitly local score', () => {
    expect(resultShare({
      island: 'hormuz', islandName: 'Hormuz', hole: 1, holeName: 'Red Shore',
      strokes: 2, par: 2, baseUrl,
    })).toEqual({
      title: 'Persian Isles Mini Golf - Hormuz',
      text: 'Hormuz - Hole 1: Red Shore\n2 strokes | Par 2\nSelf-reported local score. Play the same hole.',
      url: 'https://golf.example/play/index.html?island=hormuz&hole=1',
    });
  });
});

describe('readInvitation', () => {
  it.each([
    '', '?hole=1', '?island=kish', '?island=Hormuz', '?island=',
    '?island=hormuz&island=qeshm', '?island=qeshm&island=qeshm',
    '?island=hormuz&island=hormuz',
    '?island=hormuz&hole=1&hole=2', '?island=hormuz&hole=1&hole=1',
    ...['', '0', '10', '99', '-1', '1.0', '1e0', '01', '09', '+1', '%201', '1%20',
      'Infinity', 'NaN', 'true', '%3Cimg%3E', '%31%ZZ', '1%0A', '1%0D'].map(hole => `?island=hormuz&hole=${hole}`),
  ])('rejects malformed or ambiguous invitation %s', query => {
    expect(readInvitation(`https://golf.example/play${query}`)).toBeNull();
  });
  it.each([undefined, null, {}, '/?island=hormuz', 'javascript:alert(1)',
    'data:text/html,?island=hormuz', 'https://user:pass@golf.example/?island=hormuz'])
    ('rejects an unsafe invitation URL %s', value => {
      expect(readInvitation(value)).toBeNull();
    });
  it.each(['hormuz'])('reads %s island and local holes without coercion', island => {
    expect(readInvitation(`https://golf.example/play?island=${island}`)).toEqual({ island });
    for (const hole of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const selection = { island, hole };
      expect(readInvitation(courseLink(baseUrl, selection))).toEqual(selection);
    }
    expect(readInvitation(`https://golf.example/play?qa=1&island=${island}&hole=2#debug`))
      .toEqual({ island, hole: 2 });
  });
});

describe('preview-only islands', () => {
  it.each(['qeshm', 'kish', 'khark', 'hengam'])('rejects playable invitations and results for %s', island => {
    for (const hole of [undefined, 1, 9]) {
      const selection = hole === undefined ? { island } : { island, hole };
      expect(courseLink(baseUrl, selection)).toBeNull();
      const query = `island=${island}${hole === undefined ? '' : `&hole=${hole}`}`;
      expect(readInvitation(`https://golf.example/play?${query}`)).toBeNull();
      expect(resultShare({ ...selection, strokes: 2, par: 3,
        journey: hole === undefined, baseUrl })).toBeNull();
    }
  });
});

describe('courseLink', () => {
  it.each([
    ['unknown island', baseUrl, { island: 'kish', hole: 1 }],
    ['case mismatch', baseUrl, { island: 'Hormuz', hole: 1 }],
    ['injected island', baseUrl, { island: 'qeshm&qa=1', hole: 1 }],
    ['missing selector', baseUrl, undefined],
    ['null selector', baseUrl, null],
    ['array selector', baseUrl, []],
    ['unexpected selector', baseUrl, { island: 'hormuz', level: 1 }],
    ...[0, 10, 99, -1, 1.5, NaN, Infinity, '2', '02', null, true].map(hole =>
      [`invalid hole ${String(hole)}`, baseUrl, { island: 'hormuz', hole }]),
    ...['javascript:alert(1)', 'data:text/html,test', 'file:///play.html',
      '//golf.example/play', 'https:golf.example', '/play', '', null, {},
      'https://user:pass@golf.example/play', ' https://golf.example/play',
      'https://golf.example/\nplay', 'https://golf.example/<img>',
      'https://golf.example/\\\\evil', 'https://golf.example/%ZZ',
      'https://golf.example/\u0000play'].map(url =>
      [`unsafe URL ${String(url)}`, url, { island: 'hormuz', hole: 1 }]),
  ])('rejects %s without throwing', (_label, url, selection) => {
    expect(courseLink(url, selection)).toBeNull();
  });
  it('omits the hole for an island journey invitation', () => {
    expect(courseLink(baseUrl, { island: 'hormuz' })).toBe(
      'https://golf.example/play/index.html?island=hormuz',
    );
  });
  it('links to the same page and only shares the selected island and local hole number', () => {
    expect(courseLink(baseUrl, { island: 'hormuz', hole: 9 })).toBe(
      'https://golf.example/play/index.html?island=hormuz&hole=9',
    );
  });
});
