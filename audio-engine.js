export const MODULES = {
  kick: { name: 'Kick', subtitle: 'Pitch, body, click, sub, punch, drive and filters.', layers: ['body', 'click', 'sub'], params: {
    pitchStart: [35, 220, 118], pitchEnd: [25, 90, 46], pitchDecay: [0.01, 0.8, 0.16], punch: [0, 1, 0.62], decay: [0.08, 2.5, 0.78], drive: [0, 1, 0.42], lowCut: [15, 160, 28], highCut: [600, 12000, 6200], click: [0, 1, 0.62], sub: [0, 1, 0.72], hardStyle: ['Soft', 'Hard', 'Soft'] } },
  snare: { name: 'Snare', subtitle: 'Tone oscillator, colored noise, snap, ring, compression and filters.', layers: ['tone', 'noise', 'snap'], params: {
    tonePitch: [120, 420, 205], ring: [0, 1, 0.34], noiseColor: [300, 9000, 4200], snap: [0, 1, 0.78], tail: [0.05, 2.2, 0.62], compression: [0, 1, 0.52], distortion: [0, 1, 0.28], filter: [400, 12000, 5800] } },
  clap: { name: 'Clap', subtitle: 'Multi-hit bursts with room tail, width, brightness, body and decay.', layers: ['bursts', 'room', 'body'], params: {
    hits: [2, 6, 4], spread: [0.005, 0.09, 0.028], roomTail: [0, 1, 0.55], width: [0, 1, 0.72], brightness: [600, 12000, 7200], body: [0, 1, 0.36], decay: [0.08, 2.4, 0.78] } },
  hihat: { name: 'Hi-Hat', subtitle: 'Metallic oscillator bank, noise layer, open/closed modes and velocity response.', layers: ['metal', 'noise'], params: {
    mode: ['Closed', 'Open', 'Closed'], decay: [0.025, 1.8, 0.22], tone: [3000, 15000, 8400], resonance: [0.2, 12, 4.6], highPass: [800, 10000, 5200], width: [0, 1, 0.55], velocityResponse: [0, 1, 0.75] } },
  cymbal: { name: 'Cymbal', subtitle: 'Long metallic oscillator stack with filtered noise and stereo shimmer.', layers: ['metal', 'wash', 'ping'], params: {
    decay: [0.4, 8, 3.2], tone: [1200, 16000, 7600], resonance: [0.2, 16, 7], highPass: [300, 8000, 2100], width: [0, 1, 0.82], shimmer: [0, 1, 0.55], noise: [0, 1, 0.64] } },
  sub808: { name: '808/Sub', subtitle: 'Mono glide bass drum with harmonic drive, slide and soft clipping.', layers: ['osc', 'harmonics'], params: {
    waveform: ['sine', 'triangle', 'sine'], pitch: [28, 95, 44], glide: [0, 1, 0.34], decay: [0.2, 6, 2.4], release: [0.05, 2.5, 0.36], distortion: [0, 1, 0.38], harmonics: [0, 1, 0.44], slide: [0, 12, 3.5], softClip: [0, 1, 0.85] } },
  perc: { name: 'Percussion', subtitle: 'Tuned blips, resonant noise, transient slap and body shaping.', layers: ['tone', 'noise', 'transient'], params: {
    pitch: [120, 1800, 640], decay: [0.04, 2, 0.42], body: [0, 1, 0.54], attack: [0, 1, 0.62], noise: [0, 1, 0.36], filter: [300, 14000, 3600], resonance: [0.2, 18, 5] } },
  fx: { name: 'FX Hit', subtitle: 'Risers, impacts and cinematic hits with sweep, impact and space controls.', layers: ['impact', 'noise', 'riser'], params: {
    sweep: [0, 1, 0.62], impact: [0, 1, 0.8], riser: [0, 1, 0.48], decay: [0.3, 8, 2.8], pitch: [35, 500, 120], brightness: [400, 14000, 4800], reverbSize: [0, 1, 0.72] } }
};

