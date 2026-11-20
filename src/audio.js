// Original synthesizer score; no third-party recordings or downloads.
const PREFERENCE_KEY = 'persian-isles-golf.audio.v1';
const ISLAND_CONFIG = {
  hormuz: { root: 146.83, scale: [0, 2, 4, 7, 9], phrase: [0, 2, 1, 4, 3, 1, 2, 0], beat: 1.8, wave: 'sine', cutoff: 1050 },
  qeshm: { root: 130.81, scale: [0, 2, 3, 7, 10], phrase: [0, 3, 1, 2, 4, 3, 1, 0], beat: 2.2, wave: 'triangle', cutoff: 650 },
  kish: { root: 164.81, scale: [0, 2, 4, 7, 9], phrase: [2, 4, 3, 1, 0, 2, 1, 3], beat: 1.9, wave: 'sine', cutoff: 1500 },
  khark: { root: 110, scale: [0, 3, 5, 7, 10], phrase: [0, 1, 3, 2, 0, 4, 2, 1], beat: 2.4, wave: 'triangle', cutoff: 520 },
  hengam: { root: 155.56, scale: [0, 3, 5, 7, 10], phrase: [3, 2, 0, 4, 1, 0, 2, 1], beat: 2.05, wave: 'sine', cutoff: 1200 },
};
const LOOKAHEAD_MS = 80;
const SCHEDULE_AHEAD = 0.28;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function defaultStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function audioPreferences(storage = defaultStorage()) {
  try {
    const value = JSON.parse(storage?.getItem(PREFERENCE_KEY) ?? 'null');
    return {
      music: typeof value?.music === 'boolean' ? value.music : true,
      effects: typeof value?.effects === 'boolean' ? value.effects : true,
    };
  } catch { return { music: true, effects: true }; }
}

export function writeAudioPreferences(storage = defaultStorage(), prefs = {}) {
  try {
    storage?.setItem(PREFERENCE_KEY, JSON.stringify({ music: prefs?.music === true, effects: prefs?.effects === true }));
  } catch { /* Storage policy must not break gameplay. */ }
}

