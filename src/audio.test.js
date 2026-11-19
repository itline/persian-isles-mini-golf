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
  it('creates context only on unlock and synthesizes quiet clock-scheduled pads, melody and sea', async () => {
    vi.useFakeTimers();
    const { createCoastalAudio } = await import('./audio.js');
    FakeContext.instances.length = 0;
    const storage = memoryStorage();
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
    expect(audio.getState()).toEqual({ music: false, effects: false, island: 'hormuz', unlocked: false, playing: false, contextState: 'unsupported' });
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

  it('ignores corrupt preferences and denied storage', () => {
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(audioPreferences(broken)).toEqual({ music: false, effects: false });
    expect(() => writeAudioPreferences(broken, { music: true })).not.toThrow();
    expect(audioPreferences(memoryStorage({ 'persian-isles-golf.audio.v1': '{broken' }))).toEqual({ music: false, effects: false });
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
    const audio = createCoastalAudio({ storage: memoryStorage(), AudioContextClass: FakeContext });
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
  it('defaults both channels off and persists independent strict booleans', async () => {
    const { audioPreferences, writeAudioPreferences } = await import('./audio.js');
    const storage = memoryStorage();
    expect(audioPreferences(storage)).toEqual({ music: false, effects: false });
    writeAudioPreferences(storage, { music: true, effects: false });
    expect(audioPreferences(storage)).toEqual({ music: true, effects: false });
    writeAudioPreferences(storage, { music: false, effects: true });
    expect(audioPreferences(storage)).toEqual({ music: false, effects: true });
    writeAudioPreferences(storage, { music: 'true', effects: 1 });
    expect(audioPreferences(storage)).toEqual({ music: false, effects: false });
  });
});
