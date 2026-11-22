# Mobile validation and shot-fairness follow-ups

## Contest-demo scope

This is an optional extended validation protocol, not a mandatory contest-release checklist. The owner-approved demo scope prioritizes loading, usable controls, readable layouts and a working nine-hole route. Physical-phone, new-player, thermal/battery and exact-refresh-rate studies remain unperformed follow-ups; do not claim certification or block the demo solely because these studies are unavailable. The local acceptance and evidence document is [release-readiness.md](release-readiness.md).

## Current candidate verdict

**Physical Android: NOT RUN. Physical iPhone Safari: NOT RUN. First-time-player study: NOT RUN. Final frozen-candidate full suites: NOT VERIFIED.**

Version **0.2.0** has exactly **nine playable Hormuz holes** and four preview-only islands: **Qeshm, Kish, Khark and Hengam**. No playable Qeshm module is included. This document is a validation protocol, not a physical-device compatibility claim.

Desktop Chrome viewport/touch emulation proves neither physical-device frame rate, heat, battery consumption nor iPhone Safari behavior. All nine holes and the complete nine-hole journey need final actual-input evidence. Prior three-hole results do not establish nine-hole acceptance or count as nine-hole journey records.

## Existing evidence and its limits

A read-only baseline audit recorded 27 focused unit tests and 20 selected browser tests, plus a guided, touch-only three-hole Hormuz route. That evidence belongs to an earlier dirty-tree snapshot at HEAD `4313f2b2581670faf0823d9715b1ba99610797e5`, captured `2026-11-22T13:37:25.579124+03:30`, not the final nine-hole candidate. It was run on an isolated Vite server at `127.0.0.1:4193`, using headless Chrome `157.0.8103.79` on macOS. It is a focused selection, not a green final full-suite run or an uncoached player outcome.

The audit found a pause-during-drag camera-freeze defect. Subsequent focused pause-recovery and mobile-follow regression checks passed together (5/5); a browser touch-cancel and next-shot regression also passed (1/1). These focused results still require rerunning against the frozen integrated candidate and testing real touch interruption on physical phones.

Historical raw evidence is in the local scratch directory:

`/Users/hasan/.hermes/cache/scratch/hormuz-mobile-audit-20261122/`

Relevant files include `report.md`, `snapshot-sha256.json`, `focused-unit.log`, `focused-e2e-summary.json`, `mobile-layout-e2e-summary.json`, `audit-probes.json`, `camera-freeze-probe.json` and `environment.json`. Scratch evidence may be pruned; preserve it in approved evidence storage before relying on it for a durable decision. Earlier partial results are not current source/build identity.

The baseline environment lacked `adb` and `idevice_id`; `xcrun xctrace list devices` exited 72 because `xctrace` was unavailable. No physical-device session or new-player session was available. Tool availability must be checked again when arranging real-device testing.

## Freeze and evidence setup

- [ ] Freeze the nine-hole candidate and record commit **plus dirty-tree/build hash**, URL, date/time, tester, device model, OS, browser version, GPU if exposed, viewport/orientation, device pixel ratio, display refresh rate and battery-saver state.
- [ ] Use an isolated source/build copy. Do not build or run against shared `dist/` while concurrent source edits continue. No deployment is authorized by this checklist.
- [ ] Obtain a **physical Android** running Chrome, including a representative lower/mid-range device. Record the actual model; do not infer performance from the macOS host.
- [ ] Obtain a **physical iPhone** running Safari, not desktop Safari, Playwright WebKit, device emulation or a simulator.
- [ ] Use repeatable course/input scenarios. Do not use QA state mutation, teleports, injected wins, changed physics or weakened assertions. Read-only QA observation is allowed only for instrumented runs, not uncoached player runs; production must not expose QA hooks.
- [ ] Record starting battery %, brightness, charging state, ambient temperature and device temperature/thermal state where measurable. Keep conditions comparable; separate subjective warmth from measurements.
- [ ] Archive screen recordings, console/network logs and profiler traces without credentials or personal data. A missing profiler is a measurement limitation, not a pass.

## Physical Android and iPhone Safari acceptance checklist

Complete independently on **each device**, in portrait and landscape. Record failures, retries and evidence handles; a second clean run does not erase a first failure.

### Scope, play and input

- [ ] Discover Play, practice selection, Help, pause, audio and camera controls without developer explanation.
- [ ] Verify exactly nine enabled Hormuz cards, numbered 1–9, with no future-hole slots. Switch through Qeshm, Kish, Khark and Hengam: each is explicitly preview-only, with no playable cards, journey or invited-hole action.
- [ ] Complete all nine Hormuz holes using actual finger drags; record strokes, missed releases, accidental shots, cup approaches, penalty recovery and result actions. Complete a full nine-hole journey separately from practice.
- [ ] Repeat short, medium and full-power strokes, near-dead-zone drags and off-center starts. Direction/power should follow the intended gesture without jumping when the camera settles.
- [ ] Pinch in/out, lift fingers in both orders, introduce a second finger during aim, then perform a normal drag: no pinch-generated stroke, stuck capture or broken next shot.
- [ ] Test OS notification/control panel, app switching, background/foreground, orientation during drag, finger leaving canvas, browser navigation and lost focus. No unintended stroke or permanently frozen camera/input; paused state and score remain coherent.
- [ ] Retest Pause-during-drag through reachable physical controls and any available external keyboard; Resume, zoom, overview and follow must work without a recovery gesture.
- [ ] Restart/retry resets the intended round; practice/next/finale/replay remain on Hormuz. Journey totals equal all nine displayed rows, with no incomplete journey recorded as complete.
- [ ] Continue/resume, reload and interruption preserve only valid nine-hole progress. Legacy three-hole journey records do not appear as completed nine-hole results; existing per-hole records remain usable.
- [ ] Back/leave cancellation preserves the round and focus; confirmed leave follows the documented progress behavior without deleting best scores.
- [ ] Share after a hole and a nine-hole journey; test native cancellation, clipboard fallback and failed-copy recovery. Hormuz invitations cover holes 1–9 and never start play/audio without a gesture; preview islands cannot invite playable holes.