export const DEFAULT_ENV = { attack: 0.002, decay: 0.22, sustain: 0.18, release: 0.18, velocity: 0.75, pitchEnv: 0.42, filterEnv: 0.35 };
export const DEFAULT_FX = { eqLow: 0, eqMid: 0, eqHigh: 0, compressor: 0.35, saturation: 0.25, bitcrush: 0, transient: 0.45, reverb: 0.16, delay: 0.08, delayFeedback: 0, softClip: 0.7, limiter: 0.9, output: 0.82 };

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const expRamp = (param, value, time) => param.exponentialRampToValueAtTime(Math.max(0.0001, value), time);

export function defaultModuleState(id) {
  const def = MODULES[id];
  const params = {};
  Object.entries(def.params).forEach(([key, spec]) => { params[key] = Array.isArray(spec) && typeof spec[0] === 'string' ? spec[2] : spec[2]; });
  const layers = Object.fromEntries(def.layers.map(layer => [layer, { gain: 0.85, mute: false, solo: false }]));
  return { id, params, env: { ...DEFAULT_ENV }, fx: { ...DEFAULT_FX }, layers, muted: false, solo: false };
}

export function createDefaultState() {
  return { activeModule: 'kick', masterVolume: 0.78, bpm: 140, swing: 0.12, stepCount: 16, macros: { power: 0.5, space: 0.25, dirt: 0.35 }, modules: Object.fromEntries(Object.keys(MODULES).map(id => [id, defaultModuleState(id)])) };
}

export class DrumAudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.analyser = null;
    this.meter = null;
    this.previewWet = true;
    this.activeVoices = new Set();
  }

  async init() {
    if (this.context) {
      if (this.context.state === 'suspended') await this.context.resume();
      return;
    }
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    this.context = new Context();
    this.master = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.meter = this.context.createAnalyser();
    this.meter.fftSize = 256;
    const safetyClipper = shaper(this.context, 0.55);
    const limiter = this.context.createDynamicsCompressor();
    limiter.threshold.value = -1.5; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.08;
    this.master.connect(safetyClipper).connect(limiter).connect(this.context.destination);
    limiter.connect(this.analyser);
    limiter.connect(this.meter);
  }

  setMaster(value) { if (this.master) this.master.gain.setTargetAtTime(clamp(value, 0, 1), this.context.currentTime, 0.015); }
  setWet(enabled) { this.previewWet = enabled; }
  resetLimiter() { this.stopAll(); if (this.context) this.master.gain.setValueAtTime(this.master.gain.value, this.context.currentTime); }

  async trigger(moduleState, velocity = 1, when = 0, output = this.master, wet = this.previewWet) {
    await this.init();
    if (this.context.state === 'suspended') await this.context.resume();
    const t = when || this.context.currentTime + 0.005;
    const voice = synthesizeModule(this.context, moduleState, output, t, clamp(velocity, 0, 1), wet);
    if (voice?.cleanup && typeof setTimeout === 'function' && this.context?.constructor?.name !== 'OfflineAudioContext') {
      const record = { cleanup: voice.cleanup, timer: null };
      const ms = Math.max(0, (voice.endsAt - this.context.currentTime) * 1000 + 80);
      record.timer = setTimeout(() => { record.cleanup(); this.activeVoices.delete(record); }, ms);
      this.activeVoices.add(record);
    }
    return voice;
  }

  stopAll() {
    this.activeVoices.forEach(record => { clearTimeout(record.timer); record.cleanup?.(); });
    this.activeVoices.clear();
    if (this.master && this.context) {
      const now = this.context.currentTime;
      const restoreGain = clamp(this.master.gain.value || 0.78, 0, 1);
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(0, now, 0.006);
      setTimeout(() => this.master?.gain.setTargetAtTime(restoreGain, this.context.currentTime, 0.02), 50);
    }
  }
}

