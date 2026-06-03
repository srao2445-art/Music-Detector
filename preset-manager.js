import { createDefaultState, defaultModuleState } from './audio-engine.js';

export const BUILT_IN_PRESETS = [
  preset('Trap Knock Kick', 'kick', { pitchStart: 150, pitchEnd: 42, punch: .86, drive: .58, click: .7, sub: .9, hardStyle: 'Hard' }, { saturation: .42, compressor: .58, softClip: .82 }),
  preset('Phonk Overdrive Kick', 'kick', { pitchStart: 132, pitchEnd: 48, decay: 1.25, drive: .92, punch: .78, hardStyle: 'Hard' }, { saturation: .86, bitcrush: .1, eqLow: .25 }),
  preset('Drill Sliding 808', 'sub808', { waveform: 'sine', pitch: 39, glide: .74, decay: 3.8, distortion: .56, harmonics: .62, slide: 7.5 }, { saturation: .48, softClip: .95, output: .75 }),
  preset('Boom Bap Rim Snare', 'snare', { tonePitch: 195, ring: .52, noiseColor: 3300, snap: .82, tail: .46, compression: .62 }, { compressor: .62, reverb: .13, eqMid: .18 }),
  preset('EDM Wide Clap', 'clap', { hits: 4, spread: .025, roomTail: .72, width: .86, brightness: 9100, body: .42, decay: .9 }, { reverb: .36, delay: .13, eqHigh: .2 }),
  preset('Techno Closed Hat', 'hihat', { mode: 'Closed', decay: .12, tone: 9800, resonance: 6.8, highPass: 6100, width: .58 }, { saturation: .12, eqHigh: .22 }),
  preset('Lo-fi Dust Kit Perc', 'perc', { pitch: 520, decay: .35, body: .56, attack: .38, noise: .55, filter: 2400, resonance: 3.2 }, { bitcrush: .38, saturation: .28, eqHigh: -.24 }),
  preset('Cinematic Impact', 'fx', { sweep: .72, impact: .94, riser: .4, decay: 4.8, pitch: 74, brightness: 3600, reverbSize: .82 }, { reverb: .72, compressor: .5, limiter: .95 })
];

function preset(name, moduleType, params, fx) {
  const state = createDefaultState();
  state.activeModule = moduleType;
  state.modules[moduleType] = { ...defaultModuleState(moduleType), params: { ...defaultModuleState(moduleType).params, ...params }, fx: { ...defaultModuleState(moduleType).fx, ...fx } };
  seedPattern(state, moduleType);
  return { name, state };
}

function seedPattern(state, moduleType) {
  state.sequence = defaultPattern(16);
  const row = state.sequence.channels[moduleType];
  [0, 4, 8, 12].forEach((step, i) => { row.steps[step].on = true; row.steps[step].velocity = i === 2 ? .85 : 1; });
}

export function defaultPattern(steps = 16) {
  const ids = ['kick', 'snare', 'clap', 'hihat', 'cymbal', 'sub808', 'perc', 'fx'];
  const channels = {};
  ids.forEach(id => channels[id] = { mute: false, solo: false, steps: Array.from({ length: steps }, () => ({ on: false, velocity: .85 })) });
  channels.kick.steps[0].on = true; channels.kick.steps[8].on = true;
  channels.snare.steps[4].on = true; channels.snare.steps[12].on = true;
  for (let i = 0; i < steps; i += 2) channels.hihat.steps[i].on = true;
  return { steps, channels };
}

export class PresetManager {
  constructor(storageKey = 'drumforge-pro-state') { this.storageKey = storageKey; }
  normalize(state) {
    const base = createDefaultState();
    const normalized = typeof structuredClone === 'function' ? structuredClone(base) : JSON.parse(JSON.stringify(base));
    Object.assign(normalized, state || {});
    normalized.modules = { ...base.modules, ...(state?.modules || {}) };
    Object.keys(base.modules).forEach(id => {
      normalized.modules[id] = {
        ...base.modules[id], ...(state?.modules?.[id] || {}),
        params: { ...base.modules[id].params, ...(state?.modules?.[id]?.params || {}) },
        env: { ...base.modules[id].env, ...(state?.modules?.[id]?.env || {}) },
        fx: { ...base.modules[id].fx, ...(state?.modules?.[id]?.fx || {}) },
        layers: { ...base.modules[id].layers, ...(state?.modules?.[id]?.layers || {}) }
      };
    });
    normalized.sequence = normalizePattern(state?.sequence || defaultPattern(normalized.stepCount), normalized.stepCount);
    return normalized;
  }
  saveLocal(state) { localStorage.setItem(this.storageKey, JSON.stringify(state)); }
  loadLocal() { try { return this.normalize(JSON.parse(localStorage.getItem(this.storageKey))); } catch { return this.normalize(); } }
  exportJson(state, name = 'drumforge-preset') { downloadJson({ format: 'DrumForge Pro Preset', version: 1, exportedAt: new Date().toISOString(), state }, `${name}.json`); }
  importJson(file) { return file.text().then(text => this.normalize(JSON.parse(text).state || JSON.parse(text))); }
}

export function normalizePattern(pattern, steps) {
  const base = defaultPattern(steps);
  Object.entries(pattern.channels || {}).forEach(([id, ch]) => {
    if (!base.channels[id]) return;
    base.channels[id].mute = !!ch.mute; base.channels[id].solo = !!ch.solo;
    for (let i = 0; i < steps; i++) base.channels[id].steps[i] = { on: !!ch.steps?.[i]?.on, velocity: Number(ch.steps?.[i]?.velocity ?? .85) };
  });
  return base;
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
