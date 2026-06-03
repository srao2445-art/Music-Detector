import { DrumAudioEngine, MODULES, createDefaultState } from './audio-engine.js';
import { $, bindTabs, fmt, label, setPressed } from './ui.js';
import { PresetManager, BUILT_IN_PRESETS, downloadJson, normalizePattern } from './preset-manager.js';
import { DrumSequencer } from './sequencer.js';
import { ExportRenderer } from './export-renderer.js';

const engine = new DrumAudioEngine();
const presets = new PresetManager();
let state = presets.normalize({ ...createDefaultState(), sequence: undefined });
let undoStack = [], redoStack = [], abState = null;
const renderer = new ExportRenderer(() => state);
const sequencer = new DrumSequencer({ engine, getState: () => state, onStep: paintPlayhead, onChange: () => { saveHistory(); renderSequencer(); persist(); } });

const soundControls = $('#soundControls'), fxControls = $('#fxControls'), moduleList = $('#moduleList');
const envelopeControls = $('#envelopeControls'), modControls = $('#modControls'), layerMixer = $('#layerMixer');

init();
function init() {
  state = presets.loadLocal();
  bindTabs(); buildModules(); buildPresetList(); bindTopControls(); renderAll(); animateMeters(); bindShortcuts();
}

function active() { return state.modules[state.activeModule]; }
function saveHistory() { undoStack.push(JSON.stringify(state)); if (undoStack.length > 60) undoStack.shift(); redoStack = []; }
function persist() { presets.saveLocal(state); }
function change(mutator, rerender = true) { saveHistory(); mutator(); applyMacros(); if (rerender) renderAll(); persist(); }

function buildModules() {
  moduleList.innerHTML = '';
  Object.entries(MODULES).forEach(([id, mod]) => {
    const card = document.createElement('article'); card.className = 'module-card'; card.dataset.id = id;
    card.innerHTML = `<div><strong>${mod.name}</strong><small>${mod.subtitle.split('.')[0]}</small></div><div class="module-actions"><button data-act="mute">M</button><button data-act="solo">S</button></div><button class="module-trigger" data-act="trigger">Tap ${mod.name}</button>`;
    card.addEventListener('click', async e => {
      const act = e.target.dataset.act;
      if (act === 'mute' || act === 'solo') { e.stopPropagation(); change(() => state.modules[id][act === 'mute' ? 'muted' : 'solo'] = !state.modules[id][act === 'mute' ? 'muted' : 'solo']); return; }
      if (id !== state.activeModule) change(() => state.activeModule = id);
      if (act === 'trigger') { e.stopPropagation(); await audition(e.target); }
    });
    moduleList.appendChild(card);
  });
}

function renderAll() {
  renderModules(); renderDesigner(); renderFx(); renderSequencer(); syncHeader(); drawWaveformPreview();
}
function renderModules() {
  [...moduleList.children].forEach(card => {
    const id = card.dataset.id; card.classList.toggle('active', id === state.activeModule);
    card.querySelector('[data-act="mute"]').classList.toggle('active', state.modules[id].muted);
    card.querySelector('[data-act="solo"]').classList.toggle('active', state.modules[id].solo);
  });
}
function renderDesigner() {
  const mod = MODULES[state.activeModule]; $('#activeTitle').textContent = `${mod.name} Designer`; $('#moduleSubtitle').textContent = mod.subtitle;
  soundControls.innerHTML = ''; envelopeControls.innerHTML = ''; modControls.innerHTML = ''; layerMixer.innerHTML = '';
  Object.entries(mod.params).forEach(([key, spec]) => soundControls.appendChild(controlFor(`params.${key}`, label(key), spec, active().params[key])));
  [['attack',[0,0.25,active().env.attack]], ['decay',[0.01,2,active().env.decay]], ['sustain',[0,1,active().env.sustain]], ['release',[0.01,2.5,active().env.release]], ['velocity',[0,1,active().env.velocity]]].forEach(([k,s]) => envelopeControls.appendChild(controlFor(`env.${k}`, label(k), s, active().env[k])));
  [['pitchEnv',[0,1,active().env.pitchEnv]], ['filterEnv',[0,1,active().env.filterEnv]]].forEach(([k,s]) => modControls.appendChild(controlFor(`env.${k}`, label(k), s, active().env[k])));
  Object.entries(active().layers).forEach(([name, cfg]) => {
    const row = document.createElement('div'); row.className = 'layer-row'; row.innerHTML = `<strong>${label(name)}</strong><button data-act="mute">Mute</button><button data-act="solo">Solo</button><input type="range" min="0" max="1" step="0.01" value="${cfg.gain}">`;
    row.querySelector('[data-act="mute"]').classList.toggle('active', cfg.mute); row.querySelector('[data-act="solo"]').classList.toggle('active', cfg.solo);
    row.querySelector('[data-act="mute"]').onclick = () => change(() => cfg.mute = !cfg.mute);
    row.querySelector('[data-act="solo"]').onclick = () => change(() => cfg.solo = !cfg.solo);
    row.querySelector('input').oninput = e => change(() => cfg.gain = Number(e.target.value), false);
    layerMixer.appendChild(row);
  });
}

