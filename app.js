/* PulseForge Visualizer Studio - vanilla Web Audio + Canvas + WebM export. */
const canvas = document.getElementById('visualizerCanvas');
const ctx = canvas.getContext('2d');

const aspectRatios = {
  '16:9 YouTube': [16, 9],
  '9:16 Shorts/Reels': [9, 16],
  '1:1 Square': [1, 1],
  '4:5 Instagram': [4, 5]
};
const resolutions = {
  '720p': 720,
  '1080p': 1080,
  '1440p': 1440,
  '4K': 2160
};
const blendModes = ['source-over', 'screen', 'lighter', 'overlay', 'multiply', 'soft-light'];

let audioContext;
let analyser;
let gainNode;
let bassFilter;
let mediaDestination;
let audioBuffer;
let sourceNode;
let audioFile;
let audioFileName = '';
let isPlaying = false;
let startedAt = 0;
let pausedAt = 0;
let animationId;
let exporting = false;
let mediaRecorder;
let exportAbort = false;
let selectedLayerId = null;
let activeTab = 'global';
let backgroundImage = null;
let logoImage = null;
let lastFrameTime = performance.now();

const data = {
  frequency: new Uint8Array(1024),
  waveform: new Uint8Array(2048),
  particles: [],
  bass: 0,
  mids: 0,
  treble: 0,
  level: 0
};

const project = {
  presetName: 'Neon Phonk Circle',
  aspectRatio: '16:9 YouTube',
  resolution: '1080p',
  colors: {
    primary: '#8a4dff',
    secondary: '#00e5ff',
    background: '#070913',
    gradientA: '#12002f',
    gradientB: '#001f3f'
  },
  audio: {
    sensitivity: 1.18,
    smoothing: 0.78,
    gain: 1,
    bassBoost: 0,
    reaction: 1.1,
    bassReaction: 1.25,
    trebleReaction: 0.85
  },
  visual: {
    glowStrength: 32,
    blurAmount: 0,
    spectrumBarCount: 96,
    barWidth: 8,
    barSpacing: 4,
    barHeight: 0.62,
    circularRadius: 0.24,
    rotationSpeed: 0.14,
    waveformThickness: 4,
    waveformStyle: 'mirrored',
    particleCount: 120,
    particleSpeed: 0.38,
    particleSize: 2.4,
    fontSize: 56,
    fontWeight: 800,
    textContent: 'YOUR TRACK',
    textX: 50,
    textY: 78
  },
  export: {
    fileName: 'visualizer-export',
    fps: 30,
    quality: 6000000
  },
  timeline: { start: 0, end: 0, fullSong: true },
  layers: []
};

const presetDefinitions = [
  ['Neon Phonk Circle', 'Radial spectrum, magenta/cyan glow, club pulse', '#ff2bd6', '#00f0ff', 'circle'],
  ['Minimal Album Wave', 'Clean cover area with elegant mirrored waveform', '#f6f2ff', '#9aa3be', 'minimal'],
  ['Spotify Canvas Style', 'Vertical cover motion with soft gradient pulse', '#1ed760', '#49ffd3', 'canvas'],
  ['YouTube Spectrum Bars', 'Wide professional bars for lyric and beat videos', '#ff365e', '#ffd166', 'bars'],
  ['Cinematic Glow Pulse', 'Large bloom, floating title, subtle particles', '#ffb703', '#8ecae6', 'cinema'],
  ['Radial Trap Visualizer', 'Aggressive circular bars and rotating accent shapes', '#bc13fe', '#39ff14', 'trap'],
  ['Dark Club Particles', 'Deep space particles with bass-driven glow', '#7c4dff', '#00e5ff', 'particles'],
  ['Floating Cover Art Pulse', 'Logo/cover focal point with reactive halo', '#ff7a18', '#af00ff', 'cover'],
  ['Cyber Grid Spectrum', 'Futuristic grid with bright equalizer columns', '#00ffcc', '#3677ff', 'cyber'],
  ['Clean Podcast Waveform', 'Readable spoken-audio waveform and title text', '#ffffff', '#35c2ff', 'podcast'],
  ['Vertical Shorts Visualizer', '9:16 social-first radial and text composition', '#ff006e', '#00f5d4', 'shorts'],
  ['Square Music Cover Visualizer', '1:1 release-card layout with bottom spectrum', '#ffd166', '#ef476f', 'square']
];

const $ = id => document.getElementById(id);

function layer(type, name, settings = {}) {
  return {
    id: crypto.randomUUID(),
    type,
    name,
    visible: true,
    opacity: 1,
    blend: 'source-over',
    x: 50,
    y: 50,
    scale: 1,
    rotation: 0,
    reactive: true,
    settings
  };
}

