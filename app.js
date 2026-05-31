const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const value = (id) => Number($(`#${id}`).value);
const waveformColors = ['#4de5ff', '#a779ff', '#ffc868'];
const keyboardMap = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17 };
const blackNotes = new Set([1, 3, 6, 8, 10]);
const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const instrumentTypes = ['Lead', 'Pad', 'Bass', 'Keys', 'Pluck', 'Arp', 'Chord', 'Texture', 'FX', 'Custom'];
const presetFileFormat = 'nebula-studio-preset';
const presetFileVersion = 1;

const state = {
  audio: null,
  voices: new Map(),
  octave: 3,
  recording: { recorder: null, chunks: [], blob: null, startedAt: 0, timer: null },
  loaderLibrary: 'all',
  loaderCategory: 'All',
  activePatchCategory: 'Custom',
  oscillators: [
    { enabled: true, wave: 'sawtooth', octave: 0, semi: 0, detune: -6, level: 72, pan: -12 },
    { enabled: true, wave: 'triangle', octave: -1, semi: 7, detune: 5, level: 42, pan: 14 },
    { enabled: true, wave: 'sine', octave: -2, semi: 0, detune: 0, level: 24, pan: 0 }
  ]
};

const patchSeeds = [
  ['INIT', 'Astral Keys', 'Keys', 'sawtooth', 'triangle', 2600, 5, 0.04, 0.48, 0.68, 1.2, 20],
  ['BA', 'Neon Monolith', 'Bass', 'sawtooth', 'square', 680, 14, 0.01, 0.22, 0.8, 0.34, 5],
  ['PD', 'Glass Horizon', 'Pad', 'triangle', 'sine', 4400, 4, 0.62, 1.8, 0.72, 3.4, 44],
  ['LD', 'Ion Drifter', 'Lead', 'square', 'sawtooth', 1800, 9, 0.03, 0.32, 0.64, 0.62, 18],
  ['AR', 'Orbit Sequence', 'Arp', 'sawtooth', 'sine', 3200, 11, 0.01, 0.12, 0.42, 0.18, 7],
  ['FX', 'Starlight Texture', 'Texture', 'triangle', 'square', 5100, 18, 0.86, 2.2, 0.58, 4.2, 56],
  ['PL', 'Chromatic Rain', 'Pluck', 'triangle', 'sine', 6100, 6, 0.005, 0.28, 0.08, 0.58, 25],
  ['CH', 'Nova Chord', 'Chord', 'sawtooth', 'triangle', 2250, 7, 0.18, 0.86, 0.76, 2.1, 36]
];
const adjectives = ['Velvet', 'Quantum', 'Solar', 'Midnight', 'Crystal', 'Lunar', 'Electric', 'Frozen', 'Radiant', 'Infinite', 'Prismatic', 'Echoing', 'Magnetic', 'Violet', 'Chrome', 'Celestial'];
const nouns = ['Pulse', 'Bloom', 'Circuit', 'Mirage', 'Cascade', 'Voyager', 'Signal', 'Dream', 'Motion', 'Flare', 'Current', 'Halo', 'Engine', 'Vista', 'Dust', 'Wave'];

function createFactoryPresets() {
  const presets = patchSeeds.map(seed => makePatch(seed));
  for (let index = presets.length; index < 256; index += 1) {
    const base = patchSeeds[index % patchSeeds.length];
    const variation = Math.floor(index / patchSeeds.length);
    const patch = makePatch(base);
    patch.name = `${base[0]} — ${adjectives[(index * 3) % adjectives.length]} ${nouns[(index * 7) % nouns.length]} ${String(variation).padStart(2, '0')}`;
    patch.category = base[2];
    patch.cutoff = Math.min(15000, Math.max(120, base[5] * (0.62 + (variation % 9) * 0.11)));
    patch.resonance = Math.min(22, base[6] + (variation % 5) - 2);
    patch.oscillators[0].wave = ['sawtooth', 'square', 'triangle', 'sine'][variation % 4];
    patch.oscillators[0].detune = (variation % 15) - 7;
    patch.oscillators[1].wave = ['triangle', 'sawtooth', 'square', 'sine'][(variation + index) % 4];
    patch.oscillators[1].semi = [0, 3, 5, 7, 12][variation % 5];
    patch.oscillators[1].octave = [-2, -1, 0][variation % 3];
    patch.oscillators[2].level = 12 + (variation % 6) * 7;
    patch.drive = 4 + (variation % 7) * 5;
    patch.filterEnv = -24 + (variation % 9) * 14;
    patch.attack = Math.max(0.005, base[7] * (0.45 + (variation % 5) * 0.34));
    patch.decay = Math.max(0.02, base[8] * (0.52 + (variation % 6) * 0.22));
    patch.lfoShape = ['sine', 'triangle', 'sawtooth', 'square'][variation % 4];
    patch.lfoRate = 0.25 + (variation % 12) * 0.3;
    patch.lfoDepth = 5 + (variation % 8) * 5;
    patch.chorus = 6 + (variation % 6) * 8;
    patch.delay = 4 + (variation % 5) * 7;
    patch.reverb = Math.min(68, base[11] + (variation % 5) * 7);
    presets.push(patch);
  }
  return presets;
}