function renderFx() {
  fxControls.innerHTML = '';
  const specs = { eqLow: [-1,1], eqMid: [-1,1], eqHigh: [-1,1], compressor: [0,1], saturation: [0,1], bitcrush: [0,1], transient: [0,1], reverb: [0,1], delay: [0,1], delayFeedback: [0,0.75], softClip: [0,1], limiter: [0,1], output: [0,1.2] };
  Object.entries(specs).forEach(([key, range]) => fxControls.appendChild(controlFor(`fx.${key}`, label(key), [range[0], range[1], active().fx[key]], active().fx[key], 'fx-card')));
}

function controlFor(path, name, spec, value, cls = 'knob') {
  const card = document.createElement('div');
  if (typeof spec[0] === 'string') {
    card.className = 'switch-card'; const options = spec.slice(0, -1).map(o => `<option ${value === o ? 'selected' : ''}>${o}</option>`).join('');
    card.innerHTML = `<span>${name}</span><select>${options}</select>`; card.querySelector('select').onchange = e => updatePath(path, e.target.value); return card;
  }
  const [min,max] = spec; const step = max - min > 20 ? 1 : 0.01; card.className = cls; card.innerHTML = `<header><span>${name}</span><output>${fmt(value)}</output></header><input type="range" min="${min}" max="${max}" step="${step}" value="${value}">`;
  card.querySelector('input').oninput = e => { card.querySelector('output').textContent = fmt(e.target.value); updatePath(path, Number(e.target.value), false); };
  card.querySelector('input').onchange = () => { persist(); drawWaveformPreview(); };
  return card;
}
function updatePath(path, value, rerender = true) { change(() => { const [group, key] = path.split('.'); active()[group][key] = value; }, rerender); }
function bindTopControls() {
  $('#bpm').onchange = e => change(() => state.bpm = Number(e.target.value));
  $('#swing').oninput = e => change(() => state.swing = Number(e.target.value), false);
  $('#masterVolume').oninput = e => change(() => { state.masterVolume = Number(e.target.value); engine.setMaster(state.masterVolume); }, false);
  $('#playStop').onclick = async () => { await sequencer.togglePlay(); $('#playStop').textContent = sequencer.running ? '■ Stop Loop' : '▶ Play Loop'; };
  $('#panic').onclick = () => { sequencer.stop(); $('#playStop').textContent = '▶ Play Loop'; engine.resetLimiter(); };
  $('#audition').onclick = e => audition(e.currentTarget);
  $('#previewDry').onclick = () => { engine.setWet(false); $('#previewDry').classList.add('active'); $('#previewWet').classList.remove('active'); audition($('#audition')); };
  $('#previewWet').onclick = () => { engine.setWet(true); $('#previewWet').classList.add('active'); $('#previewDry').classList.remove('active'); audition($('#audition')); };
  $('#bypassFx').onclick = () => { engine.setWet(!engine.previewWet); $('#bypassFx').classList.toggle('active', !engine.previewWet); };
  $('#randomPreset').onclick = () => change(randomizeActive);
  $('#humanize').onclick = () => sequencer.humanize(); $('#clearPattern').onclick = () => sequencer.clear();
  $('#stepCount').onchange = e => sequencer.setSteps(Number(e.target.value));
  $('#savePattern').onclick = () => downloadJson(state.sequence, 'drumforge-pattern-save.json');
  $('#loadPattern').onclick = () => $('#presetFile').click();
  $('#savePreset').onclick = () => presets.exportJson(state, 'drumforge-custom-preset'); $('#exportPreset').onclick = () => presets.exportJson(state, 'drumforge-preset');
  $('#importPreset').onclick = () => $('#presetFile').click(); $('#presetFile').onchange = importFile;
  $('#loadPreset').onclick = () => loadBuiltIn($('#presetSelect').value);
  $('#exportSound').onclick = () => renderer.renderSound(state.activeModule); $('#exportLoop').onclick = () => renderer.renderLoop(); $('#exportPattern').onclick = () => renderer.exportPattern(); $('#exportMidi').onclick = () => renderer.exportMidi();
  $('#abSwap').onclick = () => { const cur = JSON.stringify(state); if (abState) state = presets.normalize(JSON.parse(abState)); abState = cur; renderAll(); persist(); };
  $('#undo').onclick = () => restore(undoStack, redoStack); $('#redo').onclick = () => restore(redoStack, undoStack);
  ['macroPower','macroSpace','macroDirt'].forEach(id => $(`#${id}`).oninput = e => change(() => state.macros[id.replace('macro','').toLowerCase()] = Number(e.target.value), false));
}
function syncHeader() { $('#bpm').value = state.bpm; $('#swing').value = state.swing; $('#masterVolume').value = state.masterVolume; $('#stepCount').value = state.stepCount; $('#macroPower').value = state.macros.power; $('#macroSpace').value = state.macros.space; $('#macroDirt').value = state.macros.dirt; }
function restore(from, to) { if (!from.length) return; to.push(JSON.stringify(state)); state = presets.normalize(JSON.parse(from.pop())); renderAll(); persist(); }
function buildPresetList() { $('#presetSelect').innerHTML = BUILT_IN_PRESETS.map((p,i) => `<option value="${i}">${p.name}</option>`).join(''); }
function loadBuiltIn(index) { change(() => state = presets.normalize(BUILT_IN_PRESETS[Number(index)].state)); }
async function importFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const raw = JSON.parse(await file.text());
  change(() => {
    if (raw.format?.includes('Pattern') || raw.channels || raw.sequence?.channels) state.sequence = normalizePattern(raw.sequence || raw, raw.stepCount || state.stepCount);
    else state = presets.normalize(raw.state || raw);
  });
  e.target.value = '';
}

