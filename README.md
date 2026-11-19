# Persian Isles Golf — Hormuz slice

Working title. An original procedural, low-poly miniature-golf course inspired by Hormuz Island, Iran. This build contains three playable Hormuz holes plus distinct locked 3D previews of Qeshm, Kish, Khark and Hengam. Hormuz shows ten slots: holes 1–3 are playable and 4–10 are explicitly in development. Completing Hormuz does not unlock unpublished islands.

## Run

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4181/ in a WebGL-capable browser.

```sh
npm run build
npm run preview
```

Serve the contents of `dist/` from a static HTTP host. Opening `dist/index.html` directly through `file://` is not supported. No Firebase configuration or account is required.

## Controls

- Mouse/touch: drag backwards on the scene, then release to putt. Longer drag means more power.
- Alternative: aim buttons + power slider + Putt.
- Keyboard: left/right arrows aim, up/down arrows adjust power, Space shoots, Escape pauses.
- Right-drag orbits within a bounded angle. Wheel, pinch, or +/− smoothly zoom between 1× and 1.85× around the ball. The full-course button resets zoom and orbit. Camera movement freezes during shot dragging; pinch never fires a shot.
- Restart resets the hole. Best score persists locally on the same browser and origin.
- Music and shot/completion effects default off independently. Open Sound settings and choose either channel; choices persist locally. Original gentle WebAudio pads, melody and filtered sea texture change by island and fade on island switches, pause and document visibility. No downloaded music or additional audio license is needed.
- Browse islands with tabs, arrows or a horizontal touch swipe on the scene. View island hides the menu for a clear scenery preview.
- Play Hormuz journey runs Red Shore (Par 2), Salt Valley (Par 3) and Rainbow Run (Par 4) in order; each is also directly selectable for practice. Journey results show all three scores and their sum. Restart retries the current hole; restarting from the final postcard restarts the journey.

Landscape is recommended on phones. Automated touch emulation is not a substitute for testing on a real phone.

## Verification

With Chrome installed and the dev server running:

```sh
npm test
npm run test:e2e
```

The browser suite completes all three holes and the full journey using real keyboard input, verifies per-hole record isolation/persistence and retry, locked islands/slots, lazy-loaded preview switching, mouse and touch drag, pointer cancellation, pinch/zoom limits, camera freeze during aim, mobile menu scrolling and HUD hit targets. The audio render probe `node scripts/verify-audio-render.js` checks actual offline-rendered WebAudio samples for nonzero finite output without clipping. The `?qa` query exposes read-only game-state/projection helpers used by tests; tests do not teleport the ball or inject completion.

## Provenance

`src/vendor/` adapts four technical modules from [Mini Golf Mania](https://github.com/LCmaster/minigolf), commit `daae96188fe79eaba10b5e92045b45fc407d345c`, copyright 2023 Luiz Vicente, MIT. The upstream license is preserved in `LICENSE.upstream` and in the distributed third-party notices. The application customizes ball radius/mesh and physics configuration around those modules.

Three.js 0.155.0: MIT. Rapier compatibility build 0.11.2: Apache-2.0. Full runtime notices are included in `public/THIRD_PARTY_NOTICES.txt` and copied into `dist/` by Vite.

The environment, course geometry, interface and synthesized tones were created for this project. No external image, GLB model, music, or downloaded web font is used. The benchmark game's code and assets are not included. No blanket license for the original project files is granted by this README; upstream permissions remain as stated in their notices.

Nature reference: [NASA Earth Observatory — Iran’s Rainbow Island](https://science.nasa.gov/earth/earth-observatory/irans-rainbow-island-147428). The island is a playful interpretation, not geographic reconstruction or a real golf site.

## Known limits

- This is a local first-version candidate with three playable holes on Hormuz. The other four islands and seven later Hormuz holes are locked, not gameplay-ready. It is not yet deployed to Arvan Edge.
- No online leaderboard, multiplayer, account, daily challenge or authoritative server-side score validation.
- Browser tests exercise selected routes and inputs, not comprehensive physics correctness, accessibility certification or mobile GPU performance.
- The initial bundle includes the Rapier runtime/WASM and Three.js; Vite reports a large-chunk warning. Load-time and low-end-device optimization remain work for release.
- The original Hormuz slice received player approval. The new stages, soundtrack and locked previews still require player review; actual mobile GPU performance and subjective audio quality have not been independently certified.
