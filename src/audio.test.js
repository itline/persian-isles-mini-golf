import { describe, it, expect, vi, afterEach } from 'vitest';
import { audioPreferences, writeAudioPreferences } from './audio.js';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

const memoryStorage = (initial = {}) => {
  const entries = new Map(Object.entries(initial));
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), entries };
};

class Param {
  value = 0;
  events = [];
  setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
  linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]); }
  exponentialRampToValueAtTime(value, time) { this.value = value; this.events.push(['exponential', value, time]); }
  cancelScheduledValues(time) { this.events.push(['cancel', time]); }
  cancelAndHoldAtTime(time) { this.events.push(['hold', time]); }
  setTargetAtTime(value, time, constant) { this.value = value; this.events.push(['target', value, time, constant]); }
}
class FakeNode {
  constructor(kind, context) {
    this.kind = kind;
    this.context = context;
    this.gain = new Param(); this.frequency = new Param(); this.Q = new Param(); this.pan = new Param();
    this.connections = []; this.starts = []; this.stops = [];
    context.nodes.push(this);
  }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.disconnected = true; }
  start(time = 0) { this.starts.push(time); }
  stop(time = 0) { this.stops.push(time); }
}
class FakeContext {
  static instances = [];
  constructor() {
    this.nodes = []; this.buffers = []; this.currentTime = 0; this.state = 'suspended'; this.sampleRate = 8000;
    this.destination = new FakeNode('destination', this);
    FakeContext.instances.push(this);
  }
  createGain() { return new FakeNode('gain', this); }
  createOscillator() { return new FakeNode('oscillator', this); }
  createBiquadFilter() { return new FakeNode('filter', this); }
  createBufferSource() { return new FakeNode('bufferSource', this); }
  createStereoPanner() { return new FakeNode('panner', this); }
  createBuffer(channels, length, rate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    const buffer = { length, sampleRate: rate, numberOfChannels: channels, getChannelData: index => data[index] };
    this.buffers.push(buffer); return buffer;
  }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
}