function makePatch(seed) {
  return {
    name: `${seed[0]} — ${seed[1]}`, category: seed[2], cutoff: seed[5], resonance: seed[6], drive: 8, filterEnv: 28,
    attack: seed[7], decay: seed[8], sustain: seed[9], release: seed[10], chorus: 20, delay: 16, reverb: seed[11], distortion: 8,
    lfoShape: 'sine', lfoTarget: 'cutoff', lfoRate: 1.2, lfoDepth: 18, master: 62,
    oscillators: [
      { enabled: true, wave: seed[3], octave: 0, semi: 0, detune: -6, level: 72, pan: -12 },
      { enabled: true, wave: seed[4], octave: -1, semi: 7, detune: 5, level: 42, pan: 14 },
      { enabled: true, wave: 'sine', octave: -2, semi: 0, detune: 0, level: 24, pan: 0 }
    ]
  };
}
const factoryPresets = createFactoryPresets();

function buildOscillators() {
  $('#osc-grid').innerHTML = state.oscillators.map((osc, index) => `
    <section class="panel osc-card">
      <header class="osc-head"><input class="enabled" id="osc-${index}-enabled" type="checkbox" ${osc.enabled ? 'checked' : ''}><h2>OSCILLATOR ${String.fromCharCode(65 + index)}</h2>
      <select id="osc-${index}-wave"><option>sawtooth</option><option>square</option><option>triangle</option><option>sine</option></select></header>
      <div class="osc-body"><canvas id="osc-${index}-graph" width="430" height="75"></canvas>
      <div class="control-grid four">
        <label>OCTAVE <output id="osc-${index}-octave-out"></output><input id="osc-${index}-octave" type="range" min="-3" max="3" value="${osc.octave}"></label>
        <label>SEMITONE <output id="osc-${index}-semi-out"></output><input id="osc-${index}-semi" type="range" min="-12" max="12" value="${osc.semi}"></label>
        <label>DETUNE <output id="osc-${index}-detune-out"></output><input id="osc-${index}-detune" type="range" min="-50" max="50" value="${osc.detune}"></label>
        <label>LEVEL <output id="osc-${index}-level-out"></output><input id="osc-${index}-level" type="range" min="0" max="100" value="${osc.level}"></label>
      </div></div>
    </section>`).join('');
  state.oscillators.forEach((osc, index) => {
    $(`#osc-${index}-wave`).value = osc.wave;
    ['enabled', 'wave', 'octave', 'semi', 'detune', 'level'].forEach(control => $(`#osc-${index}-${control}`).addEventListener('input', () => updateOscillator(index)));
    updateOscillator(index);
  });
}

function updateOscillator(index) {
  const osc = state.oscillators[index];
  osc.enabled = $(`#osc-${index}-enabled`).checked;
  osc.wave = $(`#osc-${index}-wave`).value;
  ['octave', 'semi', 'detune', 'level'].forEach(control => {
    osc[control] = value(`osc-${index}-${control}`);
    $(`#osc-${index}-${control}-out`).textContent = control === 'level' ? `${osc[control]}%` : `${osc[control] > 0 ? '+' : ''}${osc[control]}`;
  });
  drawWave($(`#osc-${index}-graph`), osc.wave, waveformColors[index]);
}

