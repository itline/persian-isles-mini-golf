# v0.2.1 corrective release validation

## Scope

The owner approved GitHub publication followed by a compact Edge upload artifact. This release changes mobile camera controls, footer alignment and island-navigation icons, and records the already tested delivery adapter and bounded link metadata. It does not add gameplay, change physics, remove music or edit Credits markup.

Exactly nine Hormuz holes are playable. Qeshm, Kish, Khark and Hengam remain previews. Existing local save keys are unchanged and remain origin-bound. Physical Android/iPhone devices, thermal behavior and exhaustive cross-refresh physics equivalence are not certified.

## Verification gates

- The default unit suite and production build must pass on the final frozen source.
- Run the complete browser suite serially, with no retries, and record the final result in the published release notes. Mobile all-nine-hole framing tests use real zoom taps rather than the removed Overview toggle; rotation retains the full-course endpoint.
- Independently review mobile control lifecycle, responsive layout and Edge delivery. Resolve blocking findings before publication.
- Scan the candidate, Git history and distributable artifacts with redacted secret output. Verify Credits markup exactly against v0.2.0 and preserve physics, audio, layouts and save modules.
- Exercise the extracted web ZIP and the compact worker using real browser input, production QA isolation and required notices. Check every non-HTML asset byte-for-byte, gzip/identity WASM decoding and bounded canonical/preview metadata.
- Follow branch → PR → required CI → merge → post-merge CI. Publish the exact verified commit and read back remote asset hashes. Previous releases and tags must remain unchanged.

## Verified local results

- 386 unit tests across 26 files passed; production build passed. The existing JavaScript chunk-size warning remains nonblocking.
- All 182 browser tests passed serially with one worker, zero retries, zero skipped tests and zero flaky results on the final runtime/test hashes.
- The three camera regressions were reproduced before repair and passed focused real-input browser tests afterward. Independent re-review approved the final fixes within source, projection and unit-test scope; it did not claim a separate browser run.
- Source candidate, Git history and release artifacts passed redacted secret scans. Production dependency audit reported zero vulnerabilities.
- Credits markup matches v0.2.0 exactly. Protected physics, audio, course-layout and save modules are unchanged.
- ZIP integrity, unique entries, manifest hashes and gzip/Brotli decoded equality passed. All 15 non-HTML worker assets match the production originals byte-for-byte; metadata for all nine holes and the share image passed.
- Extracted production smoke passed in Chrome and WebKit with real input, correct version, repeatable mobile controls and no production QA hook. Workerd passed metadata, WASM encodings and a real Chrome putt. These are local/emulated results, not physical-device certification.
- Compact worker: 1,918,785 bytes. SHA-256: `04cc8558afcd674013004ee3543dbe1918cc44478c6071b517ad6b1fcb1ee992`.

## Deployment boundary

The release includes a compact single-file worker for `https://mini-golf.hasan-xcqij.arvanedge.ir`. This is an upload artifact, not evidence that the hosted version has already changed. Confirm the hosted version, assets and mobile controls after the owner uploads it. Old tabs may need Refresh because compact mode does not retain previous hashed assets.

The earlier corrected v0.2.0 deployment on that origin was tested with gzip and identity WASM responses, preview image HTTP 200, correct-origin metadata and real browser shots in Chrome and WebKit. Those observations are not a v0.2.1 hosted acceptance claim.