export function synthesizeModule(ctx, state, destination, time, velocity = 1, wet = true) {
  // Every drum voice is built from Web Audio synthesis layers. Oscillators create pitched body/sub components,
  // generated noise buffers supply snares/claps/cymbals, and envelopes/transient shaping/FX process the result.
  // Sources are created only on trigger, enveloped with short fades, stopped, and disconnected after the voice tail.
  const cleanupNodes = [];
  const dry = track(ctx.createGain(), cleanupNodes);
  const fxIn = track(ctx.createGain(), cleanupNodes);
  dry.gain.value = wet ? 0 : 1;
  fxIn.gain.value = wet ? 1 : 0;
  const voiceBus = track(ctx.createGain(), cleanupNodes);
  const sourceBus = track(ctx.createGain(), cleanupNodes);
  applyPreVoiceProcessing(ctx, voiceBus, sourceBus, state, cleanupNodes);
  sourceBus.connect(dry).connect(destination);
  sourceBus.connect(fxIn);
  buildFxRack(ctx, fxIn, destination, state.fx, cleanupNodes);
  const layerActive = layer => isLayerAudible(state.layers, layer);
  const gainFor = layer => (state.layers[layer]?.gain ?? 1) * velocity * (state.env.velocity * velocity + (1 - state.env.velocity));
  const id = state.id;
  if (id === 'kick') kick(ctx, state, voiceBus, time, layerActive, gainFor);
  if (id === 'snare') snare(ctx, state, voiceBus, time, layerActive, gainFor);
  if (id === 'clap') clap(ctx, state, voiceBus, time, layerActive, gainFor);
  if (id === 'hihat') hihat(ctx, state, voiceBus, time, layerActive, gainFor, false);
  if (id === 'cymbal') hihat(ctx, state, voiceBus, time, layerActive, gainFor, true);
  if (id === 'sub808') sub808(ctx, state, voiceBus, time, layerActive, gainFor);
  if (id === 'perc') perc(ctx, state, voiceBus, time, layerActive, gainFor);
  if (id === 'fx') fxHit(ctx, state, voiceBus, time, layerActive, gainFor);
  const endsAt = time + estimateTail(state) + 0.25;
  return { endsAt, cleanup: () => cleanupNodes.splice(0).forEach(node => safeDisconnect(node)) };
}


function applyPreVoiceProcessing(ctx, input, output, state, cleanupNodes = []) {
  const p = state.params;
  let node = input;
  if (p.lowCut || p.highPass) { const hp = track(makeFilter(ctx, 'highpass', p.lowCut || p.highPass, 0.8 + (state.env.filterEnv || 0) * 4), cleanupNodes); node.connect(hp); node = hp; }
  if (p.highCut || p.filter || p.brightness || p.tone) { const lp = track(makeFilter(ctx, 'lowpass', p.highCut || p.filter || p.brightness || p.tone, 0.8 + (state.env.filterEnv || 0) * 3), cleanupNodes); node.connect(lp); node = lp; }
  const drive = (p.drive || p.distortion || 0) + (p.softClip || 0) * 0.25 + (state.fx.saturation || 0) * 0.25;
  if (drive > 0.01) { const sat = track(shaper(ctx, drive), cleanupNodes); node.connect(sat); node = sat; }
  if (p.width || p.reverbSize) {
    const spread = track(ctx.createDelay(0.04), cleanupNodes); spread.delayTime.value = 0.004 + (p.width || p.reverbSize || 0) * 0.026;
    const spreadGain = track(ctx.createGain(), cleanupNodes); spreadGain.gain.value = (p.width || p.reverbSize || 0) * 0.18;
    node.connect(spread).connect(spreadGain).connect(output);
  }
  node.connect(output);
}

function isLayerAudible(layers, layer) {
  const anySolo = Object.values(layers).some(l => l.solo);
  const cfg = layers[layer] || { gain: 1 };
  return !cfg.mute && (!anySolo || cfg.solo);
}

function envelope(ctx, node, time, attack, decay, sustain, release, length, peak = 1) {
  const g = node.gain; peak = clamp(peak, 0, 1.4); attack = Math.max(0.0015, attack); release = Math.max(0.008, release);
  g.cancelScheduledValues(time);
  g.setValueAtTime(0.0001, time);
  g.linearRampToValueAtTime(peak, time + Math.max(0.001, attack));
  g.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), time + attack + decay);
  g.exponentialRampToValueAtTime(0.0001, time + length + release);
}

function osc(ctx, type, freq, dest, time, dur, gain = 1, env = {}) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(Math.max(1, freq), time);
  if (env.endFreq) expRamp(o.frequency, env.endFreq, time + env.pitchDecay);
  envelope(ctx, g, time, env.attack ?? 0.001, env.decay ?? dur * 0.35, env.sustain ?? 0.0001, env.release ?? 0.08, dur, gain);
  o.connect(g).connect(dest); o.start(time); o.stop(time + dur + (env.release ?? 0.1) + 0.05);
  o.onended = () => { safeDisconnect(o); safeDisconnect(g); };
  return o;
}

