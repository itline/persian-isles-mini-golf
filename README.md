# Persian Isles Golf — Hormuz slice

Working title. An original procedural, low-poly miniature-golf course inspired by Hormuz Island, Iran. This build contains one playable Par-4 course; Qeshm, Kish, Khark and Hengam are not implemented yet.

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
- Right-drag orbits the camera. Wheel / diamond button switches overview and tracking.
- Restart resets the hole. Best score persists locally on the same browser and origin.
- Audio is muted initially; the music-note button enables simple synthesized shot/completion tones. No music track is included.

Landscape is recommended on phones. Automated touch emulation is not a substitute for testing on a real phone.

## Verification

With Chrome installed and the dev server running:

```sh
npm test
npm run test:e2e
```

The browser suite includes a complete four-stroke round using real keyboard inputs, record persistence and retry, mouse drag, pointer cancellation, touch drag, viewport layout, pause/reset and touch hit targets. The `?qa` query exposes read-only game-state/projection helpers used by tests; tests do not teleport the ball or inject completion.

## Provenance

`src/vendor/` adapts four technical modules from [Mini Golf Mania](https://github.com/LCmaster/minigolf), commit `daae96188fe79eaba10b5e92045b45fc407d345c`, copyright 2023 Luiz Vicente, MIT. The upstream license is preserved in `LICENSE.upstream` and in the distributed third-party notices. The application customizes ball radius/mesh and physics configuration around those modules.

Three.js 0.155.0: MIT. Rapier compatibility build 0.11.2: Apache-2.0. Full runtime notices are included in `public/THIRD_PARTY_NOTICES.txt` and copied into `dist/` by Vite.

The environment, course geometry, interface and synthesized tones were created for this project. No external image, GLB model, music, or downloaded web font is used. The benchmark game's code and assets are not included. No blanket license for the original project files is granted by this README; upstream permissions remain as stated in their notices.

Nature reference: [NASA Earth Observatory — Iran’s Rainbow Island](https://science.nasa.gov/earth/earth-observatory/irans-rainbow-island-147428). The island is a playful interpretation, not geographic reconstruction or a real golf site.

## Known limits

- This is a local vertical slice, not the five-island release or an Arvan Edge deployment.
- No online leaderboard, multiplayer, account, daily challenge or authoritative server-side score validation.
- Browser tests exercise selected routes and inputs, not comprehensive physics correctness, accessibility certification or mobile GPU performance.
- The initial bundle includes the Rapier runtime/WASM and Three.js; Vite reports a large-chunk warning. Load-time and low-end-device optimization remain work for release.
- Visual quality and game feel still require player review before expanding to the other islands.
