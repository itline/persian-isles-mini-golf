# Local candidate — acceptance gates

This document records the bounded validation of **v0.2.0**, a nine-hole contest demo. It is not a physical-device or production-service certification. GitHub release preparation/publication was authorized on 2026-11-22; Edge output and deployment remain separately gated.

## Candidate scope

- Shared mobile/desktop browser runtime; no native rewrite.
- Exactly **nine playable Hormuz holes**, numbered 1–9, including six additional Hormuz layouts.
- **Qeshm, Kish, Khark and Hengam are visual previews only.** No playable Qeshm module or preview-island journey is included.
- Hormuz practice, nine-hole journey, results, replay and local records; continue/resume must retain valid progress without awarding incomplete journey records.
- Existing Hormuz per-hole records remain separate from nine-hole journey records. A legacy three-hole journey best must not appear as a completed nine-hole result.
- Simple self-reported local result sharing and Hormuz invitation links for holes 1–9; no backend, account or public leaderboard.
- Preserve Credits, required notices, audio preferences and the approved mobile ball-follow camera.

## Contest-demo acceptance scope

This is a small contest demo, not a production service. Prioritize reliable loading, usable controls, readable layouts and completing the approved journey. Use bounded unit/browser regression checks and smoke-test the actual local production package. Exact cross-refresh-rate settlement, broad architecture cleanup, a new CI/release system, exhaustive device certification and sustained thermal/battery studies are deferred; they are not contest-demo release prerequisites. Physical-device and uncoached-player checks remain useful, explicitly unperformed follow-ups, not automatic blockers. Do not weaken tests or claim unperformed validation.

Publication still requires the owner's explicit approval; this scope does not authorize GitHub or Edge activity.

## Evidence inventory

Checked boxes describe observed local evidence only. Unchecked broad validation items below remain optional follow-ups unless a visible ordinary-play defect makes them necessary.

- [x] Freeze the source and identify the exact base commit plus dirty-tree/build hashes. The local verification manifest records the unpublished source and build; all final runtime hashes matched the tested snapshot.
- [ ] Physical Android/Chrome test with recorded model/browser/OS, portrait and landscape, actual touch input and complete nine-hole journey.
- [ ] Physical iPhone/Safari test with the same evidence; browser emulation is not equivalent.
- [ ] Observe a first-time player completing the first hole and finding the next action without coaching; record friction and assistance, not just preference.
- [ ] Real-device frame pacing and sustained-play heat/battery observations; desktop localhost measurements do not establish mobile performance.
- [x] Bounded cold-start comparison: three alternating paired Chrome samples, 100 ms RTT, 200,000 bytes/s, 4× CPU slowdown; menu-ready median 4,968 → 4,324 ms on the isolated optimization snapshot. Not field or real-phone performance. See loading-optimization.md.
- [x] Actual-input completion of all nine Hormuz holes and the full nine-hole journey; no teleports, injected completion or physics changes to force a pass. The frozen keyboard journey also passed final scorecard, aggregate persistence before opening results, isolated legacy keys and replay assertions.
- [x] Practice/finale/next/replay/back stay on Hormuz; preview islands cannot start a round. Continue/resume, reload and interrupted journeys preserve valid progress without saving incomplete records.
- [x] Legacy three-hole journey data does not count as a nine-hole result; existing per-hole scores remain usable.
- [x] Share/native-share cancellation, clipboard fallback and failed-copy recovery; Hormuz invitations accept holes 1–9 and do not automatically start audio or a round. Preview-only islands have no playable invitations.
- [ ] Small portrait, tall portrait, short landscape and desktop layouts, including results and dialogs.
- [ ] Frozen-source full unit and browser suites in the configured worker mode, with failures/skips/retries reported explicitly.
- [x] Production smoke on the exact frozen candidate: exactly nine enabled Hormuz cards numbered 1–9; all four other islands preview-only; actual keyboard shot; no exposed QA hooks, page errors or external runtime requests; required notices present.
- [x] Combined-candidate generic local ZIP extracted byte-identically and smoke-tested: genuine first-hole completion, next step/checkpoint, practice and preview scope, absent production QA, no page errors/external requests, notices HTTP 200. Chrome/Pixel 7 and WebKit/iPhone 13 emulation passed; missing WASM showed the existing load error. No Edge-specific package or deployment was created.
- [ ] Independent code-quality/security review, all blocking findings and user-reported bugs resolved and reviewed.
- [ ] Full candidate/history/archive secrets scan with redacted output and dependency audit.
- [ ] Version metadata, changelog, README, release notes and screenshots describe the same tested candidate accurately. Candidate captures show Hormuz gameplay and preview-only Qeshm, not a released build or physical-phone validation.

