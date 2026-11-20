import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

// Compare real Chrome OfflineAudioContext renders, never inferred gain-only metrics.
// --before accepts a preserved pre-edit audio.js. Without it, reconstruct the old
// two bus targets only, asserting that both expected replacements were available.
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const afterSource = await readFile(new URL('../src/audio.js', import.meta.url), 'utf8');
const beforePath = option('--before');
const beforeSource = beforePath ? await readFile(resolve(beforePath), 'utf8') : afterSource
  .replace('ramp(bus.gain, 0.55, 0.55)', 'ramp(bus.gain, 0.22, 0.55)')
  .replace('!hidden ? 0.60 : 0, 0.08)', '!hidden ? 0.24 : 0, 0.08)');
assert.ok(beforeSource.includes('ramp(bus.gain, 0.22, 0.55)'), 'baseline must contain original music gain');
assert.ok(beforeSource.includes('!hidden ? 0.24 : 0, 0.08)'), 'baseline must contain original effects gain');
const normalize = source => source.replace(/^\s*\/\/.*$/gm, '').replace(/\s+/g, '');
assert.equal(normalize(beforeSource
  .replace('ramp(bus.gain, 0.22, 0.55)', 'ramp(bus.gain, 0.55, 0.55)')
  .replace('!hidden ? 0.24 : 0, 0.08)', '!hidden ? 0.60 : 0, 0.08)')), normalize(afterSource),
'only the two bus gains may change: no score, timbre, timing or lifecycle edits');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  // No app, autoplay or QA-hook dependency: render the actual module in Chrome.
  await page.goto('about:blank');
  const result = await page.evaluate(async ({ beforeSource, afterSource }) => {
    const load = source => import(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
    const before = await load(beforeSource);
    const after = await load(afterSource);
    const rate = 44100;
    const tick = 0.08;
    const islands = ['hormuz', 'qeshm', 'kish', 'khark', 'hengam'];
    const scenarios = islands.flatMap(island => [
      { name: `${island}-music`, island, seconds: 32, music: true, effects: false },
      { name: `${island}-music-effects`, island, seconds: 32, music: true, effects: true },
    ]).concat([
      { name: 'effects-only', seconds: 4, music: false, effects: true },
      { name: 'effects-12-voice-headroom', seconds: 4, music: true, effects: true, stress: true },
      { name: 'all-island-crossfades-effects', seconds: 27, music: true, effects: true, crossfade: true },
    ]);
    const measure = (samples, start = 0, end = samples.length) => {
      let sum = 0, peak = 0, nonFinite = 0, clippedSamples = 0;
      for (let i = start; i < end; i += 1) {
        const sample = samples[i];
        if (!Number.isFinite(sample)) nonFinite += 1;
        sum += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
        if (Math.abs(sample) >= 1) clippedSamples += 1;
      }
      const rms = Math.sqrt(sum / (end - start));
      return { peak, rms, peakDbfs: 20 * Math.log10(peak), rmsDbfs: 20 * Math.log10(rms), nonFinite, clippedSamples };
    };
    const render = async (module, scenario) => {
      const offline = new OfflineAudioContext(2, rate * scenario.seconds, rate);
      const original = { setTimeout, clearTimeout, setInterval, clearInterval, random: Math.random };
      const timers = new Map();
      let nextId = 0, now = 0, seed = 0x5eed1234;
      const addTimer = (callback, ms, repeat) => {
        const id = ++nextId;
        timers.set(id, { callback, due: now + ms / 1000, interval: repeat ? ms / 1000 : 0 });
        return id;
      };
      globalThis.setInterval = (callback, ms) => addTimer(callback, ms, true);
      globalThis.setTimeout = (callback, ms) => addTimer(callback, ms, false);
      globalThis.clearInterval = globalThis.clearTimeout = id => timers.delete(id);
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
      class Context {
        constructor() {
          return new Proxy(offline, { get(target, key) {
            if (key === 'state') return 'running';
            if (key === 'close') return () => Promise.resolve();
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
          } });
        }
      }
      const storage = { getItem: () => JSON.stringify({ music: scenario.music, effects: scenario.effects }), setItem() {} };
      const audio = module.createCoastalAudio({ storage, AudioContextClass: Context });
      try {
        audio.setIsland(scenario.island || 'hormuz');
        await audio.unlock();
        let effectIndex = 0, islandIndex = 0, stressPlayed = false;
        let suspension = offline.suspend(tick);
        const rendering = offline.startRendering();
        // Integer ticks avoid a floating-point suspension just below the buffer
        // end, which Chrome rounds beyond its final quantum and never resolves.
        for (let step = 1; step < Math.ceil(scenario.seconds / tick); step += 1) {
          await suspension;
          now = offline.currentTime;
          // Pump the existing scheduler and retire/dispose callbacks at audio-clock
          // ticks; pre-scheduling only the first chord would under-test the score.
          for (const [id, timer] of [...timers]) {
            if (timer.due > now + 1e-8) continue;
            if (timer.interval) timer.due = now + timer.interval;
            else timers.delete(id);
            timer.callback();
          }
          if (scenario.crossfade && now >= (islandIndex + 1) * 5 && islandIndex < islands.length - 1) {
            islandIndex += 1; audio.setIsland(islands[islandIndex]);
          }
          if (scenario.effects && !scenario.stress && now >= 0.32 + effectIndex * 1.6) {
            const frequencies = [440, 660, 880];
            audio.effect(frequencies[effectIndex % frequencies.length], 0.15);
            effectIndex += 1;
          }
          if (scenario.stress && !stressPlayed && now >= 1) {
            for (let voice = 0; voice < 12; voice += 1) audio.effect(440, 1);
            stressPlayed = true;
          }
          const next = (step + 1) * tick;
          if (next < scenario.seconds) suspension = offline.suspend(next);
          await offline.resume();
        }
        const buffer = await rendering;
        const samples = buffer.getChannelData(0).slice();
        let stereoMaxDifference = 0;
        const right = buffer.getChannelData(1);
        for (let i = 0; i < samples.length; i += 1) stereoMaxDifference = Math.max(stereoMaxDifference, Math.abs(samples[i] - right[i]));
        const windows = [];
        for (let start = 0; start < scenario.seconds; start += 4) {
          windows.push({ fromSeconds: start, toSeconds: Math.min(start + 4, scenario.seconds),
            ...measure(samples, start * rate, Math.min((start + 4) * rate, samples.length)) });
        }
        return { samples, metrics: { ...measure(samples), samples: samples.length, stereoMaxDifference, windows } };
      } finally {
        audio.dispose();
        Object.assign(globalThis, { setTimeout: original.setTimeout, clearTimeout: original.clearTimeout,
          setInterval: original.setInterval, clearInterval: original.clearInterval });
        Math.random = original.random;
      }
    };
    const results = [];
    for (const scenario of scenarios) {
      const old = await render(before, scenario);
      const current = await render(after, scenario);
      let maxScaledSampleError = 0;
      for (let i = 0; i < old.samples.length; i += 1) {
        maxScaledSampleError = Math.max(maxScaledSampleError, Math.abs(current.samples[i] - old.samples[i] * 2.5));
      }
      results.push({ ...scenario, before: old.metrics, after: current.metrics,
        rmsGainDb: 20 * Math.log10(current.metrics.rms / old.metrics.rms),
        peakGainDb: 20 * Math.log10(current.metrics.peak / old.metrics.peak), maxScaledSampleError });
    }
    return { sampleRate: rate, channels: 2, seed: '0x5eed1234', schedulerTickSeconds: tick, scenarios: results };
  }, { beforeSource, afterSource });
  for (const scenario of result.scenarios) {
    for (const version of ['before', 'after']) {
      const metrics = scenario[version];
      assert.equal(metrics.nonFinite, 0, `${scenario.name}: finite ${version}`);
      assert.equal(metrics.clippedSamples, 0, `${scenario.name}: no clipping ${version}`);
      assert.ok(metrics.peak < 1 && metrics.rms > 0.00001, `${scenario.name}: nonzero signal and headroom ${version}`);
      assert.equal(metrics.stereoMaxDifference, 0, `${scenario.name}: both output channels agree`);
      for (const window of metrics.windows) assert.ok(window.rms > 0.00001, `${scenario.name}: no scheduler dropout at ${window.fromSeconds}s`);
    }
    assert.ok(Math.abs(scenario.rmsGainDb - 20 * Math.log10(2.5)) < 0.0001, `${scenario.name}: expected gain`);
    assert.ok(scenario.maxScaledSampleError < 0.000001, `${scenario.name}: unchanged waveform except gain`);
  }
  const evidence = {
    method: 'Actual deterministic Chrome OfflineAudioContext render; original module scheduler driven by audio-clock suspension ticks. No listening review claimed.',
    baseline: beforePath ? 'Preserved pre-edit source snapshot' : 'Current source with only the two original bus targets restored',
    sourceSha256: { before: createHash('sha256').update(beforeSource).digest('hex'), after: createHash('sha256').update(afterSource).digest('hex') },
    gain: { multiplier: 2.5, decibels: 20 * Math.log10(2.5), masterUnchanged: 0.65, music: { before: 0.22, after: 0.55 }, effects: { before: 0.24, after: 0.6 } },
    ...result,
  };
  const output = option('--output');
  if (output) { await mkdir(dirname(resolve(output)), { recursive: true }); await writeFile(resolve(output), `${JSON.stringify(evidence, null, 2)}\n`); }
  console.log(JSON.stringify({ verifiedScenarios: result.scenarios.length, gainDb: evidence.gain.decibels,
    maximumAfterPeak: Math.max(...result.scenarios.map(scenario => scenario.after.peak)),
    scenarios: result.scenarios.map(({ name, before, after, rmsGainDb, maxScaledSampleError }) => ({ name,
      before: { peak: before.peak, rms: before.rms }, after: { peak: after.peak, rms: after.rms }, rmsGainDb, maxScaledSampleError })), output: output || null }, null, 2));
} finally {
  await browser.close();
}
