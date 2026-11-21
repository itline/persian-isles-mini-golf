import { defineConfig } from '@playwright/test';

// Opt in only on the Linux CI runner; local Chrome keeps its normal backend.
const mesa = process.platform === 'linux' && process.env.GOLF_CI_MESA === '1';

export default defineConfig({
  testDir: './e2e',
  use: {
    channel: 'chrome',
    headless: !mesa,
    viewport: { width: 1440, height: 900 },
    ...(mesa ? { launchOptions: { args: [
      '--ozone-platform=x11',
      '--use-gl=angle',
      '--use-angle=gl',
      '--ignore-gpu-blocklist',
    ] } } : {}),
  },
  timeout: 30000,
  reporter: 'list',
});