function noise(ctx, dest, time, dur, gain = 1, filter = null, env = {}) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * (dur + 0.2)));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len * 0.2);
  const src = ctx.createBufferSource(); src.buffer = buffer;
  const g = ctx.createGain(); envelope(ctx, g, time, env.attack ?? 0.001, env.decay ?? dur * 0.55, env.sustain ?? 0.001, env.release ?? 0.08, dur, gain);
  let last = src;
  if (filter) { const f = ctx.createBiquadFilter(); Object.assign(f, {}); f.type = filter.type; f.frequency.value = filter.freq; f.Q.value = filter.q ?? 0.7; last.connect(f); last = f; }
  last.connect(g).connect(dest); src.start(time); src.stop(time + dur + 0.2);
  src.onended = () => { safeDisconnect(src); safeDisconnect(g); if (last !== src) safeDisconnect(last); };
}

function shaper(ctx, amount) {
  const ws = ctx.createWaveShaper(); const n = 2048; const curve = new Float32Array(n); const k = amount * 80 + 1;
  for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; curve[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
  ws.curve = curve; ws.oversample = '4x'; return ws;
}

function layerBus(ctx, destination, state, time, length, layerGain, filter = null) {
  const bus = ctx.createGain(); const shaped = ctx.createGain();
  envelope(ctx, shaped, time, state.env.attack, state.env.decay, state.env.sustain, state.env.release, length, layerGain);
  if (filter) { bus.connect(filter).connect(shaped).connect(destination); } else { bus.connect(shaped).connect(destination); }
  return bus;
}

function kick(ctx, s, dest, t, on, gain) {
  const p = s.params; const len = p.decay;
  if (on('body')) osc(ctx, p.hardStyle === 'Hard' ? 'square' : 'sine', p.pitchStart, layerBus(ctx, dest, s, t, len, 0.95 * gain('body')), t, len, 1, { endFreq: p.pitchEnd, pitchDecay: p.pitchDecay, decay: len * 0.6, release: 0.04 });
  if (on('sub')) osc(ctx, 'sine', p.pitchEnd * 0.5, layerBus(ctx, dest, s, t, len * 1.2, p.sub * gain('sub')), t, len * 1.25, 1, { decay: len, release: 0.08 });
  if (on('click')) noise(ctx, layerBus(ctx, dest, s, t, 0.035, p.click * (0.4 + p.punch) * gain('click'), makeFilter(ctx, 'highpass', 3500, 1)), t, 0.035, 1, { type: 'bandpass', freq: p.highCut, q: 2 }, { decay: 0.018, release: 0.006 });
  toneFilters(ctx, dest, p.lowCut, p.highCut); if (p.drive > 0) dest.gain.value *= (1 + p.drive * 0.2);
}

function snare(ctx, s, dest, t, on, gain) {
  const p = s.params; const len = p.tail;
  if (on('tone')) osc(ctx, 'triangle', p.tonePitch, layerBus(ctx, dest, s, t, len, (0.35 + p.ring) * gain('tone')), t, len, 1, { endFreq: p.tonePitch * 0.72, pitchDecay: 0.09 + p.ring * 0.3, decay: len * .65, release: .12 });
  if (on('noise')) noise(ctx, layerBus(ctx, dest, s, t, len, gain('noise')), t, len, 0.9, { type: 'bandpass', freq: p.noiseColor, q: 0.8 + p.compression * 5 }, { decay: len * 0.7, release: 0.12 });
  if (on('snap')) noise(ctx, layerBus(ctx, dest, s, t, 0.04, p.snap * gain('snap')), t, 0.04, 1, { type: 'highpass', freq: p.filter, q: 1.5 }, { decay: 0.02, release: 0.01 });
}

function clap(ctx, s, dest, t, on, gain) {
  const p = s.params;
  if (on('bursts')) for (let i = 0; i < Math.round(p.hits); i++) noise(ctx, layerBus(ctx, dest, s, t + i * p.spread, 0.08, gain('bursts')), t + i * p.spread, 0.08, 0.7, { type: 'bandpass', freq: p.brightness, q: 0.9 }, { decay: 0.045, release: 0.02 });
  if (on('room')) noise(ctx, layerBus(ctx, dest, s, t, p.decay, p.roomTail * gain('room')), t + p.spread * 1.5, p.decay, 0.55, { type: 'highpass', freq: 900 + p.brightness * 0.12, q: 0.8 }, { attack: 0.02, decay: p.decay * 0.75, release: 0.2 });
  if (on('body')) osc(ctx, 'triangle', 180, layerBus(ctx, dest, s, t, 0.35, p.body * gain('body')), t, 0.35, 1, { decay: .18, release: .08 });
}

function hihat(ctx, s, dest, t, on, gain, cymbal) {
  const p = s.params; const velocityShape = 0.45 + (p.velocityResponse ?? 0.7) * 0.55; const decay = cymbal ? p.decay : (p.mode === 'Open' ? p.decay * 3.4 : p.decay);
  const freqs = cymbal ? [311, 493, 732, 1180, 1830, 3100] : [421, 539, 801, 1151, 1723, 2591];
  if (on('metal')) freqs.forEach((f, i) => osc(ctx, 'square', f * (p.tone / 7000), layerBus(ctx, dest, s, t, decay, (cymbal ? 0.11 : 0.08) * gain('metal') * velocityShape, makeFilter(ctx, 'highpass', p.highPass, p.resonance)), t, decay, 1, { decay: decay * (0.5 + i * .04), release: .05 }));
  if (on(cymbal ? 'wash' : 'noise')) noise(ctx, layerBus(ctx, dest, s, t, decay, (p.noise ?? 0.65) * gain(cymbal ? 'wash' : 'noise') * velocityShape, makeFilter(ctx, 'highpass', p.highPass, p.resonance)), t, decay, 0.75, { type: 'bandpass', freq: p.tone, q: p.resonance }, { decay: decay * .75, release: .12 });
  if (cymbal && on('ping')) osc(ctx, 'triangle', p.tone * 0.24, layerBus(ctx, dest, s, t, decay * .8, p.shimmer * gain('ping') * velocityShape), t, decay * .8, 1, { decay: decay * .6, release: .2 });
}

function sub808(ctx, s, dest, t, on, gain) {
  const p = s.params; const len = p.decay;
  if (on('osc')) osc(ctx, p.waveform, p.pitch + p.slide, layerBus(ctx, dest, s, t, len, gain('osc')), t, len, 1, { endFreq: p.pitch, pitchDecay: 0.05 + p.glide * 0.8, decay: len * .8, release: p.release });
  if (on('harmonics')) osc(ctx, 'sawtooth', (p.pitch + p.slide) * 2, layerBus(ctx, dest, s, t, len * .6, p.harmonics * gain('harmonics')), t, len * .6, 1, { endFreq: p.pitch * 2, pitchDecay: .08 + p.glide, decay: len * .4, release: p.release });
}

function perc(ctx, s, dest, t, on, gain) {
  const p = s.params;
  if (on('tone')) osc(ctx, 'triangle', p.pitch, layerBus(ctx, dest, s, t, p.decay, p.body * gain('tone'), makeFilter(ctx, 'bandpass', p.filter, p.resonance)), t, p.decay, 1, { endFreq: p.pitch * .55, pitchDecay: p.decay * .4, decay: p.decay * .5, release: .06 });
  if (on('noise')) noise(ctx, layerBus(ctx, dest, s, t, p.decay * .7, p.noise * gain('noise'), makeFilter(ctx, 'bandpass', p.filter, p.resonance)), t, p.decay * .7, 1, { type: 'bandpass', freq: p.filter, q: p.resonance }, { decay: p.decay * .4, release: .04 });
  if (on('transient')) noise(ctx, layerBus(ctx, dest, s, t, .03, p.attack * gain('transient')), t, .03, 1, { type: 'highpass', freq: 3500, q: 1 }, { decay: .015, release: .005 });
}

function fxHit(ctx, s, dest, t, on, gain) {
  const p = s.params;
  if (on('impact')) osc(ctx, 'sine', p.pitch * 3, layerBus(ctx, dest, s, t, p.decay, p.impact * gain('impact')), t, p.decay, 1, { endFreq: p.pitch * .35, pitchDecay: .25 + p.sweep, decay: p.decay * .5, release: .3 });
  if (on('noise')) noise(ctx, layerBus(ctx, dest, s, t, p.decay, gain('noise')), t, p.decay, 0.9, { type: 'lowpass', freq: p.brightness, q: .9 }, { attack: .005, decay: p.decay * .8, release: .4 });
  if (on('riser')) noise(ctx, layerBus(ctx, dest, s, t, p.decay, p.riser * gain('riser')), t, p.decay, 0.45, { type: 'bandpass', freq: p.brightness, q: 3 + p.sweep * 8 }, { attack: p.decay * .55, decay: p.decay * .25, release: .3 });
}


function estimateTail(state) {
  const p = state.params || {};
  return Math.min(12, Math.max(0.35, p.decay || p.tail || 0, p.release || 0, (p.roomTail || 0) * 2) + (state.fx?.reverb || 0) * 2.8 + (state.fx?.delay || 0) * 0.7 + 0.35);
}

function track(node, nodes) { nodes?.push(node); return node; }
function safeDisconnect(node) { try { node?.disconnect?.(); } catch {} }

function makeFilter(ctx, type, freq, q) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; }
function toneFilters() { /* Voice-level filters are applied in layer buses and the FX rack; retained for readable kick signal flow. */ }