function createAudio() {
  if (state.audio) return state.audio;
  const context = new AudioContext();
  const input = context.createGain();
  const filter = context.createBiquadFilter();
  const drive = context.createWaveShaper();
  const chorusDelay = context.createDelay();
  const chorusWet = context.createGain();
  const delay = context.createDelay();
  const delayFeedback = context.createGain();
  const delayWet = context.createGain();
  const reverb = context.createConvolver();
  const reverbWet = context.createGain();
  const master = context.createGain();
  const analyser = context.createAnalyser();
  const recorderDestination = context.createMediaStreamDestination();
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();
  const chorusLfo = context.createOscillator();
  const chorusMod = context.createGain();

  filter.type = $('#filter-type').value;
  chorusDelay.delayTime.value = 0.018;
  delay.delayTime.value = 0.32;
  delayFeedback.gain.value = 0.28;
  analyser.fftSize = 1024;
  reverb.buffer = createImpulse(context, 2.4);
  lfo.start();
  chorusLfo.frequency.value = 0.7;
  chorusMod.gain.value = 0.004;
  chorusLfo.connect(chorusMod).connect(chorusDelay.delayTime);
  chorusLfo.start();

  input.connect(filter).connect(drive);
  drive.connect(master);
  drive.connect(chorusDelay).connect(chorusWet).connect(master);
  drive.connect(delay).connect(delayWet).connect(master);
  delay.connect(delayFeedback).connect(delay);
  drive.connect(reverb).connect(reverbWet).connect(master);
  master.connect(analyser).connect(context.destination);
  master.connect(recorderDestination);
  lfo.connect(lfoGain);
  state.audio = { context, input, filter, drive, chorusWet, delayWet, reverbWet, master, analyser, lfo, lfoGain, recorderDestination };
  syncAudio();
  return state.audio;
}

function createImpulse(context, duration) {
  const impulse = context.createBuffer(2, context.sampleRate * duration, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / data.length, 2.4);
  }
  return impulse;
}

