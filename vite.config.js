import { defineConfig } from 'vite';
import { rapierBuild, gameplayBuild } from './scripts/rapier-build.mjs';

export default defineConfig({ plugins: [rapierBuild(), gameplayBuild()] });
