# Local visual experiment — not approved for GitHub push

Branch: `experiment/bilingual-visual-refresh`
Return point: tag `before-visual-refresh` → `f0c57b8f3b6ca40ab18168c431f44e51549accd5`.
The remote checkpoint predates the local opt-in-audio fix: `363bb2f`.

The user requires explicit permission before ANY future push. This experiment must remain local until that permission is given. Main is not merged with this experiment.

## Compare locally

- Experiment dev server: http://127.0.0.1:4181/
- Frozen pre-refresh build: http://127.0.0.1:4183/
- Frozen baseline files: `/Users/hasan/golf-rebuild/baseline-before-visual-refresh/`

The servers run for the current session. If needed, restart the baseline with:

```sh
python -m http.server 4183 --bind 127.0.0.1 --directory /Users/hasan/golf-rebuild/baseline-before-visual-refresh
```

## Restore without deleting the experiment

With a clean working tree, `git switch main` restores the pre-refresh local checkpoint. `git switch experiment/bilingual-visual-refresh` returns to the experiment. The tag preserves the exact return point even if main later changes.

Do not use `git reset --hard` for normal comparison or rollback. Commit or stash later uncommitted work before switching; never discard it automatically.

## Experiment scope

Working display name: Persian Isles Mini Golf (not a final trademark/name decision). Island-first menu, Hormuz first, readable stage cards and inactive states without LOCKED badges, English/Persian selection with saved preference and RTL, constrained scroll/pinch zoom with one overview control, contextual help, gentler result hierarchy and local records, subtle menu-only island motion with reduced-motion support. Physics and the three course layouts are unchanged.

Persian uses installed system fonts, not a downloaded asset. Baseline and experiment are different origins, so local records/preferences are separate in browser storage. Comparing them does not erase either origin's records.