## Local verification tools

- `GOLF_URL=http://127.0.0.1:4182/ node scripts/verify-production.js`: smoke against an already served isolated production build. It does not build, complete a journey or certify real devices.
- `GOLF_URL=http://127.0.0.1:4182/ OUTPUT=/path/to/candidate-captures node scripts/capture-candidate.js`: local desktop/emulated-mobile captures of Hormuz holes 5 and 9 plus the Qeshm preview. It does not build or publish.
- The production smoke was executed against an isolated local build: nine enabled Hormuz cards, four preview-only islands, an actual keyboard shot, absent production QA hooks, no page errors or external runtime requests, and HTTP 200 notices. Extracted-archive acceptance remains separate.

## Latest bounded local evidence

- The combined controls candidate completed all nine holes again using genuine keyboard input on a frozen development server: scorecard, best-before-postcard persistence, isolated legacy records and replay passed, with zero retries. This is a single full-journey test, not a new full-browser-suite run. The production package has separate first-hole/next-step smoke coverage.
- Independent bounded reviews of the controls and pinned build integration found no actionable security or logic defects; reviewed hashes matched the current files. These reviews do not claim an exhaustive project audit.

- The combined contest-polish candidate passed **381 unit tests in 25 files** and build. Focused Chrome control/navigation checks and three WebKit dialog/result tests passed; these are bounded tests, not a new full-browser-suite claim. Credits, levels, save modules, audio and physics source are unchanged from the preceding nine-hole candidate.
- Exact-current-source build comparison: all JS/WASM totals **885,149 → 681,312 bytes gzip9**, **672,240 → 522,641 bytes Brotli11**. All eleven non-audition public files were preserved byte-identically; audition originals remain in public. The external WASM needs correct MIME and compression on any eventual host. Package secrets scan found no leaks.
- The default unit command passed 372 tests across 23 files; build, readiness HTTP 200 and diff checks passed. The production bundle-size warning remains.
- Independent review of the completed-journey persistence fix found no actionable issues in its bounded scope. It verified save-before-clear ordering, retained recovery after failed writes, malformed/sparse score rejection, previous-best display and retry/replay lifecycle; 18 targeted unit tests passed.
- The final frozen browser suite passed **162 tests**, with **zero failures, skips or flaky results**, using **one worker**. Source and test files matched the final workspace. This is a serial browser-suite result, not a default-parallel browser run or physical-device certification.
- Local evidence is retained in `golf-nine-final-clean.log`, `golf-nine-final-clean-results/` and `golf-nine-final-verification.json` under the configured scratch directory. The manifest includes base commit, source hashes, build hashes and browser statistics. Credits markup remains identical to the base revision.

## Publication boundaries

The owner explicitly authorized the v0.2.0 GitHub release after accepting the local contest-demo work. Use the protected branch → PR → checks → merge route, verify post-merge CI and read back the published release and downloaded checksums. This authorization does not cover Edge output or deployment.

Physical-device and first-time-player evidence is not yet available and must not be claimed. Under the owner-approved contest-demo scope it is a follow-up, not an automatic publication blocker. Daily Challenge/backend/Edge capability is excluded. No Edge-specific output, Arvan packaging or deployment may be generated or published without separate user approval.