async function audition(source = $('#audition')) {
  setPressed(source, true);
  const velocity = Number($('#auditionVelocity')?.value || 0.9);
  await engine.init();
  engine.setMaster(state.masterVolume);
  await engine.trigger(active(), velocity);
}

function randomizeActive() {
  const mod = MODULES[state.activeModule];
  Object.entries(mod.params).forEach(([key, spec]) => { if (typeof spec[0] !== 'string') active().params[key] = spec[0] + Math.random() * (spec[1] - spec[0]); });
  Object.keys(active().fx).forEach(k => active().fx[k] = Math.max(0, Math.min(1, active().fx[k] + (Math.random() - .5) * .5)));
  audition($('#audition'));
}
function applyMacros() {
  const m = state.macros; const a = active();
  if ('drive' in a.params) a.params.drive = Math.min(1, a.params.drive + m.dirt * .002);
  if ('distortion' in a.params) a.params.distortion = Math.min(1, a.params.distortion + m.dirt * .002);
  a.fx.reverb = Math.min(1, a.fx.reverb + m.space * .001); a.fx.saturation = Math.min(1, a.fx.saturation + m.dirt * .001); a.fx.compressor = Math.min(1, a.fx.compressor + m.power * .001);
}

function renderSequencer() {
  const grid = $('#sequencerGrid'); const pattern = sequencer.ensurePattern(); grid.style.setProperty('--steps', state.stepCount); grid.innerHTML = '';
  Object.entries(MODULES).forEach(([id, mod]) => {
    const row = document.createElement('div'); row.className = 'seq-row';
    row.innerHTML = `<div class="channel-cell"><strong>${mod.name}</strong><button data-act="mute">M</button><button data-act="solo">S</button></div>`;
    row.querySelector('[data-act="mute"]').classList.toggle('active', pattern.channels[id].mute); row.querySelector('[data-act="solo"]').classList.toggle('active', pattern.channels[id].solo);
    row.querySelector('[data-act="mute"]').onclick = () => sequencer.channelMute(id); row.querySelector('[data-act="solo"]').onclick = () => sequencer.channelSolo(id);
    for (let i = 0; i < state.stepCount; i++) {
      const st = pattern.channels[id].steps[i]; const cell = document.createElement('button'); cell.className = `step ${st.on ? 'active' : ''}`; cell.dataset.step = i; cell.dataset.channel = id; cell.title = `${mod.name} step ${i + 1}: click toggles, drag changes velocity`;
      cell.innerHTML = `<span class="velocity" style="height:${st.velocity * 100}%"></span>`;
      cell.onclick = () => sequencer.toggle(id, i);
      cell.oncontextmenu = e => { e.preventDefault(); sequencer.setVelocity(id, i, Math.max(.1, st.velocity - .15)); renderSequencer(); };
      cell.onpointermove = e => { if (e.buttons === 1) { const r = cell.getBoundingClientRect(); sequencer.setVelocity(id, i, 1 - (e.clientY - r.top) / r.height); renderSequencer(); } };
      row.appendChild(cell);
    }
    grid.appendChild(row);
  });
}
function paintPlayhead(step) { document.querySelectorAll('.step').forEach(el => el.classList.toggle('playing', Number(el.dataset.step) === step)); }

