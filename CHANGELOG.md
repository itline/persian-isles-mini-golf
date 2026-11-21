# Changelog

All notable changes to Persian Isles Mini Golf are documented here.

## Unreleased

## [0.1.2] — 2026-11-21

### Fixed

- Bound collision-event retention to the latest physics step instead of accumulating unused events across shots.
- Keep the Putt control's disabled state synchronized while paused without repeatedly rewriting unchanged status markup.

### Maintenance

- Reuse identical scene geometry and render-loop scratch vectors; avoid rebuilding unchanged camera projections and preview animation geometry.
- Extract shot-status, camera-framing and projection helpers; format the application entry point and remove superseded responsive declarations without redesigning the interface.
- Share the real-input browser-test shot helper and verify single-touch shooting after pinch zoom.
- Add separate gameplay/full web packaging with optional precompressed text assets. Audition sources and existing published release assets remain unchanged.
- Upgrade the official checkout and setup-node GitHub Actions to v7, using their Node 24 action runtime while retaining Node 24 for the project and the existing CI checks.

### Unchanged

- Credits, soundtrack, physical parameters, saved-score keys, playable content and visual quality settings.

## [0.1.1] — 2026-11-21

### Added

- Cargo, tanker and passenger silhouettes for the procedural distant fleet.
- Two island-specific distant vessels per menu scene, with shared geometry and deterministic motion.
- Regression coverage for intermediate tablet layouts at 1024×600 and 1024×768 across all five islands.

### Changed

- New slogan: “A little golf. A world away.”
- Three-item menu footer: Feedback, GitHub and About. External destinations open safely in a separate tab.
- Sound settings remain available through a separate accessible icon, with music/effects state announced in its label.
- Distant ships and rocks are distributed more widely around each island instead of clustering in one corner.
- Removed the menu-only View island toggle.

### Fixed

- Compact scenery placement now matches the menu panel's 1100px responsive breakpoint.
- Adjusted compact vessel anchors to keep the Hormuz boats visible on water at intermediate screen sizes.

### Unchanged

- Credits, soundtrack, gameplay physics, saved-score keys, stage count and the three playable Hormuz holes.
- Qeshm, Kish, Khark and Hengam remain visual previews, not playable courses.

## [0.1.0] — 2026-11-20

### Added

- Procedural Three.js mini-golf environments inspired by Iranian Persian Gulf islands.
- Three playable Hormuz holes: Red Shore, Salt Valley and Rainbow Run.
- Visual island previews for Qeshm, Kish, Khark and Hengam.
- Island-first menu with touch swipe navigation and responsive mobile layout.
- Real shot input through mouse, touch, keyboard and explicit aim/power controls.
- Smooth bounded camera zoom with wheel, pinch, `−`, `+` and reset controls.
- Local best-score persistence and three-hole Hormuz journey results.
- Procedural coastal audio with independent music and effects preferences.
- Sparse island-specific distant boats, lenj silhouettes and geographic rock details.
- Reduced-motion support, lazy audio unlock and development-only QA helpers.
- Downloadable 16:9 promotional covers and a separate brand icon/favicon set.

### Changed

- English-only release interface with a one-line game title and island-travel slogan.
- Existing soundtrack retained and mix buses raised for clearer playback.
- About copy updated with the game version while the Credits section remains intact.
- Sound settings no longer link to rejected music auditions.

### Verification

- Unit tests, browser tests, production build and production smoke checks pass in the release workspace.
- Audio output is verified with seeded Chrome `OfflineAudioContext` renders for finite samples, headroom and crossfade behavior.

[0.1.2]: https://github.com/itline/persian-isles-mini-golf/releases/tag/v0.1.2
[0.1.1]: https://github.com/itline/persian-isles-mini-golf/releases/tag/v0.1.1
[0.1.0]: https://github.com/itline/persian-isles-mini-golf/releases/tag/v0.1.0
