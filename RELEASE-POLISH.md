# Release-polish candidate

Local branch: `experiment/release-polish`. Baseline: tag `before-release-polish` at `ae004cda6f1a8242345ae3b9b105543ec2ce8b70`. Do not push or merge without fresh user permission. Preserve pending work when switching; do not use hard reset.

## Changes

- English-only UI; removed translation module, stored-language handling and RTL styles.
- Warm ivory menu rail, coral primary action, original compact SVG course outlines, no Par/Best in selection cards or live HUD; actual strokes remain visible while playing.
- Explicit + / − / Reset camera restored, smooth bounds 1–1.85, scroll/pinch preserved and camera frozen during aiming.
- Per-hole results include strokes, par, best, previous best and real new-best notice. Journey table includes all three scores/par/best; the sum of independent bests is not presented as a completed journey record.
- Individual deterministic scenery: Hormuz fishing boat and pennant, Qeshm tidal skiff, Kish palm crowns, Khark lighthouse flag/utility skiff, Hengam dolphin/dhow, plus water. Whole-island and playfield transforms remain stationary. Scenery freezes on pause/hidden tabs/reduced motion.
- Connected cup feedback and phase indication, guarded storage denial, English WebGL/audio failures, development-only read-only QA hook.
- Vite 8.3.8 and Vitest 5.1.1; runtime Three.js/Rapier unchanged. Tested with Node v26.7.0. Current npm registry audit reports zero advisories for full and runtime graphs.
- Complete lockfile license inventory, installed runtime license texts, minimal original SVG favicon.

## Verified

- `npm test`: 57 tests across 9 files passed. Removal of the old i18n suite explains the lower count than earlier bilingual builds; additional scene tests were added.
- `npm run build`: successful. Main JS 2,533.68 kB, gzip 879.53 kB at the verification checkpoint; large-chunk warning remains.
- `npm run test:e2e`: 23 passed, including actual-input 3-hole journey (scores 1, 2, 4; total 7, par 9), local persistence, touch, pinch, zoom safety and error resilience.
- Production smoke: five previews, real shot on hole 2, QA absent even with `?qa`, no page errors or external requests, both notice files HTTP 200.
- Offline audio sample render: finite nonzero samples, RMS 0.003145, peak 0.016643, no clipping.
- Desktop screenshots of all five islands and mobile portrait/landscape captured and inspected. Reframed menu camera contains foreground boat/rocks; footer readability and arrow hit areas improved.

## Remaining release gates

Real Android/iOS hardware touch and FPS/GPU measurements, subjective sound/playtesting and user acceptance remain unverified. Mobile emulation is not real-device certification. Portrait uses a scrollable bottom panel that partially covers scenery; View island reveals the whole diorama. Khark harbour geometry remains stylized and may benefit from further visual refinement. Lighthouse/shore props are decorative, not geographic accuracy claims.

No Arvan Edge deployment, online leaderboard or final naming/trademark clearance. Original-project licensing remains the owner's decision (see README); dependency metadata is not legal certification. Large Rapier/Three bundle remains an explicit load-time limitation rather than concealed by raising warning thresholds. No new islands or physical courses added.