function buildPreset(def) {
  const [name, , primary, secondary, mode] = def;
  project.presetName = name;
  project.colors.primary = primary;
  project.colors.secondary = secondary;
  project.colors.gradientA = shade(primary, -65);
  project.colors.gradientB = shade(secondary, -72);
  project.colors.background = '#060814';
  project.visual.textContent = name.toUpperCase();
  project.aspectRatio = mode === 'shorts' || mode === 'canvas' ? '9:16 Shorts/Reels' : mode === 'square' ? '1:1 Square' : '16:9 YouTube';
  const textLayer = layer('text', 'Title text', { align: 'center' });
  textLayer.x = project.visual.textX;
  textLayer.y = project.visual.textY;
  const common = [
    layer('background', 'Base background color'),
    layer('gradient', 'Atmospheric gradient', { vignette: true }),
    layer('glow', 'Bass glow pulse', { strength: project.visual.glowStrength, radius: 0.42 }),
    layer('particles', 'Depth particles', { count: mode === 'minimal' || mode === 'podcast' ? 35 : 140 }),
    textLayer
  ];
  const maps = {
    circle: [layer('radial', 'Neon radial spectrum', { rings: 2 }), layer('waveform', 'Inner waveform', { style: 'circle' })],
    minimal: [layer('shape', 'Album frame', { shape: 'rounded', fill: 'rgba(255,255,255,0.08)' }), layer('waveform', 'Minimal waveform', { style: 'mirrored' })],
    canvas: [layer('image', 'Floating cover/logo', { source: 'logo' }), layer('waveform', 'Soft vertical wave', { style: 'mirrored' })],
    bars: [layer('spectrum', 'YouTube spectrum bars', { anchor: 'bottom' }), layer('waveform', 'Top shimmer waveform', { style: 'line' })],
    cinema: [layer('glow', 'Cinematic bloom', { strength: 64, radius: 0.55 }), layer('waveform', 'Film wave', { style: 'line' })],
    trap: [layer('radial', 'Trap radial spikes', { rings: 3 }), layer('shape', 'Rotating diamond', { shape: 'diamond', stroke: true })],
    particles: [layer('particles', 'Club particle storm', { count: 220 }), layer('spectrum', 'Low club bars', { anchor: 'bottom' })],
    cover: [layer('image', 'Floating cover/logo', { source: 'logo' }), layer('radial', 'Cover halo spectrum', { rings: 1 })],
    cyber: [layer('shape', 'Cyber grid', { shape: 'grid' }), layer('spectrum', 'Cyber spectrum', { anchor: 'bottom' })],
    podcast: [layer('waveform', 'Podcast waveform', { style: 'filled' }), layer('shape', 'Lower third card', { shape: 'rounded', fill: 'rgba(0,0,0,0.34)' })],
    shorts: [layer('radial', 'Shorts radial visualizer', { rings: 2 }), layer('spectrum', 'Side spectrum bars', { anchor: 'side' })],
    square: [layer('image', 'Square cover/logo', { source: 'logo' }), layer('spectrum', 'Release spectrum', { anchor: 'bottom' })]
  };
  project.layers = [common[0], common[1], ...(maps[mode] || maps.circle), ...common.slice(2)];
  selectedLayerId = project.layers[1]?.id || null;
  seedParticles();
  syncUI();
}