function bindShortcuts() {
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,select')) return;
    if (e.code === 'Space') { e.preventDefault(); audition($('#audition')); }
    if (e.key === 'Enter') { e.preventDefault(); $('#playStop').click(); }
    if (e.key === 'p') audition($('#audition'));
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') restore(undoStack, redoStack);
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') restore(redoStack, undoStack);
  });
}

function animateMeters() {
  requestAnimationFrame(animateMeters);
  if (!engine.analyser) return;
  drawAnalyser($('#oscilloscope'), engine.analyser, false); drawAnalyser($('#spectrum'), engine.analyser, true); drawMeter();
}
function drawAnalyser(canvas, analyser, spectrum) {
  const ctx = canvas.getContext('2d'); const w = canvas.width, h = canvas.height; ctx.clearRect(0,0,w,h); ctx.fillStyle = '#05080d'; ctx.fillRect(0,0,w,h); ctx.strokeStyle = spectrum ? '#00e0ff' : '#7c5cff'; ctx.beginPath();
  if (spectrum) { const data = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(data); data.forEach((v,i) => { const x = i / data.length * w; const y = h - v / 255 * h; i ? ctx.lineTo(x,y) : ctx.moveTo(x,y); }); }
  else { const data = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(data); data.forEach((v,i) => { const x = i / data.length * w; const y = v / 255 * h; i ? ctx.lineTo(x,y) : ctx.moveTo(x,y); }); }
  ctx.stroke();
}
function drawMeter() {
  const c = $('#meter'), cx = c.getContext('2d'), data = new Uint8Array(engine.meter.frequencyBinCount); engine.meter.getByteTimeDomainData(data); const rms = Math.sqrt(data.reduce((a,v) => a + ((v-128)/128)**2,0)/data.length);
  cx.clearRect(0,0,c.width,c.height); cx.fillStyle = '#05080d'; cx.fillRect(0,0,c.width,c.height); cx.fillStyle = rms > .85 ? '#ff4d7d' : '#28e9a3'; cx.fillRect(0,0,c.width * Math.min(1,rms*1.6),c.height);
}
function drawWaveformPreview() {
  const c = $('#waveform'), ctx = c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle = '#05080d'; ctx.fillRect(0,0,c.width,c.height); ctx.strokeStyle = '#28e9a3'; ctx.beginPath();
  const p = active().params; for (let x = 0; x < c.width; x++) { const n = x / c.width; const amp = Math.exp(-n * 7 / Math.max(.2, p.decay || p.tail || .8)); const y = c.height/2 + Math.sin(n * 80 * Math.PI) * amp * c.height * .42; x ? ctx.lineTo(x,y) : ctx.moveTo(x,y); } ctx.stroke();
}
