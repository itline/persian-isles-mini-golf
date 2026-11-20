# Contributing

Thanks for helping improve Persian Isles Mini Golf.

## Before opening an issue or pull request

1. Search existing issues and pull requests.
2. Explain the user-visible problem or proposed improvement.
3. Keep changes focused and avoid unrelated formatting churn.
4. Do not add credentials, private configuration, generated `dist/` files or `node_modules/`.
5. For visual changes, include before/after screenshots at desktop and mobile sizes when practical.

## Local setup

Requirements: Node.js `^22.12.0 || ^24.0.0 || >=26.0.0` and a WebGL-capable browser.

```sh
git clone https://github.com/itline/persian-isles-mini-golf.git
cd persian-isles-mini-golf
npm ci
npm run dev
```

Open `http://127.0.0.1:4181/`.

## Checks before submitting

Run the unit suite and production build:

```sh
npm test
npm run build
```

For browser tests, install the configured Chrome channel once, start the dev server in another terminal, then run:

```sh
npx playwright install chrome
npm run dev
npm run test:e2e -- --workers=1
```

Do not use QA helpers to teleport the ball or inject completion. Gameplay tests should use real inputs.

## Code and asset guidelines

- Prefer procedural/local assets and keep runtime requests offline.
- Preserve reduced-motion behavior, lazy audio unlock and responsive input handling.
- Keep physics and visual-only menu motion separate.
- Add or update tests with behavior changes.
- Keep third-party notices and license files with adapted code.
- Do not present the island environments as geographic reconstructions.

## Pull requests

Use a clear title and describe:

- What changed and why.
- How it was tested.
- Any remaining limitation or known visual/device issue.

By contributing, you agree that your contribution may be distributed under the repository's applicable license. This is not a transfer of the project's protected brand identity; see [BRANDING.md](BRANDING.md).
