const fileInput = document.querySelector('#fileInput');
const dropZone = document.querySelector('#dropZone');
const fileMeta = document.querySelector('#fileMeta');
const modeSection = document.querySelector('#modeSection');
const referencePanel = document.querySelector('#referencePanel');
const automaticPanel = document.querySelector('#automaticPanel');
const modeButtons = document.querySelectorAll('.mode-option');
const canvas = document.querySelector('#waveformCanvas');
const ctx = canvas.getContext('2d');
const selectionStartEl = document.querySelector('#selectionStart');
const selectionEndEl = document.querySelector('#selectionEnd');
const selectionDurationEl = document.querySelector('#selectionDuration');
const referenceProcessBtn = document.querySelector('#referenceProcessBtn');
const autoProcessBtn = document.querySelector('#autoProcessBtn');
const targetLoudness = document.querySelector('#targetLoudness');
const smoothness = document.querySelector('#smoothness');
const peakProtection = document.querySelector('#peakProtection');
const progressSection = document.querySelector('#progressSection');
const progressBar = document.querySelector('#progressBar');
const statusText = document.querySelector('#statusText');
const resultSection = document.querySelector('#resultSection');
const previewPlayer = document.querySelector('#previewPlayer');
const downloadBtn = document.querySelector('#downloadBtn');
const resetBtn = document.querySelector('#resetBtn');
const steps = document.querySelectorAll('.step');

const state = {
  audioContext: null,
  sourceBuffer: null,
  file: null,
  mode: 'reference',
  selection: { start: 0, end: 0 },
  waveform: [],
  dragMode: null,
  activeObjectUrl: null,
};

const PROCESS_MESSAGES = [
  'Decoding audio',
  'Analyzing loudness',
  'Applying gain automation',
  'Rendering final audio',
  'Ready to download',
];

function getAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return state.audioContext;
}

function setStep(activeStep) {
  steps.forEach((step) => step.classList.toggle('is-active', step.dataset.step === activeStep));
}

function setStatus(index, progress) {
  progressSection.hidden = false;
  statusText.textContent = PROCESS_MESSAGES[index];
  progressBar.style.width = `${progress}%`;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, seconds || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = (safeSeconds % 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${remaining}`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(exponent ? 1 : 0)} ${units[exponent]}`;
}

function updateFileMeta() {
  const duration = state.sourceBuffer ? formatTime(state.sourceBuffer.duration) : 'Unknown';
  fileMeta.hidden = false;
  fileMeta.innerHTML = `
    <strong>${state.file.name}</strong>
    <span>Duration: ${duration}</span>
    <span>Size: ${formatBytes(state.file.size)}</span>
  `;
}

async function handleFile(file) {
  const supportedExtension = /\.(mp3|wav|flac|m4a|aac|ogg|opus)$/i.test(file?.name || '');
  if (!file || (!file.type.startsWith('audio/') && !supportedExtension)) {
    alert('Please choose a browser-supported audio file.');
    return;
  }

  resetOutputOnly();
  state.file = file;
  setStatus(0, 12);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await getAudioContext().decodeAudioData(arrayBuffer.slice(0));
    state.sourceBuffer = decoded;
    state.selection = getDefaultSelection(decoded.duration);
    state.waveform = buildWaveform(decoded, 900);
    updateFileMeta();
    modeSection.classList.remove('is-disabled');
    referencePanel.classList.remove('is-disabled');
    automaticPanel.classList.remove('is-disabled');
    referenceProcessBtn.disabled = false;
    autoProcessBtn.disabled = false;
    progressSection.hidden = true;
    setStep('mode');
    drawWaveform();
    updateSelectionReadout();
  } catch (error) {
    console.error(error);
    statusText.textContent = 'Could not decode this audio file. Try another format or a different browser.';
    progressBar.style.width = '0%';
  }
}

function getDefaultSelection(duration) {
  const start = Math.max(0, duration * 0.2);
  const end = Math.min(duration, start + Math.max(3, duration * 0.18));
  return { start, end };
}

function buildWaveform(buffer, buckets) {
  const channelCount = buffer.numberOfChannels;
  const samplesPerBucket = Math.max(1, Math.floor(buffer.length / buckets));
  const peaks = [];

  for (let bucket = 0; bucket < buckets; bucket++) {
    let max = 0;
    const start = bucket * samplesPerBucket;
    const end = Math.min(buffer.length, start + samplesPerBucket);

    for (let channel = 0; channel < channelCount; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = start; i < end; i += 16) {
        max = Math.max(max, Math.abs(data[i]));
      }
    }
    peaks.push(max);
  }

  const largest = Math.max(...peaks, 0.001);
  return peaks.map((peak) => peak / largest);
}