/** Call unlock() directly inside a trusted pointer/key gesture; no context is created before it. */
export function createCoastalAudio({ storage = defaultStorage(), AudioContextClass } = {}) {
  const prefs = audioPreferences(storage);
  let island = 'hormuz';
  let disposed = false;
  let unlocked = false;
  let paused = false;
  let context;
  let master;
  let effectsBus;
  let noiseBuffer;
  let timer;
  let layer;
  let retiring;
  const cleanups = new Set();
  const effectVoices = new Set();
  const documentRef = globalThis.document;
  let hidden = documentRef?.hidden === true;
  const getContextClass = () => AudioContextClass === undefined
    ? globalThis.AudioContext || globalThis.webkitAudioContext
    : AudioContextClass;
  const isRunning = () => context?.state === 'running' && unlocked && !disposed;
  const shouldPlay = () => isRunning() && prefs.music && !paused && !hidden;
  const later = (fn, ms) => {
    const id = setTimeout(() => { cleanups.delete(id); fn(); }, ms);
    cleanups.add(id);
    return id;
  };
  const ramp = (param, target, duration) => {
    const now = context.currentTime;
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
    else {
      const current = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(current, now);
    }
    param.linearRampToValueAtTime(target, now + duration);
  };
  const stopSource = source => { try { source.stop(); } catch { /* Already ended. */ } };
  const destroyLayer = old => {
    if (!old) return;
    old.sources.forEach(stopSource);
    old.nodes.forEach(node => { try { node.disconnect(); } catch { /* Already detached. */ } });
    old.sources.clear(); old.nodes.clear();
    if (retiring === old) retiring = undefined;
  };
  const retireLayer = (duration = 0.35) => {
    if (!layer) return;
    // Rapid selector clicks cannot accumulate fading island voices.
    if (retiring) destroyLayer(retiring);
    retiring = layer; layer = undefined;
    const old = retiring;
    ramp(old.bus.gain, 0, duration);
    later(() => destroyLayer(old), duration * 1000 + 30);
  };
  const makeNoiseBuffer = () => {
    const length = Math.floor(context.sampleRate * 3);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      last = last * 0.975 + (Math.random() * 2 - 1) * 0.025;
      // Endpoints meet at zero to avoid a click on the looping sea buffer.
      data[i] = last * Math.sin(Math.PI * i / (length - 1)) ** 2;
    }
    return buffer;
  };
  const note = (frequency, time, duration, level, wave, owner) => {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, time);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + Math.min(0.8, duration * 0.25));
    envelope.gain.linearRampToValueAtTime(level * 0.65, time + duration * 0.55);
    envelope.gain.linearRampToValueAtTime(0, time + duration);
    oscillator.connect(envelope).connect(owner.input);
    owner.sources.add(oscillator); owner.nodes.add(oscillator); owner.nodes.add(envelope);
    oscillator.onended = () => {
      oscillator.disconnect(); envelope.disconnect();
      owner.sources.delete(oscillator); owner.nodes.delete(oscillator); owner.nodes.delete(envelope);
    };
    oscillator.start(time); oscillator.stop(time + duration + 0.02);
    return oscillator;
  };
  const startLayer = () => {
    const config = ISLAND_CONFIG[island];
    const bus = context.createGain(); bus.gain.value = 0; bus.connect(master);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = config.cutoff; filter.Q.value = 0.4; filter.connect(bus);
    layer = { bus, input: filter, sources: new Set(), nodes: new Set([bus, filter]), config, step: 0, next: context.currentTime + 0.025 };
    const sea = context.createBufferSource(); sea.buffer = noiseBuffer; sea.loop = true;
    const seaGain = context.createGain(); seaGain.gain.value = 0.035;
    sea.connect(seaGain).connect(filter); sea.start(context.currentTime);
    layer.sources.add(sea); layer.nodes.add(sea); layer.nodes.add(seaGain);
    // +7.96 dB at the mix buses only; preserve the score, timbres and master headroom.
    ramp(bus.gain, 0.55, 0.55);
  };
  function schedule() {
    if (!shouldPlay() || !layer) return;
    const current = layer;
    const { config } = current;
    const now = context.currentTime;
    // Never catch up a backlog after a throttled/background tab.
    if (current.next < now) current.next = now + 0.025;
    while (current.next < now + SCHEDULE_AHEAD) {
      const index = config.phrase[current.step % config.phrase.length];
      const frequency = config.root * 2 ** (config.scale[index] / 12);
      note(frequency * 2, current.next, config.beat * 1.6, 0.07, config.wave, current);
      if (current.step % 4 === 0) {
        note(config.root, current.next, config.beat * 4.3, 0.035, 'sine', current);
        note(config.root * 2 ** (7 / 12), current.next, config.beat * 4, 0.025, config.wave, current);
      }
      current.step += 1; current.next += config.beat;
    }
  }
  const reconcile = () => {
    if (!context || disposed) return;
    ramp(effectsBus.gain, prefs.effects && !paused && !hidden ? 0.60 : 0, 0.08);
    if (shouldPlay()) {
      if (!layer) startLayer();
      schedule();
      if (timer === undefined) timer = setInterval(schedule, LOOKAHEAD_MS);
    } else {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
      retireLayer(0.15);
    }
  };
  const onVisibility = () => { hidden = documentRef?.hidden === true; reconcile(); };
  documentRef?.addEventListener?.('visibilitychange', onVisibility);
  return {
    async unlock() {
      if (disposed) return false;
      if (!getContextClass()) return false;
      try {
        if (!context) {
          context = new (getContextClass())();
          master = context.createGain(); master.gain.value = 0.65; master.connect(context.destination);
          effectsBus = context.createGain(); effectsBus.gain.value = 0; effectsBus.connect(master);
          noiseBuffer = makeNoiseBuffer();
        }
        // resume() is invoked synchronously before awaiting to retain user activation.
        if (context.state !== 'running') await context.resume();
        if (disposed) return false;
        unlocked = context.state === 'running';
        reconcile();
        return unlocked;
      } catch { return false; }
    },
    setIsland(id) {
      if (disposed || !Object.hasOwn(ISLAND_CONFIG, id) || id === island) return;
      island = id;
      retireLayer();
      reconcile();
    },
    setMusic(enabled) {
      if (disposed) return;
      prefs.music = enabled === true; writeAudioPreferences(storage, prefs); reconcile();
    },
    setEffects(enabled) {
      if (disposed) return;
      prefs.effects = enabled === true; writeAudioPreferences(storage, prefs); reconcile();
    },
    setPaused(value) { if (!disposed) { paused = value === true; reconcile(); } },
    effect(frequency = 440, duration = 0.12) {
      if (!isRunning() || !prefs.effects || paused || hidden) return;
      const numericFrequency = Number(frequency);
      const numericDuration = Number(duration);
      const owner = { input: effectsBus, sources: effectVoices, nodes: new Set() };
      if (effectVoices.size >= 12) return;
      note(clamp(Number.isFinite(numericFrequency) ? numericFrequency : 440, 80, 1800), context.currentTime,
        clamp(Number.isFinite(numericDuration) ? numericDuration : 0.12, 0.025, 1), 0.13, 'sine', owner);
    },
    getState() {
      return { ...prefs, island, unlocked, playing: shouldPlay() && !!layer,
        contextState: disposed ? 'closed' : context?.state ?? (getContextClass() ? 'locked' : 'unsupported') };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      documentRef?.removeEventListener?.('visibilitychange', onVisibility);
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
      cleanups.forEach(clearTimeout); cleanups.clear();
      if (!context) return;
      ramp(master.gain, 0, 0.10);
      const oldLayer = layer; const oldRetiring = retiring;
      layer = undefined; retiring = undefined;
      // Allow the final envelope to decay before closing the audio device.
      later(() => {
        destroyLayer(oldLayer); destroyLayer(oldRetiring);
        effectVoices.forEach(stopSource); effectVoices.clear();
        try { Promise.resolve(context.close()).catch(() => {}); } catch { /* Device already closed. */ }
      }, 130);
    },
  };
}
