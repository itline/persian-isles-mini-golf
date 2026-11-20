# Changelog

All notable changes to Persian Isles Mini Golf are documented here.

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

[0.1.0]: https://github.com/itline/persian-isles-mini-golf/releases/tag/v0.1.0