function drawWaveform() {
  if (!state.sourceBuffer) return;

  const { width, height } = canvas;
  const center = height / 2;
  const selectionStartX = timeToX(state.selection.start);
  const selectionEndX = timeToX(state.selection.end);
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#45f2df');
  gradient.addColorStop(1, '#56b9ff');

  ctx.fillStyle = 'rgba(69, 242, 223, 0.08)';
  ctx.fillRect(selectionStartX, 0, selectionEndX - selectionStartX, height);

  state.waveform.forEach((peak, index) => {
    const x = (index / state.waveform.length) * width;
    const barHeight = Math.max(2, peak * height * 0.74);
    const inSelection = x >= selectionStartX && x <= selectionEndX;
    ctx.fillStyle = inSelection ? gradient : 'rgba(158, 178, 193, 0.36)';
    ctx.fillRect(x, center - barHeight / 2, Math.max(1, width / state.waveform.length - 1), barHeight);
  });

  drawHandle(selectionStartX);
  drawHandle(selectionEndX);
}

function drawHandle(x) {
  const { height } = canvas;
  ctx.shadowColor = '#45f2df';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#45f2df';
  ctx.fillRect(x - 2, 0, 4, height);
  ctx.shadowBlur = 0;
}

function xToTime(x) {
  const rect = canvas.getBoundingClientRect();
  const relative = Math.min(Math.max(0, x - rect.left), rect.width);
  return (relative / rect.width) * state.sourceBuffer.duration;
}

function timeToX(time) {
  return (time / state.sourceBuffer.duration) * canvas.width;
}

function updateSelectionReadout() {
  const duration = Math.max(0, state.selection.end - state.selection.start);
  selectionStartEl.textContent = formatTime(state.selection.start);
  selectionEndEl.textContent = formatTime(state.selection.end);
  selectionDurationEl.textContent = `${duration.toFixed(1)}s`;
  referenceProcessBtn.disabled = duration < 0.25;
}

function startSelectionDrag(event) {
  if (!state.sourceBuffer) return;
  const time = xToTime(event.clientX);
  const handleThreshold = state.sourceBuffer.duration * 0.025;

  if (Math.abs(time - state.selection.start) < handleThreshold) {
    state.dragMode = 'start';
  } else if (Math.abs(time - state.selection.end) < handleThreshold) {
    state.dragMode = 'end';
  } else {
    state.dragMode = 'region';
    state.selection.start = time;
    state.selection.end = time;
  }
  canvas.setPointerCapture(event.pointerId);
  updateSelectionDrag(event);
}

function updateSelectionDrag(event) {
  if (!state.dragMode || !state.sourceBuffer) return;
  const time = xToTime(event.clientX);
  const minimum = 0.25;

  if (state.dragMode === 'start') {
    state.selection.start = Math.min(time, state.selection.end - minimum);
  } else if (state.dragMode === 'end') {
    state.selection.end = Math.max(time, state.selection.start + minimum);
  } else {
    state.selection.end = time;
  }

  if (state.selection.start > state.selection.end) {
    [state.selection.start, state.selection.end] = [state.selection.end, state.selection.start];
  }

  state.selection.start = Math.max(0, state.selection.start);
  state.selection.end = Math.min(state.sourceBuffer.duration, state.selection.end);
  drawWaveform();
  updateSelectionReadout();
}

function stopSelectionDrag(event) {
  if (state.dragMode) canvas.releasePointerCapture(event.pointerId);
  state.dragMode = null;
}

function calculateRmsForRange(channels, startSample, endSample) {
  let sum = 0;
  let count = 0;
  for (const data of channels) {
    for (let i = startSample; i < endSample; i++) {
      sum += data[i] * data[i];
      count++;
    }
  }
  return Math.sqrt(sum / Math.max(1, count));
}

function makeGainEnvelope(buffer, targetRms, smoothingAmount) {
  const windowSeconds = 0.1;
  const windowSize = Math.max(128, Math.floor(buffer.sampleRate * windowSeconds));
  const channelData = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
  const envelope = new Float32Array(Math.ceil(buffer.length / windowSize));
  let smoothedGain = 1;
  const smoothing = Math.min(0.96, Math.max(0.05, smoothingAmount));

  for (let windowIndex = 0; windowIndex < envelope.length; windowIndex++) {
    const start = windowIndex * windowSize;
    const end = Math.min(buffer.length, start + windowSize);
    const rms = calculateRmsForRange(channelData, start, end);
    const rawGain = rms > 0.00001 ? targetRms / rms : 1;
    const limitedGain = Math.min(4, Math.max(0.2, rawGain));
    smoothedGain = smoothedGain * smoothing + limitedGain * (1 - smoothing);
    envelope[windowIndex] = smoothedGain;
  }

  return { envelope, windowSize };
}