describe('procedural music lifecycle', () => {
  it('raises existing music and effects buses by 2.5x without changing master headroom or fade times', async () => {
    vi.useFakeTimers();
    const { createCoastalAudio } = await import('./audio.js');
    const audio = createCoastalAudio({ storage: memoryStorage(), AudioContextClass: FakeContext });
    expect(await audio.unlock()).toBe(true);
    const context = FakeContext.instances.at(-1);
    const master = context.nodes.find(node => node.kind === 'gain' && node.connections.includes(context.destination));
    const buses = context.nodes.filter(node => node.kind === 'gain' && node.connections.includes(master));
    const [effects, music] = buses;
    expect(master.gain.value).toBe(0.65);
    expect(music.gain.events).toContainEqual(['ramp', 0.55, 0.55]);
    expect(effects.gain.events).toContainEqual(['ramp', 0.6, 0.08]);
    audio.setPaused(true);
    expect(music.gain.events).toContainEqual(['ramp', 0, 0.15]);
    expect(effects.gain.events).toContainEqual(['ramp', 0, 0.08]);
    audio.setPaused(false);
    expect(effects.gain.events.at(-1)).toEqual(['ramp', 0.6, 0.08]);
    audio.dispose(); vi.runAllTimers();
  });

  it('keeps default-on channels inert until explicit gesture unlock', async () => {
    vi.useFakeTimers();
    const { createCoastalAudio } = await import('./audio.js');
    FakeContext.instances.length = 0;
    const storage = memoryStorage();
    const audio = createCoastalAudio({ storage, AudioContextClass: FakeContext });
    audio.setIsland('qeshm');
    audio.effect();
    vi.advanceTimersByTime(5000);
    expect(audio.getState()).toMatchObject({ music: true, effects: true, unlocked: false, playing: false, contextState: 'locked' });
    expect(FakeContext.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(storage.entries.size).toBe(0);
    expect(await audio.unlock()).toBe(true);
    const context = FakeContext.instances[0];
    expect(audio.getState().playing).toBe(true);
    const count = context.nodes.filter(node => node.kind === 'oscillator').length;
    audio.effect();
    expect(context.nodes.filter(node => node.kind === 'oscillator')).toHaveLength(count + 1);
    audio.dispose(); vi.runAllTimers();
  });

  it('creates context only on unlock and synthesizes quiet clock-scheduled pads, melody and sea', async () => {
    vi.useFakeTimers();
    const { createCoastalAudio } = await import('./audio.js');
    FakeContext.instances.length = 0;
    const storage = memoryStorage({ 'persian-isles-golf.audio.v1': JSON.stringify({ music: true, effects: false }) });
    const audio = createCoastalAudio({ storage, AudioContextClass: FakeContext });
    audio.setMusic(true);
    expect(FakeContext.instances).toHaveLength(0);
    expect(audio.getState()).toMatchObject({ unlocked: false, playing: false, contextState: 'locked' });
    expect(await audio.unlock()).toBe(true);
    const context = FakeContext.instances[0];
    expect(audio.getState()).toMatchObject({ unlocked: true, playing: true, contextState: 'running' });
    expect(context.buffers.length).toBeGreaterThan(0);
    expect(context.buffers.some(buffer => buffer.getChannelData(0).some(sample => sample !== 0))).toBe(true);
    const oscillators = () => context.nodes.filter(node => node.kind === 'oscillator');
    expect(oscillators().length).toBeGreaterThanOrEqual(3);
    expect(context.nodes.some(node => node.kind === 'filter' && node.type === 'lowpass')).toBe(true);
    expect(oscillators().every(node => node.starts.every(time => time >= context.currentTime))).toBe(true);
    const count = oscillators().length;
    context.currentTime = 4;
    vi.advanceTimersByTime(100);
    expect(oscillators().length).toBeGreaterThan(count);
    await audio.unlock();
    expect(FakeContext.instances).toHaveLength(1);
    audio.dispose();
    vi.runAllTimers();
    expect(context.state).toBe('closed');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('safe factory configuration', () => {
  it('supports missing WebAudio with no browser globals and a complete inert interface', async () => {
    const { createCoastalAudio } = await import('./audio.js');
    expect(createCoastalAudio).toBeTypeOf('function');
    const storage = memoryStorage();
    const audio = createCoastalAudio({ storage, AudioContextClass: null });
    expect(Object.keys(audio).sort()).toEqual(['unlock', 'setIsland', 'setMusic', 'setEffects', 'setPaused', 'effect', 'getState', 'dispose'].sort());
    expect(audio.getState()).toEqual({ music: true, effects: true, island: 'hormuz', unlocked: false, playing: false, contextState: 'unsupported' });
    audio.setMusic(true);
    audio.setEffects(true);
    audio.setIsland('kish');
    audio.setIsland('invalid');
    audio.setPaused(true);
    audio.effect(440, .1);
    expect(await audio.unlock()).toBe(false);
    expect(audio.getState()).toMatchObject({ island: 'kish', music: true, effects: true, playing: false });
    expect(audioPreferences(storage)).toEqual({ music: true, effects: true });
    audio.dispose();
    expect(await audio.unlock()).toBe(false);
  });

  it('defaults denied and malformed storage to both channels on', () => {
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(audioPreferences(broken)).toEqual({ music: true, effects: true });
    expect(() => writeAudioPreferences(broken, { music: true })).not.toThrow();
    expect(audioPreferences(memoryStorage({ 'persian-isles-golf.audio.v1': '{broken' }))).toEqual({ music: true, effects: true });
  });

  it('defaults each missing or non-boolean saved channel independently', () => {
    const key = 'persian-isles-golf.audio.v1';
    for (const [saved, expected] of [
      [{ music: false }, { music: false, effects: true }],
      [{ effects: false }, { music: true, effects: false }],
      [{ music: false, effects: 'false' }, { music: false, effects: true }],
      [{ music: 'true', effects: false }, { music: true, effects: false }],
      [{ music: false, effects: false }, { music: false, effects: false }],
    ]) {
      const storage = memoryStorage({ [key]: JSON.stringify(saved) });
      expect(audioPreferences(storage)).toEqual(expected);
      expect(storage.getItem(key)).toBe(JSON.stringify(saved));
    }
    for (const invalid of ['false', 'true', '', 0, 1, null, [], {}]) {
      expect(audioPreferences(memoryStorage({ [key]: JSON.stringify({ music: invalid, effects: invalid }) }))).toEqual({ music: true, effects: true });
    }
  });

  it.each(['null', 'false', '0', '"false"', '[]', '{}'])('defaults non-preference JSON %s to both channels on', saved => {
    expect(audioPreferences(memoryStorage({ 'persian-isles-golf.audio.v1': saved }))).toEqual({ music: true, effects: true });
  });

  it('defaults unavailable or getter-denied browser storage to both channels on', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(audioPreferences()).toEqual({ music: true, effects: true });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
    expect(audioPreferences()).toEqual({ music: true, effects: true });
  });
});

describe('controls and island transitions', () => {
  it('fades pause and music/effect controls, and crossfades to one selected island bus', async () => {
    const { createCoastalAudio } = await import('./audio.js');
    FakeContext.instances.length = 0;
    const audio = createCoastalAudio({ storage: memoryStorage(), AudioContextClass: FakeContext });
    audio.setMusic(true); audio.setEffects(true); await audio.unlock();
    const context = FakeContext.instances[0];
    const gains = () => context.nodes.filter(node => node.kind === 'gain');
    expect(gains().length).toBeGreaterThanOrEqual(7);
    const before = gains().map(node => node.gain.events.length);
    audio.setIsland('qeshm');
    expect(audio.getState()).toMatchObject({ island: 'qeshm', playing: true });
    expect(gains().some((node, index) => node.gain.events.length > (before[index] ?? 0))).toBe(true);
    audio.setPaused(true);
    expect(audio.getState().playing).toBe(false);
    audio.effect(440, 0.2);
    audio.setPaused(false); audio.setMusic(false); audio.setEffects(false);
    expect(audio.getState()).toMatchObject({ music: false, effects: false, playing: false });
    expect(context.nodes.filter(node => node.kind === 'oscillator').length).toBeGreaterThan(0);
    audio.dispose();
  });
});

describe('audio integration safeguards', () => {
  it.each([
    ['hormuz', 146.83, [0, 2, 4, 7, 9], [0, 2, 1, 4, 3, 1, 2, 0], 1.8, 'sine', 1050],
    ['qeshm', 130.81, [0, 2, 3, 7, 10], [0, 3, 1, 2, 4, 3, 1, 0], 2.2, 'triangle', 650],
    ['kish', 164.81, [0, 2, 4, 7, 9], [2, 4, 3, 1, 0, 2, 1, 3], 1.9, 'sine', 1500],
    ['khark', 110, [0, 3, 5, 7, 10], [0, 1, 3, 2, 0, 4, 2, 1], 2.4, 'triangle', 520],
    ['hengam', 155.56, [0, 3, 5, 7, 10], [3, 2, 0, 4, 1, 0, 2, 1], 2.05, 'sine', 1200],
  ])('retains the complete original %s phrase, pad voicing, envelopes and lowpass timbre', async (id, root, scale, phrase, beat, wave, cutoff) => {
    vi.useFakeTimers();
    const { createCoastalAudio } = await import('./audio.js');
    const audio = createCoastalAudio({ storage: memoryStorage(), AudioContextClass: FakeContext });
    audio.setIsland(id); await audio.unlock();
    const context = FakeContext.instances.at(-1);
    const melody = [];
    for (let step = 0; step < phrase.length; step += 1) {
      if (step) { context.currentTime = 0.025 + step * beat - 0.1; vi.advanceTimersByTime(80); }
      const time = 0.025 + step * beat;
      const voices = context.nodes.filter(node => node.kind === 'oscillator' && Math.abs(node.starts[0] - time) < 1e-8);
      expect(voices).toHaveLength(step % 4 === 0 ? 3 : 1);
      const voice = voices[0];
      melody.push(voice.frequency.value);
      expect(voice.type).toBe(wave);
      expect(voice.frequency.value).toBeCloseTo(root * 2 ** (scale[phrase[step]] / 12) * 2, 8);
      expect(voice.stops[0]).toBeCloseTo(time + beat * 1.6 + 0.02, 8);
      expect(voice.connections[0].gain.events).toEqual([
        ['set', 0, voice.starts[0]],
        ['ramp', 0.07, voice.starts[0] + Math.min(0.8, beat * 1.6 * 0.25)],
        ['ramp', 0.07 * 0.65, voice.starts[0] + beat * 1.6 * 0.55],
        ['ramp', 0, voice.starts[0] + beat * 1.6],
      ]);
      if (step % 4 === 0) {
        expect(voices[1].type).toBe('sine');
        expect(voices[1].frequency.value).toBe(root);
        expect(voices[1].connections[0].gain.events[1][1]).toBe(0.035);
        expect(voices[1].stops[0]).toBeCloseTo(time + beat * 4.3 + 0.02, 8);
        expect(voices[2].type).toBe(wave);
        expect(voices[2].frequency.value).toBeCloseTo(root * 2 ** (7 / 12), 8);
        expect(voices[2].connections[0].gain.events[1][1]).toBe(0.025);
        expect(voices[2].stops[0]).toBeCloseTo(time + beat * 4 + 0.02, 8);
      }
    }
    expect(melody).toHaveLength(8);
    const filter = context.nodes.find(node => node.kind === 'filter');
    expect([filter.type, filter.frequency.value, filter.Q.value]).toEqual(['lowpass', cutoff, 0.4]);
    const sea = context.nodes.find(node => node.kind === 'bufferSource');
    expect(sea.loop).toBe(true);
    expect(sea.connections[0].gain.value).toBe(0.035);
    expect(sea.buffer.length).toBe(context.sampleRate * 3);
    audio.effect(660, 0.2);
    const effect = context.nodes.filter(node => node.kind === 'oscillator').at(-1);
    expect([effect.type, effect.frequency.value, effect.connections[0].gain.events[1][1]]).toEqual(['sine', 660, 0.13]);
    expect(effect.stops[0]).toBeCloseTo(context.currentTime + 0.22, 8);
    audio.dispose(); vi.runAllTimers();
  });

  it.each(['paused', 'hidden'])('keeps default-on audio silent when %s before unlock', async mode => {
    vi.useFakeTimers();
    const listeners = new Map();
    const document = { hidden: mode === 'hidden', addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) };
    vi.stubGlobal('document', document);
    const { createCoastalAudio } = await import('./audio.js');
    const storage = memoryStorage();
    const audio = createCoastalAudio({ storage, AudioContextClass: FakeContext });
    if (mode === 'paused') audio.setPaused(true);
    expect(await audio.unlock()).toBe(true);
    const context = FakeContext.instances.at(-1);
    audio.effect();
    context.currentTime = 10;
    vi.advanceTimersByTime(1000);
    expect(audio.getState()).toMatchObject({ music: true, effects: true, playing: false, unlocked: true });
    expect(context.nodes.filter(node => ['oscillator', 'bufferSource'].includes(node.kind))).toHaveLength(0);
    expect(context.nodes.filter(node => node.kind === 'gain')[1].gain.value).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(storage.entries.size).toBe(0);
    if (mode === 'paused') audio.setPaused(false);
    else { document.hidden = false; listeners.get('visibilitychange')(); }
    expect(audio.getState().playing).toBe(true);
    audio.dispose(); vi.runAllTimers();
  });

  it('fades on visibility without changing persisted choices and removes its listener', async () => {
    vi.useFakeTimers();
    const listeners = new Map();
    const document = { hidden: false, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) };
    vi.stubGlobal('document', document);
    const { createCoastalAudio } = await import('./audio.js');
    const storage = memoryStorage();
    const audio = createCoastalAudio({ storage, AudioContextClass: FakeContext });
    audio.setMusic(true); await audio.unlock();
    document.hidden = true; listeners.get('visibilitychange')();
    expect(audio.getState().playing).toBe(false);
    expect(audioPreferences(storage).music).toBe(true);
    vi.advanceTimersByTime(220);
    expect(vi.getTimerCount()).toBe(0);
    document.hidden = false; listeners.get('visibilitychange')();
    expect(audio.getState().playing).toBe(true);
    audio.dispose(); vi.runAllTimers();
    expect(listeners.size).toBe(0);
    expect(audio.getState().playing).toBe(false);
    expect(await audio.unlock()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses browser fallback lazily and treats failed gesture resumes as retryable', async () => {
    vi.useFakeTimers();
    class InitiallyBlockedContext extends FakeContext {
      tries = 0;
      async resume() { if (++this.tries === 1) throw new Error('NotAllowedError'); this.state = 'running'; }
    }
    vi.stubGlobal('AudioContext', InitiallyBlockedContext);
    const { createCoastalAudio } = await import('./audio.js');
    const audio = createCoastalAudio({ storage: memoryStorage() });
    expect(await audio.unlock()).toBe(false);
    expect(audio.getState().unlocked).toBe(false);
    expect(await audio.unlock()).toBe(true);
    audio.dispose(); vi.runAllTimers();
  });

  it('keeps each island composition distinct and stops old sources after crossfade', async () => {
    vi.useFakeTimers();
    const { createCoastalAudio } = await import('./audio.js');
    const storage = memoryStorage({ 'persian-isles-golf.audio.v1': JSON.stringify({ music: true, effects: false }) });
    const audio = createCoastalAudio({ storage, AudioContextClass: FakeContext });
    audio.setMusic(true); await audio.unlock();
    const context = FakeContext.instances.at(-1);
    const signatures = [];
    for (const id of ['hormuz', 'qeshm', 'kish', 'khark', 'hengam']) {
      audio.setIsland(id);
      signatures.push(context.nodes.filter(node => node.kind === 'oscillator').at(-3).frequency.value);
      vi.advanceTimersByTime(400);
      const playingSeas = context.nodes.filter(node => node.kind === 'bufferSource' && !node.stops.length);
      expect(playingSeas).toHaveLength(1);
    }
    expect(new Set(signatures).size).toBe(5);
    const count = context.nodes.filter(node => node.kind === 'oscillator').length;
    audio.effect(440, .1);
    expect(context.nodes.filter(node => node.kind === 'oscillator')).toHaveLength(count);
    audio.setEffects(true); audio.effect(440, .1);
    expect(context.nodes.filter(node => node.kind === 'oscillator')).toHaveLength(count + 1);
    audio.setMusic(false);
    vi.advanceTimersByTime(220);
    expect(vi.getTimerCount()).toBe(0);
    const stoppedCount = context.nodes.length;
    context.currentTime += 100;
    vi.advanceTimersByTime(1000);
    expect(context.nodes.length).toBe(stoppedCount);
    audio.dispose(); vi.runAllTimers();
  });
});

describe('audio preferences', () => {
  it.each([
    [{ music: false, effects: false }, { music: false, effects: false }],
    [{ music: false }, { music: false, effects: true }],
    [{ effects: false }, { music: true, effects: false }],
  ])('preserves saved choices %j through unlock without rewriting storage', async (saved, expected) => {
    vi.useFakeTimers();
    const { createCoastalAudio } = await import('./audio.js');
    const key = 'persian-isles-golf.audio.v1';
    const storage = memoryStorage({ [key]: JSON.stringify(saved) });
    const audio = createCoastalAudio({ storage, AudioContextClass: FakeContext });
    expect(audio.getState()).toMatchObject({ ...expected, unlocked: false, playing: false });
    await audio.unlock();
    expect(audio.getState()).toMatchObject({ ...expected, playing: expected.music });
    const context = FakeContext.instances.at(-1);
    const count = context.nodes.filter(node => node.kind === 'oscillator').length;
    audio.effect();
    expect(context.nodes.filter(node => node.kind === 'oscillator')).toHaveLength(count + (expected.effects ? 1 : 0));
    expect(storage.getItem(key)).toBe(JSON.stringify(saved));
    audio.dispose(); vi.runAllTimers();
  });

  it('defaults absent preferences to music and effects on', () => {
    expect(audioPreferences(memoryStorage())).toEqual({ music: true, effects: true });
  });

  it('persists independent strict booleans', async () => {
    const { audioPreferences, writeAudioPreferences } = await import('./audio.js');
    const storage = memoryStorage();
    expect(audioPreferences(storage)).toEqual({ music: true, effects: true });
    writeAudioPreferences(storage, { music: true, effects: false });
    expect(audioPreferences(storage)).toEqual({ music: true, effects: false });
    writeAudioPreferences(storage, { music: false, effects: true });
    expect(audioPreferences(storage)).toEqual({ music: false, effects: true });
    writeAudioPreferences(storage, { music: 'true', effects: 1 });
    expect(audioPreferences(storage)).toEqual({ music: false, effects: false });
  });
});
