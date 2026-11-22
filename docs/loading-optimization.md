# Bounded initial-download optimization

## Pinned build integration

The production build uses the installed `@dimforge/rapier3d-compat` **0.11.2** file, retaining its generated glue, high-level wrappers and exports. `scripts/rapier-build.mjs` replaces only the unique embedded-binary expression with Vite's emitted-asset URL expression in memory. It neither vendors a dependency nor modifies `node_modules`. Development keeps the original compat runtime.

The build fails closed unless all these hold:

- Package version is exactly `0.11.2`.
- `rapier.es.js` SHA-256 is `9f8ba0f4fca4b7f8993e293466db484eef1874ae6f0cec23f6d2cc06aa96c275`.
- There is exactly one supported embedded binary expression.
- Its decoded bytes equal the installed WASM, whose SHA-256 is `425749aa8b9c239ffd1958ac5c9c1184590278b53c1c676c7509a1511bc8b7d2`.

This is a deliberately version-specific source transformation, not a generic Rapier adapter. An upstream upgrade must re-audit the expression, source hash, binary and runtime tests; never simply relax the assertions. The existing initializer already supports fetching a URL and using streaming instantiation. Vite owns hashed asset naming and base handling. Focused tests cover nested absolute and relative bases.

`gameplayBuild()` turns off Vite's unfiltered public copy and emits the existing public files except the top-level `music-audition` tree. The original audition files remain in `public/`. All eleven other public files, including notices, license texts, font license and provenance, remain byte-identical. Audio synthesis in application source is unchanged. Audition removal is package-size reduction, not gameplay-request reduction.

## Verification on frozen source

Evidence root: `/Users/hasan/.hermes/cache/scratch/golf-loading-1795359264234154000/`.

- RED: `red-transport.log` initially failed for missing implementation; `red-integration.log` failed for missing build integration.
- Isolated optimization GREEN: `unit-tests-final.log`: **24 test files, 378 tests passed**, including six new focused tests. This is the isolated optimization snapshot, not the later combined controls candidate.
- Tests enforce version/source/binary guards, duplicate/missing embedded expressions, useful missing-dependency diagnostics, emitted byte equality, asset paths, audition exclusion without source deletion, notice preservation, equal runtime exports/version, and identical sampled 240-step physics trajectories.
- `config-build.log`: real `npm run build -- --outDir ../dist-config` succeeded; output matches the measured candidate build byte-for-byte.
- `builds.log`, `build-sizes.json`: unchanged baseline and plugin candidate built with the same source, no source maps and default Vite minification.
- `browser-evidence.json`, `browser.log`: baseline and candidate each passed a genuine first keyboard shot followed by settling in installed Chrome **157.0.8103.79** and Playwright WebKit **27.2**. No page errors. Screenshots: `{baseline,candidate}-{chrome,webkit}-first-shot.png`.
- `integrity.json`: frozen existing source and dependency hashes unchanged; build/public preservation checks.

## Measured sizes (bytes)

The runtime sums include **all emitted JS plus external WASM**, including the optional island-preview chunk. gzip uses level 9; Brotli uses quality 11.

| Measure | Baseline | Candidate | Reduction |
|---|---:|---:|---:|
| Runtime raw | 2,575,201 | 2,104,278 | 18.29% |
| Runtime gzip9 | 884,960 | 681,126 | 23.03% |
| Runtime Brotli11 | 671,761 | 522,475 | 22.22% |
| Entire output raw | 20,749,865 | 2,220,066 | Includes audition exclusion |

The excluded audition tree is **18,058,876 bytes**. The emitted exact WASM is **1,409,209 bytes**. Smaller JS alone is not the claimed total saving.

## Cold startup experiment

Three paired Chrome samples per variant, fresh browser contexts, cache disabled, 390×844 viewport, simulated 100 ms RTT, 200,000 bytes/s each way, 4× CPU slowdown. Readiness means the existing Play button becomes enabled, measured using `performance.now()`; it includes polling latency, not a new instrumentation mark. Order alternates by pair. Servers were distinct loopback ports 4431 and 4433 with identical compression settings and no-store caching. Responses were recorded, not inferred from offline sizes.

| Sample | Baseline ready ms | Candidate ready ms |
|---|---:|---:|
| 1 | 5023.3 | 4324.0 |
| 2 | 4965.5 | 4424.1 |
| 3 | 4968.1 | 4269.4 |
| Median | 4968.1 | 4324.0 |

The candidate median was **13.0% lower in this local simulation**. This is a small experiment, not a significance test or real-device/hosting guarantee.

Actual Chrome initial entry JS: baseline **666,269 B Brotli**; candidate JS **143,679 B Brotli** plus WASM **373,302 B Brotli**. Actual WebKit first-shot responses used **gzip**: baseline JS **875,773 B**; candidate JS **173,262 B** plus WASM **504,718 B**. Unlike an uncompressed WASM server, both negotiated compressed WASM correctly. Other requested CSS/fonts/icons are recorded in the evidence. No WebKit mobile-throttled result is claimed: CDP CPU/network throttling is Chrome-only.

## Deployment requirements and limits

Serve the emitted `.wasm` as `application/wasm`, preserve its asset URL, and enable gzip/Brotli for **WASM as well as JS**. Check the real host's response encoding before claiming these transfer/startup savings. The binary adds a fetch after JS loads; raw/uncompressed hosting has not been benchmarked. Root-base browser smoke and nested/relative-base build-path tests are distinct gates; nested-base browser hosting and physical devices were not exercised here.

No level/physics/gameplay/Credits/audio source changed. No CI, deploy, Edge output, dependency upgrade, commit or external upload. Build warnings still identify a >500 kB JS chunk; this bounded patch does not address all bundle size. Servers and browsers were closed after measurement.

## Reproduce

From the project with installed dependencies:

```sh
npm test
npm run build
```

The one-off measurement scripts remain in the evidence root's `source/scripts/build-loading-{evidence,server,browser}.mjs`, not the game repository. They write to the parent of their working directory and use ports 4431/4433; run them only in that dedicated scratch copy with those ports free. A baseline build is `configFile: false` with no plugins; the candidate uses exactly the two production plugins.

## Combined local candidate

The later combined controls/build candidate passed **381 unit tests in 25 files**. Independent compression of identical-current-source baseline versus the extracted candidate measured all emitted JS/WASM at **885,149 → 681,312 bytes gzip9** and **672,240 → 522,641 bytes Brotli11**. Entire uncompressed build size changed from **20,750,560 → 2,220,761 bytes**, including audition exclusion. All eleven non-audition public files matched the originals byte-for-byte.

Extracted-package Chrome/Pixel 7 and WebKit/iPhone 13 emulation each completed the first hole with real keyboard input, advanced to hole 2, kept Pause keyboard focus contained and exposed no production QA hooks or page errors. WASM returned HTTP 200 with the correct MIME and Brotli/gzip respectively. A deliberately failed WASM fetch showed the existing visible load error and disabled Play. These are local smoke checks, not physical-device certification. Evidence: `golf-contest-polish/production-browsers.json`, `production-smoke.json` and `final-sizes.json` under the configured scratch directory.