function processBuffer(mode) {
  const source = state.sourceBuffer;
  const channels = Array.from({ length: source.numberOfChannels }, (_, channel) => source.getChannelData(channel));
  let targetRms;

  if (mode === 'reference') {
    const startSample = Math.floor(state.selection.start * source.sampleRate);
    const endSample = Math.floor(state.selection.end * source.sampleRate);
    targetRms = calculateRmsForRange(channels, startSample, endSample);
  } else {
    const desired = parseFloat(targetLoudness.value);
    const wholeRms = calculateRmsForRange(channels, 0, source.length);
    targetRms = Math.min(0.24, Math.max(0.08, wholeRms * 0.35 + desired * 0.65));
  }

  const smoothingAmount = mode === 'reference' ? 0.72 : parseFloat(smoothness.value);
  const { envelope, windowSize } = makeGainEnvelope(source, Math.max(0.025, targetRms), smoothingAmount);
  const processed = getAudioContext().createBuffer(source.numberOfChannels, source.length, source.sampleRate);
  let peak = 0;

  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel);
    const output = processed.getChannelData(channel);
    for (let sample = 0; sample < source.length; sample++) {
      const gainIndex = Math.min(envelope.length - 1, Math.floor(sample / windowSize));
      const nextGain = envelope[Math.min(envelope.length - 1, gainIndex + 1)];
      const progress = (sample % windowSize) / windowSize;
      const gain = envelope[gainIndex] * (1 - progress) + nextGain * progress;
      output[sample] = input[sample] * gain;
      peak = Math.max(peak, Math.abs(output[sample]));
    }
  }

  if (peakProtection.checked || peak > 0.98) {
    applyLimiter(processed, Math.max(peak, 0.001));
  }

  return processed;
}

function applyLimiter(buffer, peak) {
  const ceiling = 0.97;
  const makeup = peak > ceiling ? ceiling / peak : 1;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    let previous = 0;
    for (let i = 0; i < data.length; i++) {
      const driven = data[i] * makeup;
      const limited = Math.tanh(driven * 1.25) / Math.tanh(1.25);
      previous = previous * 0.08 + limited * 0.92;
      data[i] = Math.max(-ceiling, Math.min(ceiling, previous));
    }
  }
}

function audioBufferToWav(buffer) {
  const channelCount = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const wav = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wav);
  let offset = 0;

  const writeString = (value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset++, value.charCodeAt(i));
  };

  writeString('RIFF');
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, channelCount, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bytesPerSample * 8, true); offset += 2;
  writeString('data');
  view.setUint32(offset, dataSize, true); offset += 4;

  for (let sample = 0; sample < buffer.length; sample++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const value = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[sample]));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

async function runProcessing(mode) {
  if (!state.sourceBuffer) return;
  setStep('process');
  resultSection.hidden = true;
  setStatus(1, 30);

  await waitForPaint();
  setStatus(2, 52);
  const processed = processBuffer(mode);

  await waitForPaint();
  setStatus(3, 78);
  const blob = audioBufferToWav(processed);

  if (state.activeObjectUrl) URL.revokeObjectURL(state.activeObjectUrl);
  state.activeObjectUrl = URL.createObjectURL(blob);
  previewPlayer.src = state.activeObjectUrl;
  downloadBtn.href = state.activeObjectUrl;
  downloadBtn.download = `${state.file.name.replace(/\.[^.]+$/, '') || 'volumeflow'}-leveled.wav`;

  setStatus(4, 100);
  resultSection.hidden = false;
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function waitForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 40)));
}

function resetOutputOnly() {
  if (state.activeObjectUrl) URL.revokeObjectURL(state.activeObjectUrl);
  state.activeObjectUrl = null;
  previewPlayer.removeAttribute('src');
  downloadBtn.removeAttribute('href');
  resultSection.hidden = true;
  progressBar.style.width = '0%';
}

function resetAll() {
  resetOutputOnly();
  state.file = null;
  state.sourceBuffer = null;
  state.waveform = [];
  fileInput.value = '';
  fileMeta.hidden = true;
  progressSection.hidden = true;
  modeSection.classList.add('is-disabled');
  referencePanel.classList.add('is-disabled');
  automaticPanel.classList.add('is-disabled');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setStep('upload');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setMode(mode) {
  state.mode = mode;
  modeButtons.forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-checked', String(selected));
  });
  referencePanel.hidden = mode !== 'reference';
  automaticPanel.hidden = mode !== 'automatic';
}

fileInput.addEventListener('change', (event) => handleFile(event.target.files[0]));
dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('is-dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragover'));
dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('is-dragover');
  handleFile(event.dataTransfer.files[0]);
});
modeButtons.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
canvas.addEventListener('pointerdown', startSelectionDrag);
canvas.addEventListener('pointermove', updateSelectionDrag);
canvas.addEventListener('pointerup', stopSelectionDrag);
canvas.addEventListener('pointercancel', stopSelectionDrag);
referenceProcessBtn.addEventListener('click', () => runProcessing('reference'));
autoProcessBtn.addEventListener('click', () => runProcessing('automatic'));
resetBtn.addEventListener('click', resetAll);
window.addEventListener('beforeunload', resetOutputOnly);
window.addEventListener('resize', drawWaveform);