function shade(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

function initUI() {
  Object.keys(aspectRatios).forEach(name => $('aspectRatioSelect').append(new Option(name, name)));
  Object.keys(resolutions).forEach(name => $('resolutionSelect').append(new Option(name, name)));
  $('presetList').innerHTML = presetDefinitions.map(def => `<button class="preset-card" data-preset="${def[0]}"><strong>${def[0]}</strong><small>${def[1]}</small></button>`).join('');
  $('presetList').addEventListener('click', e => {
    const card = e.target.closest('[data-preset]');
    if (card) buildPreset(presetDefinitions.find(p => p[0] === card.dataset.preset));
  });
  $('aspectRatioSelect').onchange = e => { project.aspectRatio = e.target.value; resizeCanvas(); syncExportWarning(); };
  $('resolutionSelect').onchange = e => { project.resolution = e.target.value; resizeCanvas(); syncExportWarning(); };
  $('fitCanvasBtn').onclick = resizeCanvas;
  $('audioUpload').onchange = e => loadAudio(e.target.files[0]);
  $('backgroundUpload').onchange = e => loadImageFile(e.target.files[0], 'background');
  $('logoUpload').onchange = e => loadImageFile(e.target.files[0], 'logo');
  $('playBtn').onclick = playAudio;
  $('pauseBtn').onclick = pauseAudio;
  $('stopBtn').onclick = stopAudio;
  $('seekSlider').oninput = e => seek((Number(e.target.value) / 1000) * duration());
  $('timelineTrack').onclick = e => seek((e.offsetX / e.currentTarget.clientWidth) * duration());
  $('fullSongToggle').onchange = e => { project.timeline.fullSong = e.target.checked; syncTimelineInputs(); };
  $('startTimeInput').oninput = e => { project.timeline.start = Number(e.target.value); updateTimelineVisual(); };
  $('endTimeInput').oninput = e => { project.timeline.end = Number(e.target.value); updateTimelineVisual(); };
  $('exportFileName').oninput = e => project.export.fileName = e.target.value.trim() || 'visualizer-export';
  $('fpsSelect').onchange = e => { project.export.fps = Number(e.target.value); syncExportWarning(); };
  $('qualitySelect').onchange = e => project.export.quality = Number(e.target.value);
  $('exportBtn').onclick = exportWebM;
  $('cancelExportBtn').onclick = () => { exportAbort = true; if (mediaRecorder?.state === 'recording') mediaRecorder.stop(); };
  $('saveProjectBtn').onclick = saveProject;
  $('loadProjectInput').onchange = e => loadProject(e.target.files[0]);
  $('addShapeBtn').onclick = () => { const l = layer('shape', 'Custom shape', { shape: 'circle', fill: project.colors.primary }); project.layers.push(l); selectedLayerId = l.id; syncUI(); };
  document.querySelectorAll('.tab').forEach(tab => tab.onclick = () => switchTab(tab.dataset.tab));
  buildPreset(presetDefinitions[0]);
  requestAnimationFrame(render);
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab, .tab-panel').forEach(el => el.classList.toggle('active', el.dataset.tab === tab || el.id === `${tab}Controls`));
}

async function ensureAudioGraph() {
  if (audioContext) return;
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = project.audio.smoothing;
  gainNode = audioContext.createGain();
  bassFilter = audioContext.createBiquadFilter();
  bassFilter.type = 'lowshelf';
  bassFilter.frequency.value = 180;
  mediaDestination = audioContext.createMediaStreamDestination();
  bassFilter.connect(gainNode);
  gainNode.connect(analyser);
  analyser.connect(audioContext.destination);
  analyser.connect(mediaDestination);
}

async function loadAudio(file) {
  if (!file) return;
  await ensureAudioGraph();
  stopAudio();
  audioFile = file;
  audioFileName = file.name;
  const buffer = await file.arrayBuffer();
  audioBuffer = await audioContext.decodeAudioData(buffer.slice(0));
  pausedAt = 0;
  project.timeline.end = duration();
  $('audioFileName').textContent = audioFileName;
  $('durationTime').textContent = formatTime(duration());
  $('dropHint').style.display = 'none';
  syncTimelineInputs();
}

function createSource(offset = 0) {
  sourceNode?.disconnect();
  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.connect(bassFilter);
  sourceNode.onended = () => { if (isPlaying && currentTime() >= duration() - 0.05) stopAudio(); };
  startedAt = audioContext.currentTime - offset;
  sourceNode.start(0, offset);
}

async function playAudio() {
  if (!audioBuffer) return;
  await ensureAudioGraph();
  if (audioContext.state === 'suspended') await audioContext.resume();
  if (isPlaying) return;
  createSource(Math.min(pausedAt, duration() - 0.01));
  isPlaying = true;
}
function pauseAudio() {
  if (!isPlaying) return;
  pausedAt = currentTime();
  sourceNode?.stop();
  isPlaying = false;
}
function stopAudio() {
  if (sourceNode) { try { sourceNode.stop(); } catch {} sourceNode.disconnect(); sourceNode = null; }
  isPlaying = false;
  pausedAt = 0;
}
function seek(time) {
  pausedAt = Math.max(0, Math.min(time || 0, duration()));
  if (isPlaying) { sourceNode?.stop(); createSource(pausedAt); }
  updateTransport();
}
function duration() { return audioBuffer?.duration || 0; }
function currentTime() { return isPlaying ? Math.min(audioContext.currentTime - startedAt, duration()) : pausedAt; }

function updateAudioMetrics() {
  if (!analyser) return syntheticMetrics();
  analyser.smoothingTimeConstant = project.audio.smoothing;
  gainNode.gain.value = project.audio.gain;
  bassFilter.gain.value = project.audio.bassBoost;
  analyser.getByteFrequencyData(data.frequency);
  analyser.getByteTimeDomainData(data.waveform);
  const avg = (start, end) => {
    let sum = 0;
    for (let i = start; i < end; i++) sum += data.frequency[i] || 0;
    return (sum / Math.max(1, end - start) / 255) * project.audio.sensitivity;
  };
  data.bass = avg(0, 16) * project.audio.bassReaction;
  data.mids = avg(16, 128) * project.audio.reaction;
  data.treble = avg(128, 512) * project.audio.trebleReaction;
  data.level = Math.min(1.8, (data.bass + data.mids + data.treble) / 3);
}
function syntheticMetrics() {
  const t = performance.now() / 1000;
  data.bass = 0.38 + Math.sin(t * 2.1) * 0.15;
  data.mids = 0.28 + Math.sin(t * 3.7) * 0.12;
  data.treble = 0.2 + Math.sin(t * 5.2) * 0.08;
  data.level = (data.bass + data.mids + data.treble) / 3;
  data.frequency.fill(0).forEach((_, i) => data.frequency[i] = 80 + Math.sin(t * 3 + i * 0.09) * 55);
  data.waveform.fill(128).forEach((_, i) => data.waveform[i] = 128 + Math.sin(t * 5 + i * 0.04) * 50);
}

function resizeCanvas() {
  const [arW, arH] = aspectRatios[project.aspectRatio];
  const height = resolutions[project.resolution];
  canvas.height = height;
  canvas.width = Math.round(height * arW / arH);
  $('aspectRatioSelect').value = project.aspectRatio;
  $('resolutionSelect').value = project.resolution;
}

function render(now = performance.now()) {
  animationId = requestAnimationFrame(render);
  const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  updateAudioMetrics();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  project.layers.forEach(l => drawLayer(l, now / 1000, dt));
  updateTransport();
}

function withLayer(l, draw) {
  if (!l.visible) return;
  ctx.save();
  ctx.globalAlpha = l.opacity;
  ctx.globalCompositeOperation = l.blend;
  const x = canvas.width * (l.x / 100);
  const y = canvas.height * (l.y / 100);
  ctx.translate(x, y);
  ctx.rotate((l.rotation * Math.PI) / 180 + (l.reactive ? data.treble * 0.04 : 0));
  ctx.scale(l.scale, l.scale);
  draw(x, y);
  ctx.restore();
}

function drawLayer(l, t, dt) {
  withLayer(l, () => {
    if (l.type === 'background') drawBackground();
    if (l.type === 'gradient') drawGradient();
    if (l.type === 'backgroundImage') drawImageCover(backgroundImage);
    if (l.type === 'waveform') drawWaveform(l.settings.style || project.visual.waveformStyle);
    if (l.type === 'spectrum') drawSpectrum(l.settings.anchor || 'bottom');
    if (l.type === 'radial') drawRadial(t, l.settings.rings || 1);
    if (l.type === 'particles') drawParticles(dt, l.settings.count || project.visual.particleCount);
    if (l.type === 'glow') drawGlow(l.settings.strength || project.visual.glowStrength, l.settings.radius || 0.35);
    if (l.type === 'text') drawText();
    if (l.type === 'image') drawLogoImage();
    if (l.type === 'shape') drawShape(l, t);
  });
}

function drawBackground() {
  ctx.fillStyle = project.colors.background;
  ctx.fillRect(-canvas.width, -canvas.height, canvas.width * 2, canvas.height * 2);
}
function drawGradient() {
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, Math.max(canvas.width, canvas.height));
  g.addColorStop(0, project.colors.gradientB);
  g.addColorStop(0.48, project.colors.gradientA);
  g.addColorStop(1, project.colors.background);
  ctx.fillStyle = g;
  ctx.fillRect(-canvas.width, -canvas.height, canvas.width * 2, canvas.height * 2);
  ctx.fillStyle = `rgba(0,0,0,${0.25 + data.bass * 0.15})`;
  ctx.fillRect(-canvas.width, -canvas.height, canvas.width * 2, canvas.height * 2);
}
function drawImageCover(img) {
  if (!img) return drawGradient();
  const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
  ctx.filter = `blur(${project.visual.blurAmount}px)`;
  ctx.drawImage(img, -img.width * scale / 2, -img.height * scale / 2, img.width * scale, img.height * scale);
  ctx.filter = 'none';
}
function drawGlow(strength, radiusFactor) {
  const r = Math.max(canvas.width, canvas.height) * radiusFactor * (1 + data.bass * 0.22);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, hexToRgba(project.colors.primary, 0.28 + data.level * 0.22));
  g.addColorStop(0.55, hexToRgba(project.colors.secondary, 0.16));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.shadowBlur = strength;
  ctx.shadowColor = project.colors.primary;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
}
function drawSpectrum(anchor) {
  const count = project.visual.spectrumBarCount;
  const w = project.visual.barWidth;
  const gap = project.visual.barSpacing;
  const total = count * (w + gap);
  for (let i = 0; i < count; i++) {
    const bin = Math.floor(i / count * data.frequency.length);
    const amp = Math.pow((data.frequency[bin] || 0) / 255, 1.35) * canvas.height * project.visual.barHeight;
    const grad = ctx.createLinearGradient(0, -amp, 0, amp);
    grad.addColorStop(0, project.colors.secondary);
    grad.addColorStop(1, project.colors.primary);
    ctx.fillStyle = grad;
    ctx.shadowBlur = project.visual.glowStrength * 0.35;
    ctx.shadowColor = project.colors.secondary;
    if (anchor === 'side') ctx.fillRect(-canvas.width * .42, -total / 2 + i * (w + gap), amp * .32, w);
    else ctx.fillRect(-total / 2 + i * (w + gap), canvas.height * .38 - amp, w, amp);
  }
  ctx.shadowBlur = 0;
}
function drawWaveform(style) {
  const width = canvas.width * 0.76;
  ctx.lineWidth = project.visual.waveformThickness;
  ctx.lineCap = 'round';
  ctx.strokeStyle = project.colors.secondary;
  ctx.shadowBlur = project.visual.glowStrength * 0.35;
  ctx.shadowColor = project.colors.primary;
  if (style === 'circle') {
    const radius = Math.min(canvas.width, canvas.height) * 0.16;
    ctx.beginPath();
    for (let i = 0; i < data.waveform.length; i += 8) {
      const a = i / data.waveform.length * Math.PI * 2;
      const v = (data.waveform[i] - 128) / 128;
      const r = radius + v * 42 * project.audio.reaction;
      const x = Math.cos(a) * r; const y = Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
  } else {
    ctx.beginPath();
    for (let i = 0; i < data.waveform.length; i += 12) {
      const x = -width / 2 + i / data.waveform.length * width;
      const v = (data.waveform[i] - 128) / 128;
      const y = v * canvas.height * 0.18;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      if (style === 'filled') ctx.lineTo(x, canvas.height * 0.12);
    }
    ctx.stroke();
    if (style === 'mirrored') { ctx.scale(1, -1); ctx.stroke(); }
  }
  ctx.shadowBlur = 0;
}
function drawRadial(t, rings) {
  const count = Math.min(180, project.visual.spectrumBarCount * 1.4);
  const base = Math.min(canvas.width, canvas.height) * project.visual.circularRadius;
  ctx.rotate(t * project.visual.rotationSpeed);
  for (let r = 0; r < rings; r++) {
    for (let i = 0; i < count; i++) {
      const amp = (data.frequency[Math.floor(i / count * data.frequency.length)] || 0) / 255;
      const angle = i / count * Math.PI * 2;
      const len = 22 + amp * Math.min(canvas.width, canvas.height) * 0.17;
      ctx.strokeStyle = i % 2 ? project.colors.secondary : project.colors.primary;
      ctx.lineWidth = 2 + amp * 5;
      ctx.shadowBlur = project.visual.glowStrength * 0.45;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.beginPath();
      const rr = base + r * 38;
      ctx.moveTo(Math.cos(angle) * rr, Math.sin(angle) * rr);
      ctx.lineTo(Math.cos(angle) * (rr + len), Math.sin(angle) * (rr + len));
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
}
function seedParticles() {
  data.particles = Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), a: Math.random() * Math.PI * 2 }));
}
function drawParticles(dt, count) {
  ctx.fillStyle = project.colors.secondary;
  for (let i = 0; i < Math.min(count, data.particles.length); i++) {
    const p = data.particles[i];
    p.y -= dt * project.visual.particleSpeed * (0.05 + p.z * 0.2) * (1 + data.bass);
    p.x += Math.sin(p.a + performance.now() * 0.0003) * dt * 0.025;
    if (p.y < 0) p.y = 1;
    const size = project.visual.particleSize * (0.5 + p.z * 1.5) * (1 + data.treble);
    ctx.globalAlpha *= 0.25 + p.z * 0.75;
    ctx.beginPath(); ctx.arc((p.x - .5) * canvas.width, (p.y - .5) * canvas.height, size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawText() {
  ctx.font = `${project.visual.fontWeight} ${project.visual.fontSize}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = project.visual.glowStrength * 0.4;
  ctx.shadowColor = project.colors.primary;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(project.visual.textContent, 0, 0);
  ctx.shadowBlur = 0;
}
function drawLogoImage() {
  const size = Math.min(canvas.width, canvas.height) * (0.28 + data.bass * 0.035);
  ctx.shadowBlur = project.visual.glowStrength;
  ctx.shadowColor = project.colors.primary;
  if (logoImage) {
    ctx.drawImage(logoImage, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    roundedRect(-size / 2, -size / 2, size, size, 28); ctx.fill();
    ctx.fillStyle = project.colors.secondary;
    ctx.font = `900 ${size * .14}px Inter, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('LOGO / COVER', 0, 0);
  }
  ctx.shadowBlur = 0;
}
function drawShape(l, t) {
  const s = Math.min(canvas.width, canvas.height) * 0.28 * (1 + data.bass * 0.08);
  ctx.strokeStyle = project.colors.primary;
  ctx.fillStyle = l.settings.fill || 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 3;
  if (l.settings.shape === 'grid') {
    ctx.strokeStyle = hexToRgba(project.colors.secondary, 0.22);
    for (let x = -canvas.width; x < canvas.width; x += 64) { ctx.beginPath(); ctx.moveTo(x, -canvas.height); ctx.lineTo(x + Math.sin(t) * 20, canvas.height); ctx.stroke(); }
    for (let y = -canvas.height; y < canvas.height; y += 64) { ctx.beginPath(); ctx.moveTo(-canvas.width, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  } else if (l.settings.shape === 'diamond') {
    ctx.rotate(t * project.visual.rotationSpeed);
    ctx.beginPath(); ctx.moveTo(0, -s / 2); ctx.lineTo(s / 2, 0); ctx.lineTo(0, s / 2); ctx.lineTo(-s / 2, 0); ctx.closePath(); ctx.stroke();
  } else {
    roundedRect(-s / 2, -s / 3, s, s * 0.66, 32); l.settings.stroke ? ctx.stroke() : ctx.fill();
  }
}
function roundedRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}
function hexToRgba(hex, alpha) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function updateTransport() {
  const d = duration();
  const t = currentTime();
  $('currentTime').textContent = formatTime(t);
  $('durationTime').textContent = formatTime(d);
  $('seekSlider').value = d ? (t / d) * 1000 : 0;
  $('playhead').style.left = `${d ? (t / d) * 100 : 0}%`;
}
function formatTime(value) {
  const m = Math.floor(value / 60) || 0;
  const s = Math.floor(value % 60) || 0;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function syncTimelineInputs() {
  $('fullSongToggle').checked = project.timeline.fullSong;
  $('startTimeInput').disabled = project.timeline.fullSong;
  $('endTimeInput').disabled = project.timeline.fullSong;
  $('startTimeInput').value = project.timeline.start.toFixed(1);
  $('endTimeInput').value = (project.timeline.end || duration()).toFixed(1);
  updateTimelineVisual();
}
function updateTimelineVisual() {
  const d = duration() || 1;
  const start = project.timeline.fullSong ? 0 : project.timeline.start;
  const end = project.timeline.fullSong ? d : Math.min(project.timeline.end || d, d);
  $('timelineRange').style.left = `${(start / d) * 100}%`;
  $('timelineRange').style.right = `${100 - (end / d) * 100}%`;
}
function syncExportWarning() {
  const heavy = project.resolution === '4K' || project.export.fps === 60;
  $('performanceWarning').textContent = heavy ? '4K or 60 FPS can be heavy on mobile devices.' : '';
}

function syncUI() {
  resizeCanvas();
  syncExportWarning();
  $('activePresetLabel').textContent = project.presetName;
  $('presetList').querySelectorAll('.preset-card').forEach(card => card.classList.toggle('active', card.dataset.preset === project.presetName));
  $('exportFileName').value = project.export.fileName;
  $('fpsSelect').value = String(project.export.fps);
  $('qualitySelect').value = String(project.export.quality);
  renderLayers();
  renderGlobalControls();
  renderLayerControls();
  syncTimelineInputs();
}
function renderLayers() {
  $('layerList').innerHTML = project.layers.map(l => `<button class="layer-card ${l.id === selectedLayerId ? 'active' : ''}" data-layer="${l.id}"><div class="layer-meta"><strong>${l.name}</strong><label class="toggle-row"><input type="checkbox" ${l.visible ? 'checked' : ''} data-visible="${l.id}"> Visible</label></div><small>${l.type}</small></button>`).join('');
  $('layerList').onclick = e => {
    if (e.target.matches('[data-visible]')) {
      const l = getLayer(e.target.dataset.visible); l.visible = e.target.checked; return;
    }
    const card = e.target.closest('[data-layer]');
    if (card) { selectedLayerId = card.dataset.layer; renderLayers(); renderLayerControls(); switchTab('layer'); }
  };
}
function control(label, key, value, type = 'range', attrs = '') {
  return `<label class="control">${label}<input data-key="${key}" type="${type}" value="${value}" ${attrs}><span class="control-value">${value}</span></label>`;
}
function selectControl(label, key, value, options) {
  return `<label class="control">${label}<select data-key="${key}">${options.map(o => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
}
function renderGlobalControls() {
  const c = project.colors, a = project.audio, v = project.visual;
  $('globalControls').innerHTML = [
    control('Primary color', 'colors.primary', c.primary, 'color'), control('Secondary color', 'colors.secondary', c.secondary, 'color'), control('Background color', 'colors.background', c.background, 'color'),
    control('Gradient color A', 'colors.gradientA', c.gradientA, 'color'), control('Gradient color B', 'colors.gradientB', c.gradientB, 'color'),
    control('Glow strength', 'visual.glowStrength', v.glowStrength, 'range', 'min="0" max="120" step="1"'), control('Blur amount', 'visual.blurAmount', v.blurAmount, 'range', 'min="0" max="30" step="1"'),
    control('Spectrum bar count', 'visual.spectrumBarCount', v.spectrumBarCount, 'range', 'min="16" max="180" step="1"'), control('Bar width', 'visual.barWidth', v.barWidth, 'range', 'min="2" max="24" step="1"'),
    control('Bar spacing', 'visual.barSpacing', v.barSpacing, 'range', 'min="0" max="18" step="1"'), control('Bar height', 'visual.barHeight', v.barHeight, 'range', 'min="0.1" max="1" step="0.01"'),
    control('Circular radius', 'visual.circularRadius', v.circularRadius, 'range', 'min="0.08" max="0.45" step="0.01"'), control('Rotation speed', 'visual.rotationSpeed', v.rotationSpeed, 'range', 'min="-1" max="1" step="0.01"'),
    control('Waveform thickness', 'visual.waveformThickness', v.waveformThickness, 'range', 'min="1" max="18" step="1"'), selectControl('Waveform style', 'visual.waveformStyle', v.waveformStyle, ['mirrored', 'line', 'filled', 'circle']),
    control('Particle count', 'visual.particleCount', v.particleCount, 'range', 'min="0" max="260" step="1"'), control('Particle speed', 'visual.particleSpeed', v.particleSpeed, 'range', 'min="0" max="2" step="0.01"'), control('Particle size', 'visual.particleSize', v.particleSize, 'range', 'min="0.5" max="10" step="0.1"'),
    control('Audio sensitivity', 'audio.sensitivity', a.sensitivity, 'range', 'min="0" max="3" step="0.01"'), control('Bass reaction', 'audio.bassReaction', a.bassReaction, 'range', 'min="0" max="3" step="0.01"'), control('Treble reaction', 'audio.trebleReaction', a.trebleReaction, 'range', 'min="0" max="3" step="0.01"'),
    control('Smoothness', 'audio.smoothing', a.smoothing, 'range', 'min="0" max="0.95" step="0.01"'), control('Gain', 'audio.gain', a.gain, 'range', 'min="0" max="3" step="0.01"'), control('Bass boost', 'audio.bassBoost', a.bassBoost, 'range', 'min="-10" max="18" step="0.1"'),
    `<label class="control">Text content<textarea data-key="visual.textContent" rows="2">${v.textContent}</textarea></label>`, control('Font size', 'visual.fontSize', v.fontSize, 'range', 'min="16" max="160" step="1"'), control('Font weight', 'visual.fontWeight', v.fontWeight, 'range', 'min="100" max="900" step="100"'), control('Text position X', 'visual.textX', v.textX, 'range', 'min="0" max="100" step="1"'), control('Text position Y', 'visual.textY', v.textY, 'range', 'min="0" max="100" step="1"')
  ].join('');
  $('globalControls').oninput = updateProjectValue;
}
function renderLayerControls() {
  const l = getLayer(selectedLayerId);
  $('selectedLayerName').textContent = l ? l.name : 'Global';
  if (!l) { $('layerControls').innerHTML = '<p class="hint">Select a layer to edit transform, opacity, blend style, and reactivity.</p>'; return; }
  $('layerControls').innerHTML = [
    `<label class="control">Layer name<input data-layer-key="name" type="text" value="${l.name}"></label>`,
    control('Opacity', 'opacity', l.opacity, 'range', 'min="0" max="1" step="0.01"').replace('data-key', 'data-layer-key'),
    selectControl('Blend style', 'blend', l.blend, blendModes).replace('data-key', 'data-layer-key'),
    control('Position X', 'x', l.x, 'range', 'min="-50" max="150" step="1"').replace('data-key', 'data-layer-key'),
    control('Position Y', 'y', l.y, 'range', 'min="-50" max="150" step="1"').replace('data-key', 'data-layer-key'),
    control('Scale', 'scale', l.scale, 'range', 'min="0.1" max="3" step="0.01"').replace('data-key', 'data-layer-key'),
    control('Rotation', 'rotation', l.rotation, 'range', 'min="-180" max="180" step="1"').replace('data-key', 'data-layer-key'),
    `<label class="toggle-row"><input data-layer-key="reactive" type="checkbox" ${l.reactive ? 'checked' : ''}> Audio reactive</label>`
  ].join('');
  $('layerControls').oninput = updateLayerValue;
}
function updateProjectValue(e) {
  const key = e.target.dataset.key;
  if (!key) return;
  setPath(project, key, e.target.type === 'range' ? Number(e.target.value) : e.target.value);
  if (key === 'visual.textX') project.layers.filter(l => l.type === 'text').forEach(l => l.x = project.visual.textX);
  if (key === 'visual.textY') project.layers.filter(l => l.type === 'text').forEach(l => l.y = project.visual.textY);
  e.target.nextElementSibling && (e.target.nextElementSibling.textContent = e.target.value);
}
function updateLayerValue(e) {
  const key = e.target.dataset.layerKey;
  const l = getLayer(selectedLayerId);
  if (!key || !l) return;
  l[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? Number(e.target.value) : e.target.value;
  e.target.nextElementSibling && (e.target.nextElementSibling.textContent = e.target.value);
  renderLayers();
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  let ref = obj;
  keys.slice(0, -1).forEach(k => ref = ref[k]);
  ref[keys.at(-1)] = value;
}
function getLayer(id) { return project.layers.find(l => l.id === id); }

function loadImageFile(file, target) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => { if (target === 'background') backgroundImage = img; else logoImage = img; };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

async function exportWebM() {
  if (!audioBuffer || exporting) return alert('Upload and decode an audio file before exporting WebM.');
  exporting = true; exportAbort = false;
  $('exportBtn').disabled = true; $('cancelExportBtn').disabled = false; $('exportProgress').style.width = '0%';
  const wasPlaying = isPlaying;
  pauseAudio();
  const start = project.timeline.fullSong ? 0 : Math.max(0, project.timeline.start);
  const end = project.timeline.fullSong ? duration() : Math.min(project.timeline.end || duration(), duration());
  const exportDuration = Math.max(0.25, end - start);
  await ensureAudioGraph();
  const exportSource = audioContext.createBufferSource();
  exportSource.buffer = audioBuffer;
  exportSource.connect(bassFilter);
  const videoStream = canvas.captureStream(project.export.fps);
  const tracks = [...videoStream.getVideoTracks(), ...mediaDestination.stream.getAudioTracks()];
  const stream = new MediaStream(tracks);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
  const chunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: project.export.quality, audioBitsPerSecond: 192000 });
  mediaRecorder.ondataavailable = e => e.data.size && chunks.push(e.data);
  mediaRecorder.onstop = () => finishExport(chunks, stream, wasPlaying);
  mediaRecorder.start(250);
  exportSource.start(0, start, exportDuration);
  const startWall = performance.now();
  const tick = () => {
    const elapsed = (performance.now() - startWall) / 1000;
    $('exportProgress').style.width = `${Math.min(100, (elapsed / exportDuration) * 100)}%`;
    if ((elapsed >= exportDuration || exportAbort) && mediaRecorder.state === 'recording') mediaRecorder.stop();
    else if (!exportAbort) requestAnimationFrame(tick);
  };
  tick();
}
function finishExport(chunks, stream, wasPlaying) {
  stream.getTracks().forEach(track => track.stop());
  exporting = false;
  $('exportBtn').disabled = false; $('cancelExportBtn').disabled = true;
  if (!exportAbort) {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    $('exportPreview').src = url;
    $('downloadLink').href = url;
    $('downloadLink').download = `${project.export.fileName || 'visualizer-export'}.webm`;
    $('exportResult').classList.remove('hidden');
    $('exportProgress').style.width = '100%';
  }
  if (wasPlaying) playAudio();
}

function saveProject() {
  const payload = { ...project, audioFileName };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.presetName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.visualizer.json`;
  a.click();
  URL.revokeObjectURL(url);
}
async function loadProject(file) {
  if (!file) return;
  const loaded = JSON.parse(await file.text());
  Object.assign(project, loaded);
  audioFileName = loaded.audioFileName || '';
  $('audioFileName').textContent = audioFileName ? `${audioFileName} (re-upload audio to export)` : 'Project loaded - upload audio';
  selectedLayerId = project.layers[0]?.id || null;
  seedParticles();
  syncUI();
}

initUI();
window.addEventListener('beforeunload', () => { cancelAnimationFrame(animationId); stopAudio(); if (mediaRecorder?.state === 'recording') mediaRecorder.stop(); });