function makeDistortion(amount) {
  const curve = new Float32Array(256);
  const k = amount * 3;
  for (let i = 0; i < curve.length; i += 1) { const x = i * 2 / curve.length - 1; curve[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
  return curve;
}

function syncAudio() {
  if (!state.audio) return;
  const a = state.audio;
  a.filter.type = $('#filter-type').value;
  a.filter.frequency.value = value('cutoff');
  a.filter.Q.value = value('resonance');
  a.drive.curve = makeDistortion($('#distortion-on').checked ? value('distortion') + value('drive') : value('drive'));
  a.chorusWet.gain.value = $('#chorus-on').checked ? value('chorus') / 100 : 0;
  a.delayWet.gain.value = $('#delay-on').checked ? value('delay') / 100 : 0;
  a.reverbWet.gain.value = $('#reverb-on').checked ? value('reverb') / 100 : 0;
  a.master.gain.value = value('master') / 100;
  a.lfo.type = $('#lfo-shape').value;
  a.lfo.frequency.value = value('lfo-rate');
  a.lfoGain.disconnect();
  if ($('#lfo-target').value === 'cutoff') { a.lfoGain.gain.value = value('lfo-depth') * 35; a.lfoGain.connect(a.filter.frequency); }
  if ($('#lfo-target').value === 'level') { a.lfoGain.gain.value = value('lfo-depth') / 500; a.lfoGain.connect(a.master.gain); }
}

function midiToFrequency(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
function play(note) {
  const a = createAudio();
  if (state.voices.has(note)) return;
  const now = a.context.currentTime;
  const voiceGain = a.context.createGain();
  voiceGain.gain.setValueAtTime(0.0001, now);
  voiceGain.gain.exponentialRampToValueAtTime(0.72, now + value('attack'));
  voiceGain.gain.exponentialRampToValueAtTime(Math.max(0.001, value('sustain') * 0.72), now + value('attack') + value('decay'));
  voiceGain.connect(a.input);
  const nodes = [];
  state.oscillators.forEach(config => {
    if (!config.enabled) return;
    const oscillator = a.context.createOscillator();
    const gain = a.context.createGain();
    const pan = a.context.createStereoPanner();
    oscillator.type = config.wave;
    oscillator.frequency.value = midiToFrequency(12 * (state.octave + 1) + note + config.octave * 12 + config.semi);
    oscillator.detune.value = config.detune;
    gain.gain.value = config.level / 220;
    pan.pan.value = config.pan / 100;
    oscillator.connect(gain).connect(pan).connect(voiceGain);
    if ($('#lfo-target').value === 'pitch') { a.lfoGain.gain.value = value('lfo-depth') / 2; a.lfoGain.connect(oscillator.detune); }
    oscillator.start();
    nodes.push(oscillator);
  });
  const cutoff = value('cutoff');
  const filterPeak = Math.max(80, Math.min(18000, cutoff + value('filter-env') * 75));
  a.filter.frequency.cancelScheduledValues(now);
  a.filter.frequency.setValueAtTime(cutoff, now);
  a.filter.frequency.linearRampToValueAtTime(filterPeak, now + value('attack'));
  a.filter.frequency.linearRampToValueAtTime(cutoff, now + value('attack') + value('decay'));
  state.voices.set(note, { nodes, voiceGain });
  setActiveKey(note, true);
  updateVoiceCount();
}
function stop(note) {
  const voice = state.voices.get(note);
  if (!voice || !state.audio) return;
  const now = state.audio.context.currentTime;
  voice.voiceGain.gain.cancelScheduledValues(now);
  voice.voiceGain.gain.setValueAtTime(Math.max(0.0001, voice.voiceGain.gain.value), now);
  voice.voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + value('release'));
  voice.nodes.forEach(node => node.stop(now + value('release') + 0.03));
  state.voices.delete(note);
  setActiveKey(note, false);
  updateVoiceCount();
}
function panic() { [...state.voices.keys()].forEach(stop); }
function setActiveKey(note, active) { document.querySelector(`[data-note="${note}"]`)?.classList.toggle('active', active); document.querySelector(`[data-preview-note="${note}"]`)?.classList.toggle('active', active); }
function updateVoiceCount() { $('#voice-count').textContent = state.voices.size; }

function drawWave(canvas, wave, color) {
  const c = canvas.getContext('2d'); const width = canvas.width; const height = canvas.height;
  c.clearRect(0, 0, width, height); c.strokeStyle = color; c.lineWidth = 2; c.shadowColor = color; c.shadowBlur = 9; c.beginPath();
  for (let x = 0; x < width; x += 1) { const phase = (x / width) * Math.PI * 7; let y = Math.sin(phase); if (wave === 'square') y = Math.sign(y); if (wave === 'triangle') y = 2 * Math.asin(Math.sin(phase)) / Math.PI; if (wave === 'sawtooth') y = 2 * ((phase / (Math.PI * 2)) % 1) - 1; const py = height / 2 - y * height * 0.31; x ? c.lineTo(x, py) : c.moveTo(x, py); }
  c.stroke();
}
function drawEnvelope() {
  const canvas = $('#env-graph'); const c = canvas.getContext('2d'); const w = canvas.width; const h = canvas.height; const sustain = value('sustain');
  c.clearRect(0, 0, w, h); c.strokeStyle = '#4de5ff'; c.lineWidth = 2; c.shadowColor = '#4de5ff'; c.shadowBlur = 7; c.beginPath(); c.moveTo(0, h - 8); c.lineTo(w * 0.16, 10); c.lineTo(w * 0.48, h - 8 - sustain * (h - 20)); c.lineTo(w * 0.76, h - 8 - sustain * (h - 20)); c.lineTo(w, h - 8); c.stroke();
}
function drawLfo() { const canvas = $('#lfo-graph'); drawWave(canvas, $('#lfo-shape').value, '#a779ff'); }
function drawFilter() {
  const canvas = $('#filter-graph'); const c = canvas.getContext('2d'); const w = canvas.width; const h = canvas.height; const position = Math.log(value('cutoff') / 80) / Math.log(18000 / 80); const type = $('#filter-type').value;
  c.clearRect(0, 0, w, h); c.strokeStyle = '#4de5ff'; c.lineWidth = 2; c.shadowColor = '#4de5ff'; c.shadowBlur = 8; c.beginPath();
  for (let x = 0; x < w; x += 1) { const nx = x / w; let y = 22; if (type === 'lowpass') y = 20 + Math.pow(Math.max(0, (nx - position) / Math.max(0.05, 1 - position)), 2) * (h - 28); if (type === 'highpass') y = 20 + Math.pow(Math.max(0, (position - nx) / Math.max(0.05, position)), 2) * (h - 28); if (type === 'bandpass') y = 20 + Math.min(1, Math.abs(nx - position) * 5) * (h - 28); if (type === 'notch') y = 20 + Math.exp(-Math.pow((nx - position) * 18, 2)) * (h - 28); x ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.stroke();
}
function drawScope() {
  const canvas = $('#scope'); const c = canvas.getContext('2d'); const data = new Uint8Array(512);
  requestAnimationFrame(drawScope); c.clearRect(0, 0, canvas.width, canvas.height); c.strokeStyle = '#4de5ff'; c.lineWidth = 1.5; c.shadowColor = '#4de5ff'; c.shadowBlur = 7; c.beginPath();
  if (state.audio) state.audio.analyser.getByteTimeDomainData(data);
  for (let x = 0; x < canvas.width; x += 1) { const y = state.audio ? data[Math.floor(x / canvas.width * data.length)] / 256 * canvas.height : canvas.height / 2 + Math.sin(x / 20) * 7; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
}

function noteLabel(note) { return `${noteNames[note % 12]}${state.octave + Math.floor(note / 12)}`; }
function fillKeyboard(keyboard, count, preview = false) {
  keyboard.innerHTML = '';
  for (let note = 0; note < count; note += 1) { const key = document.createElement('div'); key.className = `key ${blackNotes.has(note % 12) ? 'black' : 'white'}`; key.dataset[preview ? 'previewNote' : 'note'] = note; key.innerHTML = `<span>${noteLabel(note)}</span>`; key.title = noteLabel(note); key.onpointerdown = () => play(note); key.onpointerup = () => stop(note); key.onpointerleave = () => stop(note); keyboard.appendChild(key); }
}
function buildKeyboard() { fillKeyboard($('#keyboard'), 25); fillKeyboard($('#preview-keyboard'), 25, true); }
function refreshKeyboardLabels() { $$('.key[data-note], .key[data-preview-note]').forEach(key => { const note = Number(key.dataset.note ?? key.dataset.previewNote); key.querySelector('span').textContent = noteLabel(note); key.title = noteLabel(note); }); }

function updateOutputs() {
  const outputs = { cutoff: `${Math.round(value('cutoff'))} Hz`, resonance: value('resonance').toFixed(1), drive: `${value('drive')}%`, 'filter-env': `${value('filter-env')}%`, attack: `${value('attack').toFixed(2)} s`, decay: `${value('decay').toFixed(2)} s`, sustain: `${Math.round(value('sustain') * 100)}%`, release: `${value('release').toFixed(2)} s`, 'lfo-rate': `${value('lfo-rate').toFixed(2)} Hz`, 'lfo-depth': `${value('lfo-depth')}%`, master: `${value('master')}%` };
  Object.entries(outputs).forEach(([id, text]) => $(`#${id}-out`).textContent = text);
  drawEnvelope(); drawFilter(); drawLfo(); syncAudio();
}
function buildMatrix() { $('#matrix').innerHTML = [['LFO 1', 'FILTER CUTOFF'], ['ENV 1', 'AMP LEVEL'], ['MACRO 1', 'BRIGHTNESS']].map(([source, target]) => `<div><b>${source} → ${target}</b>ACTIVE ROUTING</div>`).join(''); }
function loadPatch(patch) {
  panic(); state.activePatchCategory = instrumentTypes.includes(patch.category) ? patch.category : 'Custom'; state.oscillators = patch.oscillators.map(osc => ({ ...osc })); buildOscillators();
  const ids = ['cutoff', 'resonance', 'drive', 'filterEnv', 'attack', 'decay', 'sustain', 'release', 'chorus', 'delay', 'reverb', 'distortion', 'lfoRate', 'lfoDepth', 'master'];
  ids.forEach(id => { const htmlId = id.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`); if ($(`#${htmlId}`) && patch[id] !== undefined) $(`#${htmlId}`).value = patch[id]; });
  $('#lfo-shape').value = patch.lfoShape; $('#lfo-target').value = patch.lfoTarget; updateOutputs();
}
function currentPatch(name = 'USER — Custom Patch') {
  return { name, category: state.activePatchCategory, cutoff: value('cutoff'), resonance: value('resonance'), drive: value('drive'), filterEnv: value('filter-env'), attack: value('attack'), decay: value('decay'), sustain: value('sustain'), release: value('release'), chorus: value('chorus'), delay: value('delay'), reverb: value('reverb'), distortion: value('distortion'), lfoShape: $('#lfo-shape').value, lfoTarget: $('#lfo-target').value, lfoRate: value('lfo-rate'), lfoDepth: value('lfo-depth'), master: value('master'), oscillators: state.oscillators.map(osc => ({ ...osc })) };
}
function populatePresets() {
  const select = $('#preset'); select.innerHTML = '';
  factoryPresets.forEach((patch, index) => select.add(new Option(`${String(index + 1).padStart(3, '0')}  ${patch.name}  [${patch.category}]`, `factory-${index}`)));
  const saved = getUserPatches();
  saved.forEach((patch, index) => select.add(new Option(`USER  ${patch.name}`, `user-${index}`)));
  $('#preset-total').textContent = factoryPresets.length;
  const categories = ['All', ...instrumentTypes.filter(category => allNebulaPatches().some(item => item.patch.category === category))]; const currentCategory = $('#preset-category').value; $('#preset-category').innerHTML = categories.map(category => `<option value="${category}">${category === 'All' ? 'ALL CATEGORIES' : category.toUpperCase()}</option>`).join(''); $('#preset-category').value = categories.includes(currentCategory) ? currentCategory : 'All';
}
function resolvePresetReference(reference) { const [type, rawIndex] = reference.split('-'); const index = Number(rawIndex); const patch = type === 'factory' ? factoryPresets[index] : type === 'user' ? getUserPatches()[index] : null; if (!patch) throw new Error('Preset reference could not be resolved'); return patch; }
function selectedPatch() { return resolvePresetReference($('#preset').value); }

const userPatchKey = 'nebula-studio-exclusive-patches';
function getUserPatches() { return JSON.parse(localStorage.getItem(userPatchKey) || '[]').map(patch => ({ ...patch, category: instrumentTypes.includes(patch.category) ? patch.category : 'Custom' })); }
function setUserPatches(patches) { localStorage.setItem(userPatchKey, JSON.stringify(patches)); }
function normalizePatch(patch) {
  if (!patch || typeof patch !== 'object' || !Array.isArray(patch.oscillators) || patch.oscillators.length !== 3) throw new Error('Preset must contain exactly three oscillators');
  const numeric = ['cutoff', 'resonance', 'drive', 'filterEnv', 'attack', 'decay', 'sustain', 'release', 'chorus', 'delay', 'reverb', 'distortion', 'lfoRate', 'lfoDepth', 'master'];
  if (!numeric.every(key => Number.isFinite(Number(patch[key])))) throw new Error('Preset contains invalid parameter values');
  const waves = ['sawtooth', 'square', 'triangle', 'sine'];
  if (!patch.oscillators.every(osc => osc && waves.includes(osc.wave) && ['octave', 'semi', 'detune', 'level', 'pan'].every(key => Number.isFinite(Number(osc[key]))))) throw new Error('Preset contains an invalid oscillator');
  return { ...patch, name: String(patch.name || 'Imported Nebula Patch').slice(0, 80), category: instrumentTypes.includes(patch.category) ? patch.category : 'Custom', oscillators: patch.oscillators.map(osc => ({ enabled: Boolean(osc.enabled), wave: osc.wave, octave: Number(osc.octave), semi: Number(osc.semi), detune: Number(osc.detune), level: Number(osc.level), pan: Number(osc.pan) })) };
}
function downloadPresetFile() { const patch = normalizePatch(currentPatch($('#preset option:checked')?.textContent.trim() || 'Nebula Studio Patch')); const blob = new Blob([JSON.stringify({ format: presetFileFormat, version: presetFileVersion, patch }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${patch.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'nebula-preset'}.nebula.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); showToast('Nebula preset file exported'); }
async function importPresetFiles(files) { let imported = 0; const saved = getUserPatches(); for (const file of files) { try { const payload = JSON.parse(await file.text()); if (payload.format !== presetFileFormat || payload.version !== presetFileVersion) throw new Error('Not a Nebula Studio preset file'); saved.push(normalizePatch(payload.patch)); imported += 1; } catch (error) { showToast(`${file.name}: ${error.message}`); } } if (imported) { setUserPatches(saved); populatePresets(); renderPresetLoader(); showToast(`${imported} Nebula preset file${imported === 1 ? '' : 's'} imported`); } $('#preset-file').value = ''; }
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600); }
function allNebulaPatches() { return [...factoryPresets.map((patch, index) => ({ patch, type: 'factory', index })), ...getUserPatches().map((patch, index) => ({ patch, type: 'user', index }))]; }
function renderPresetFolders() {
  const folders = ['All', ...instrumentTypes.filter(folder => allNebulaPatches().some(item => item.patch.category === folder))];
  $('#instrument-folders').innerHTML = folders.map(folder => { const count = allNebulaPatches().filter(item => folder === 'All' || item.patch.category === folder).length; return `<button class="folder-button ${folder === state.loaderCategory ? 'active' : ''}" data-folder="${folder}">▸ ${folder.toUpperCase()} <span>${count}</span></button>`; }).join('');
  $$('[data-folder]').forEach(button => button.onclick = () => { state.loaderCategory = button.dataset.folder; $('#preset-category').value = state.loaderCategory; renderPresetLoader(); });
}
function renderPresetLoader() {
  const search = $('#preset-search').value.trim().toLowerCase(); const category = state.loaderCategory;
  const matches = allNebulaPatches().filter(item => (state.loaderLibrary === 'all' || state.loaderLibrary === item.type) && (category === 'All' || item.patch.category === category) && `${item.patch.name} ${item.patch.category}`.toLowerCase().includes(search));
  renderPresetFolders();
  $('#loader-count').textContent = `${matches.length} NEBULA PATCHES`;
  $('#preset-list').innerHTML = matches.length ? matches.map(item => `<article class="preset-row"><small>${item.type === 'factory' ? String(item.index + 1).padStart(3, '0') : 'USER'}</small><b>${item.patch.name}</b><em>${item.patch.category}</em><button class="audition-patch" data-audition="${item.type}-${item.index}">AUDITION</button><button data-load="${item.type}-${item.index}">LOAD</button>${item.type === 'user' ? `<button class="delete-patch" data-delete="${item.index}">DELETE</button>` : '<span></span>'}</article>`).join('') : '<p>No Nebula presets match this search.</p>';
  $$('[data-audition]').forEach(button => button.onclick = () => { const reference = button.dataset.audition; const patch = resolvePresetReference(reference); $('#preset').value = reference; loadPatch(patch); $('#preview-name').textContent = patch.name; $$('.preset-row').forEach(row => row.classList.toggle('auditioning', row.contains(button))); showToast(`${patch.name} ready on preview keyboard`); });
  $$('[data-load]').forEach(button => button.onclick = () => { $('#preset').value = button.dataset.load; loadPatch(selectedPatch()); $('#preset-loader').close(); showToast('Nebula preset loaded'); });
  $$('[data-delete]').forEach(button => button.onclick = () => { const saved = getUserPatches(); saved.splice(Number(button.dataset.delete), 1); setUserPatches(saved); populatePresets(); renderPresetLoader(); showToast('Custom preset deleted'); });
}
function openPresetLoader() { renderPresetLoader(); $('#preset-loader').showModal(); }
function updateRecordClock() { const elapsed = Math.floor((Date.now() - state.recording.startedAt) / 1000); $('#record-time').textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`; }
function startRecording() {
  const audio = createAudio();
  if (!window.MediaRecorder) { showToast('Audio recording is not supported in this browser'); return; }
  const preferred = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type)) || '';
  state.recording.chunks = []; state.recording.blob = null;
  state.recording.recorder = preferred ? new MediaRecorder(audio.recorderDestination.stream, { mimeType: preferred }) : new MediaRecorder(audio.recorderDestination.stream);
  state.recording.recorder.ondataavailable = event => { if (event.data.size) state.recording.chunks.push(event.data); };
  state.recording.recorder.onstop = () => { state.recording.blob = new Blob(state.recording.chunks, { type: state.recording.recorder.mimeType }); $('#export-recording').disabled = false; $('#record-status').textContent = 'TAKE READY'; showToast('Recording ready to export'); };
  state.recording.recorder.start(); state.recording.startedAt = Date.now(); updateRecordClock(); state.recording.timer = setInterval(updateRecordClock, 500);
  $('#record').disabled = true; $('#stop-record').disabled = false; $('#export-recording').disabled = true; $('#record-dot').classList.add('live'); $('#record-status').textContent = 'RECORDING SYNTH OUTPUT';
}
function stopRecording() {
  if (!state.recording.recorder || state.recording.recorder.state === 'inactive') return;
  state.recording.recorder.stop(); clearInterval(state.recording.timer); $('#record').disabled = false; $('#stop-record').disabled = true; $('#record-dot').classList.remove('live');
}
function exportRecording() {
  if (!state.recording.blob) return;
  const extension = state.recording.blob.type.includes('ogg') ? 'ogg' : 'webm'; const link = document.createElement('a'); link.href = URL.createObjectURL(state.recording.blob); link.download = `nebula-studio-take-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); showToast(`Exported Nebula audio .${extension}`);
}

buildOscillators(); buildKeyboard(); buildMatrix(); populatePresets(); loadPatch(factoryPresets[0]); drawScope();
$$('input, select').filter(element => !element.id.startsWith('osc-') && element.id !== 'preset').forEach(element => element.addEventListener('input', updateOutputs));
$('#preset').addEventListener('change', () => loadPatch(selectedPatch()));
$('#prev-preset').onclick = () => { $('#preset').selectedIndex = Math.max(0, $('#preset').selectedIndex - 1); loadPatch(selectedPatch()); };
$('#next-preset').onclick = () => { $('#preset').selectedIndex = Math.min($('#preset').options.length - 1, $('#preset').selectedIndex + 1); loadPatch(selectedPatch()); };
$('#randomize').onclick = () => { const patch = factoryPresets[Math.floor(Math.random() * factoryPresets.length)]; loadPatch(patch); };
$('#save-patch').onclick = () => { const name = prompt('Name this patch:', 'My Nebula Patch'); if (!name) return; const requestedFolder = prompt(`Instrument folder (${instrumentTypes.join(', ')}):`, 'Lead'); if (!requestedFolder) return; const patch = currentPatch(name); patch.category = instrumentTypes.find(folder => folder.toLowerCase() === requestedFolder.trim().toLowerCase()) || 'Custom'; const saved = getUserPatches(); saved.push(patch); setUserPatches(saved); populatePresets(); $('#preset').value = `user-${saved.length - 1}`; showToast(`Saved in ${patch.category} folder`); };
$('#panic').onclick = panic;
$('#oct-down').onclick = () => { state.octave = Math.max(0, state.octave - 1); $('#octave').textContent = `C${state.octave} — C${state.octave + 2}`; refreshKeyboardLabels(); };
$('#oct-up').onclick = () => { state.octave = Math.min(7, state.octave + 1); $('#octave').textContent = `C${state.octave} — C${state.octave + 2}`; refreshKeyboardLabels(); };
$('#macro-bright').oninput = event => { $('#cutoff').value = 180 + Math.pow(event.target.value / 100, 2) * 15000; updateOutputs(); };
$('#macro-space').oninput = event => { $('#reverb').value = event.target.value * 0.72; $('#delay').value = event.target.value * 0.44; updateOutputs(); };
$('#macro-motion').oninput = event => { $('#lfo-depth').value = event.target.value; updateOutputs(); };
$('#macro-grit').oninput = event => { $('#distortion-on').checked = true; $('#distortion').value = event.target.value; updateOutputs(); };
$('#open-loader').onclick = openPresetLoader;
$('#close-loader').onclick = () => $('#preset-loader').close();
$('#preset-search').oninput = renderPresetLoader;
$('#import-preset').onclick = () => $('#preset-file').click();
$('#preset-file').onchange = event => importPresetFiles([...event.target.files]);
$('#export-preset').onclick = downloadPresetFile;
$('#preset-category').onchange = event => { state.loaderCategory = event.target.value; renderPresetLoader(); };
$$('.library-tab').forEach(button => button.onclick = () => { $$('.library-tab').forEach(tab => tab.classList.toggle('active', tab === button)); state.loaderLibrary = button.dataset.library; renderPresetLoader(); });
$('#record').onclick = startRecording;
$('#stop-record').onclick = stopRecording;
$('#export-recording').onclick = exportRecording;
window.addEventListener('keydown', event => { if (!event.repeat && keyboardMap[event.key] !== undefined) play(keyboardMap[event.key]); });
window.addEventListener('keyup', event => { if (keyboardMap[event.key] !== undefined) stop(keyboardMap[event.key]); });