function buildFxRack(ctx, input, destination, fx, cleanupNodes = []) {
  const low = track(ctx.createBiquadFilter(), cleanupNodes); low.type = 'lowshelf'; low.frequency.value = 100; low.gain.value = fx.eqLow * 12;
  const mid = track(ctx.createBiquadFilter(), cleanupNodes); mid.type = 'peaking'; mid.frequency.value = 900; mid.Q.value = 0.9; mid.gain.value = fx.eqMid * 12;
  const high = track(ctx.createBiquadFilter(), cleanupNodes); high.type = 'highshelf'; high.frequency.value = 6500; high.gain.value = fx.eqHigh * 12;
  const comp = track(ctx.createDynamicsCompressor(), cleanupNodes); comp.threshold.value = -24 + fx.compressor * 18; comp.ratio.value = 1 + fx.compressor * 11; comp.attack.value = 0.003; comp.release.value = 0.08 + fx.compressor * 0.25;
  const sat = track(shaper(ctx, fx.saturation), cleanupNodes);
  const crush = track(bitCrusher(ctx, fx.bitcrush), cleanupNodes);
  const trans = track(ctx.createGain(), cleanupNodes); trans.gain.value = 0.85 + fx.transient * 0.45;
  const delay = track(ctx.createDelay(1), cleanupNodes); delay.delayTime.value = 0.08 + fx.delay * 0.42;
  const delayGain = track(ctx.createGain(), cleanupNodes); delayGain.gain.value = fx.delay * (0.16 + (fx.delayFeedback ?? 0) * 0.34);
  const reverb = track(convolver(ctx, fx.reverb), cleanupNodes);
  const wetRev = track(ctx.createGain(), cleanupNodes); wetRev.gain.value = fx.reverb * 0.42;
  const clip = track(shaper(ctx, fx.softClip), cleanupNodes);
  const limiter = track(ctx.createDynamicsCompressor(), cleanupNodes); limiter.threshold.value = -2 - fx.limiter * 8; limiter.ratio.value = 8 + fx.limiter * 12; limiter.attack.value = 0.001; limiter.release.value = 0.05;
  const out = track(ctx.createGain(), cleanupNodes); out.gain.value = fx.output;
  input.connect(low).connect(mid).connect(high).connect(comp).connect(sat).connect(crush).connect(trans).connect(clip).connect(limiter).connect(out).connect(destination);
  trans.connect(delay).connect(delayGain).connect(clip);
  trans.connect(reverb).connect(wetRev).connect(clip);
}

function bitCrusher(ctx, amount) {
  const node = ctx.createWaveShaper(); const n = 1024; const curve = new Float32Array(n); const steps = Math.max(2, Math.round(64 - amount * 60));
  for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; curve[i] = Math.round(x * steps) / steps; }
  node.curve = curve; return node;
}

function convolver(ctx, amount) {
  const c = ctx.createConvolver(); const len = Math.max(1, Math.floor(ctx.sampleRate * (0.12 + amount * 2.6))); const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2); }
  c.buffer = b; return c;
}