### Safari and layout

- [ ] Safari dynamic address/tab bars expanded/collapsed, notch/home-indicator safe areas, rotation and return from background do not hide controls or cause horizontal overflow.
- [ ] All primary touch targets remain reachable and distinct, including pause/sound/zoom; no overlay intercepts aim or clips result buttons. Check compact landscape and large accessibility text/zoom settings.
- [ ] Follow keeps the ball readable on each of the nine layouts; overview reveals the full playable route. Camera movement stays frozen under an active aim. Returning from overview is discoverable.
- [ ] Audio unlock uses a real gesture; independent preferences persist and interruptions recover without blocking silent play. Record iPhone silent-mode behavior rather than assuming it.
- [ ] Check nine-hole results, continue/resume prompts, Help, audio, leave and share dialogs at small/tall portrait and short landscape sizes.

### Performance, heat and battery

- [ ] Use a fixed **15-minute** continuous play/preview session per device with the same route mix. Record frame-time samples/traces at start, midpoint and end, not just average FPS; distinguish display refresh rate, delivered FPS and simulation rate.
- [ ] Record p50/p95/p99 frame time and frames over the agreed budget; note input latency, long stalls and warm-device degradation. Establish a release budget before judging pass/fail; none is certified by the baseline audit.
- [ ] Record thermal state/temperature if exposed and subjective discomfort separately; log throttling, browser reload, WebGL loss, crash or memory warnings.
- [ ] Record starting/ending battery %, elapsed time, brightness, charging/battery-saver state and workload. Do not extrapolate a short or charging session into battery-life claims.
- [ ] Replay a known line cold/warm and under observed load. Check that stalls do not change shot outcomes or restoration timing unfairly; record trajectory/time-to-ready rather than inferring determinism visually.

## Shot-fairness review

Guided completion demonstrates an exercised route, not forgiving tolerances or discoverable power. Confirm these points against the final nine-hole source and frozen runtime:

- [ ] Visible fairway, walls, obstacles and cup approaches agree with collision geometry; decorative details do not imply nonexistent barriers or safe ground.
- [ ] New Hormuz holes 4–9 have distinct readable layouts and real-input solutions, not preview-island reskins or injected completions.
- [ ] Slow-frame conditions, near-dead-zone input, penalties, cup lip approaches and restoration timing remain fair on both physical devices.
- [ ] Players understand that the dotted aim guide indicates direction/power rather than a guaranteed stopping position or bounce prediction.
- [ ] Par and physics are not altered solely to make a scripted route pass. Record route guidance separately from uncoached observations.

## Uncoached first-time-player gate

Use actual new players, not the implementing agent or a tester given a route/power recipe. Suggested study: at least three first-time players, including one non-golfer, on physical phones. This is a proposed protocol, **not a completed study or an established statistical threshold**.

- [ ] Give only: “Play a journey.” No initial help about drag direction, power, pinch, overview or course solutions.
- [ ] Record time to first intentional shot, accidental shots, help usage, discovery of power/camera controls, attempts per hole, pauses, abandonments and quotes.
- [ ] Ask players what the dots/arrow mean before explaining them. Observe whether missed cups and wall bounces feel understandable.
- [ ] Check first-hole onboarding and finding the next action, then readability and progression across all nine Hormuz holes. Do not tune physics or par during the session to fit a known solution.
- [ ] Collect confusion/frustration, recovery from misses/penalties and intent to replay. Predeclare acceptance criteria with the owner; scripted completion is not a study pass.

## Signoff ledger

| Gate | Final nine-hole candidate status | Required evidence |
| --- | --- | --- |
| Frozen full unit/browser suites | NOT VERIFIED | Exact candidate identity, configured worker mode, complete results and unresolved failures |
| Nine-hole actual-input completion | NOT VERIFIED | All nine practice holes plus complete journey, input traces and scorecard |
| Production smoke and artifacts | NOT VERIFIED | Nine cards, four previews, real shot, QA isolation, external-request and notice checks |
| Pause/touch interruption recovery | RETEST REQUIRED | Focused earlier regressions are not final physical-device acceptance |
| Physical Android play/layout | NOT RUN | Device record, screen recording and failures |
| Physical iPhone Safari play/layout | NOT RUN | Device/OS/Safari record and safe-area/interruption evidence |
| Sustained performance/heat/battery | NOT RUN | Per-device timed session, traces and battery/thermal record |
| Uncoached first-time-player study | NOT RUN | Observations and predefined acceptance decision |
| Independent review/user-reported bugs | OPEN | Reviewed resolution of blocking findings |

Local candidate captures from `scripts/capture-candidate.js` show Hormuz holes 5 and 9 plus preview-only Qeshm at desktop and emulated mobile viewports. Captures are not proof of full-journey completion or physical-phone validation. Updated scripts require execution against the final frozen candidate; syntax checks alone do not satisfy runtime gates.

Do not mark mobile or player validation complete without the corresponding evidence. GitHub v0.2.0 publication was separately authorized; Edge-specific output remains excluded unless separately approved. See [validation scope](release-readiness.md).
