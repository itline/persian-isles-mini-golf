# Changelog

All notable changes to Persian Isles Mini Golf are documented here.

## [0.2.0] — 2026-11-22

### Added

- Six additional Hormuz layouts, for exactly nine playable holes and one nine-hole journey with practice, results, replay and local records.
- Continue a journey from its next tee using locally saved completed-hole scores; interrupted holes restart from their tee, while practice scores do not replace journey progress.
- Same-course invitation links and self-reported result sharing, with native sharing, clipboard and selectable-text fallbacks.
- Local Source Sans 3 interface font, bundled with license and provenance; Credits typography remains outside its scope.
- Reproducible local startup, resource, frame-interval and DOM-mutation measurement tooling.

### Changed

- Externalize the byte-identical pinned Rapier 0.11.2 WASM through a guarded build transform, reducing encoded runtime size without changing the physics engine or development runtime.
- Exclude the unused music-audition tree from production builds while preserving original audition files, gameplay audio and required notices.
- Close ball-follow framing on phones with explicit Overview/Return to ball controls; aiming keeps the camera steady.
- Direct Sound and Pause controls replace the overlapping Home/tool menu; Restart and Back to the coast live inside Pause.
- Island, hole, strokes and par now share one compact round-information card.
- How to play is accessible from the footer; the help dialog and first-putt hint are retained.

### Fixed

- Stale game history after reload/Forward no longer creates a duplicate menu entry or restores a lost round.
- Finalize drag power and direction from the owning pointer's release position; unrelated pointers and lost capture cannot fire a stale putt.
- Preserve a held drag started before the ball becomes ready when released after readiness; releasing while rolling never queues a second shot. Holing during a held gesture releases pointer capture and camera freeze.
- Keep keyboard navigation inside open dialogs and focus the next hole after a journey result; practice retains replay as its primary action.
- Returning to the coast keeps the selected island; Qeshm, Kish, Khark and Hengam remain preview-only scenes, with no playable Qeshm module.
- Legacy three-hole journey records do not count as completed nine-hole journeys; existing Hormuz per-hole records remain separate.
- The first-putt hint no longer covers the ball on short portrait touch screens.
- Pausing during a held aiming drag now releases the camera freeze, so zoom works after Resume without a recovery gesture.
- Pause or window blur cancels active pinch gestures instead of allowing zoom behind a dialog.
- Persist the nine-hole journey best immediately when the final putt is holed, before opening the postcard; failed storage writes retain the last usable checkpoint.
- Nine numbered practice cards replace shared future slots; wrapped phone labels no longer clip course thumbnails.
- Pointer-cancellation regression testing uses a real browser touch sequence, checks page errors, and proves that the next drag can still shoot.

### Release status

- This contest-demo release prioritizes reliable loading, usable controls, readable layouts and completing the nine-hole journey. Physical-device/first-time-player studies, broad refactoring and exact cross-refresh-rate equivalence remain follow-ups, not certification claims.
- GitHub publication was authorized for this release. No Edge capability, Edge-specific output or new Arvan deployment is included; Edge output requires separate user approval.

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
[0.2.0]: https://github.com/itline/persian-isles-mini-golf/releases/tag/v0.2.0
[0.1.1]: https://github.com/itline/persian-isles-mini-golf/releases/tag/v0.1.1
[0.1.0]: https://github.com/itline/persian-isles-mini-golf/releases/tag/v0.1.0
