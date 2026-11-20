# Standalone mini-golf music auditions

Three original, instrumental, 30-second auditions are ready to hear **before** selecting or integrating a replacement soundtrack. No live-game source or audio preferences are imported, edited, or saved by the listening page.

## Listen

- Requested directory URL: <http://127.0.0.1:4181/music-audition/>
- **Working URL on the current Vite development server:** <http://127.0.0.1:4181/music-audition/index.html>
- Local page: `public/music-audition/index.html`. Open this file directly with the sibling media files present; the page uses only inline CSS/JS and relative asset URLs.

**Current dev-server routing limitation:** Vite 8's public-file middleware tests exact file paths. `/music-audition/index.html` is served correctly, but `/music-audition/` falls through to the game SPA. This was confirmed with HTTP requests and Chrome. A directory-index static host will serve the directory URL normally. The main agent must add an explicit development route/rewrite if the short directory URL is mandatory; doing so requires changing server configuration outside this task's permitted ownership. No game-source workaround was added.

## Concepts

| File stem | Concept | Direction | Tempo |
| --- | --- | --- | --- |
| `coastal-pulse` | **Coastal pulse — recommended** | Warm melodic keys, rounded bass, relaxed shaker/kick groove; major-key cadence | 96 BPM |
| `sunlit-marimba` | Sunlit marimba | Bright, playful mallet hook with short percussion and major arpeggios | 108 BPM |
| `tide-and-bells` | Tide & bells | Light bell answers over airy major chords and a gentle pulse; no ominous drone | 84 BPM |

Each stem has both `.wav` and `.mp3` copies in `public/music-audition/`:

- WAV: stereo, 44,100 Hz, 16-bit PCM, exactly 1,323,000 frames / 30 seconds.
- MP3: stereo, 44,100 Hz, 192 kbps, actual decoded duration 30 seconds.
- Gentle 0.75-second entrance/exit fades. These are excerpts, **not final seamless loops**.
- Integrated loudness matched with ffmpeg's two-pass EBU R128 `loudnorm` measurement/normalization, target −19 LUFS. RMS alone was not treated as perceived loudness.

## Player behavior

English labels, native accessible audio controls, track-specific Play/Pause buttons, download links, and a global Pause all button. Starting any player pauses the other two, including when the native control is used. Nothing autoplays. Playback state is announced in a polite status region. No choice is persisted or applied to the game. If JavaScript is disabled, native controls/downloads remain usable, with an explicit instruction to pause tracks manually.

## Actual validation

`public/music-audition/metrics.json` contains sample-level WAV and decoded-MP3 measurements from the renderer. `browser-validation.json` contains real Chrome Web Audio decoding results for **all six files**, plus player and layout checks.

| Concept | WAV RMS | WAV sample peak | Integrated loudness | True peak | Decoded MP3 peak |
| --- | ---: | ---: | ---: | ---: | ---: |
| Coastal pulse | 0.093303 | 0.365143 | −18.99 LUFS | −8.72 dBTP | 0.334015 |
| Sunlit marimba | 0.087377 | 0.639191 | −19.00 LUFS | −3.89 dBTP | 0.619873 |
| Tide & bells | 0.086975 | 0.335693 | −19.00 LUFS | −9.27 dBTP | 0.325714 |

All three WAV files and all three MP3 decodes: finite, nonzero, stereo, 30 seconds, and no clipping. Chrome decoded all six files through `AudioContext.decodeAudioData`. Browser interaction verified keyboard Play, advancing playback time, exclusive playback, native-media play-event handling, Pause all, and no page errors. Desktop 1440px and mobile 390px layouts had no horizontal overflow and were screenshot-inspected. No claim of a subjective human listening review is made.

The existing `src/audio.js` was SHA-256 checked before and after this work; it remained byte-identical to the starting working-tree file (`61f95eac82bf583b7b8a9d65172729839e72e50cabff7448a21fb1c4c3fa4722`). It already had unrelated uncommitted changes when this task began; those were not reverted or altered.

## Re-render

```sh
# Use the active Python environment with working NumPy C extensions.
python scripts/render-music-auditions.py
```

Requires Python + NumPy and ffmpeg (libmp3lame + loudnorm). No network, music-generation service, sample pack, font, or audio download is used. The installed `python` executable works; the machine's system `python3` resolves to Python 3.9 and cannot load the active environment's Python 3.14 NumPy extension. Avoid that mismatched interpreter.

The renderer is deterministic: composition event arrays are fixed, percussion randomness is explicitly seeded, and all DSP is local. It writes only its output directory and does not load game source. To compare a regeneration without replacing audition files:

```sh
python scripts/render-music-auditions.py --output "$HOME/.hermes/cache/scratch/music-audition-rerender"
```

Implementation lesson: a scalar frequency needs a time ramp (`phase = 2πft`); `cumsum` of a scalar silently makes only one phase value. The renderer explicitly distinguishes fixed frequencies from vibrato arrays. Also measure **integrated loudness** and decode encoded outputs before claiming matched, playable previews.

## Files and license

Created only:

- `scripts/render-music-auditions.py`
- `docs/music-audition.md`
- `public/music-audition/index.html`
- `public/music-audition/{coastal-pulse,sunlit-marimba,tide-and-bells}.{wav,mp3}`
- `public/music-audition/metrics.json`
- `public/music-audition/browser-validation.json`
- `public/music-audition/LICENSE.txt`

Original compositions, synthesized timbres, source, page, and documentation are MIT-licensed via the included notice. No copyrighted recordings, external samples, artist imitations, or brand references were used. No current-score reference was fabricated; this pack includes only the three requested new concepts. No commit or push was made.
