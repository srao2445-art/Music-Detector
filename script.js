const SMALL_PREVIEW_LIMIT = 24 * 1024 * 1024;
const MOBILE_PREVIEW_LIMIT = 12 * 1024 * 1024;
const LARGE_FILE_WARNING = 90 * 1024 * 1024;
const LONG_DURATION_WARNING = 30 * 60;

const fileInput = document.querySelector('#fileInput');
const dropZone = document.querySelector('#dropZone');
const fileMeta = document.querySelector('#fileMeta');
const fileWarnings = document.querySelector('#fileWarnings');
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
const ffmpegFilter = document.querySelector('#ffmpegFilter');
const peakProtection = document.querySelector('#peakProtection');
const outputFormat = document.querySelector('#outputFormat');
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
  duration: 0,
  file: null,
  mode: 'reference',
  selection: { start: 0, end: 0 },
  waveform: [],
  waveformMode: 'none',
  dragMode: null,
  activeObjectUrl: null,
  worker: null,
  processing: false,
};

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function getPreviewLimit() {
  return isMobileBrowser() ? MOBILE_PREVIEW_LIMIT : SMALL_PREVIEW_LIMIT;
}

function getAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return state.audioContext;
}

function setStep(activeStep) {
  steps.forEach((step) => step.classList.toggle('is-active', step.dataset.step === activeStep));
}

function setStatus(message, progress = 0) {
  progressSection.hidden = false;
  statusText.textContent = message;
  progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
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

function getExtension(file) {
  return (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || 'audio').toLowerCase();
}

function updateFileMeta() {
  const previewLabel = state.waveformMode === 'decoded'
    ? 'Decoded waveform preview'
    : 'Lightweight chunk-sampled waveform preview';

  fileMeta.hidden = false;
  fileMeta.innerHTML = `
    <strong>${state.file.name}</strong>
    <span>Duration: ${state.duration ? formatTime(state.duration) : 'Metadata unavailable'}</span>
    <span>Size: ${formatBytes(state.file.size)}</span>
    <span>${previewLabel}</span>
  `;
}

function updateWarnings() {
  const warnings = [];
  const previewLimit = getPreviewLimit();

  if (state.file.size > previewLimit) {
    warnings.push(`Large file mode is active. VolumeFlow avoids full decodeAudioData preview and samples file chunks for the waveform.`);
  }
  if (isMobileBrowser() && state.file.size > MOBILE_PREVIEW_LIMIT) {
    warnings.push('Mobile browsers can have strict memory limits. Close other tabs before processing long audio.');
  }
  if (state.file.size > LARGE_FILE_WARNING) {
    warnings.push('Very large files may require several minutes while FFmpeg loads, analyzes, and exports in the worker.');
  }
  if (state.duration > LONG_DURATION_WARNING) {
    warnings.push('Long audio detected. Keep this tab open and your screen awake during export.');
  }
  if (!window.crossOriginIsolated) {
    warnings.push('Single-thread FFmpeg mode will be used because this page is not cross-origin isolated.');
  }

  fileWarnings.hidden = warnings.length === 0;
  fileWarnings.innerHTML = warnings.map((warning) => `<li>${warning}</li>`).join('');
}

function supportedAudioFile(file) {
  return Boolean(file && (file.type.startsWith('audio/') || /\.(mp3|wav|flac|m4a|aac|ogg|opus)$/i.test(file.name)));
}

async function handleFile(file) {
  if (!supportedAudioFile(file)) {
    alert('Please choose a supported audio file: MP3, WAV, M4A, AAC, FLAC, OGG, or OPUS.');
    return;
  }

  resetOutputOnly();
  state.file = file;
  state.sourceBuffer = null;
  state.duration = 0;
  state.waveform = [];
  state.waveformMode = 'none';
  setStatus('Reading local file metadata', 8);

  try {
    state.duration = await readDurationFromMetadata(file);
  } catch (error) {
    console.warn('Duration metadata unavailable:', error);
    state.duration = 0;
  }

  try {
    await prepareWaveform(file);
    if (!state.duration && state.sourceBuffer) state.duration = state.sourceBuffer.duration;
    if (!state.duration) state.duration = estimateDurationFromFileSize(file);

    state.selection = getDefaultSelection(state.duration);
    updateFileMeta();
    updateWarnings();
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
    setStatus(memoryFriendlyError(error), 0);
  }
}

function readDurationFromMetadata(file) {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);
    const cleanup = () => {
      audio.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      cleanup();
      resolve(duration);
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error('Browser could not read duration metadata.'));
    };
    audio.src = url;
  });
}

async function prepareWaveform(file) {
  const previewLimit = getPreviewLimit();

  if (file.size <= previewLimit) {
    try {
      setStatus('Decoding small file for detailed waveform preview', 14);
      const arrayBuffer = await file.arrayBuffer();
      const decoded = await getAudioContext().decodeAudioData(arrayBuffer.slice(0));
      state.duration = state.duration || decoded.duration;
      state.waveform = buildWaveformFromBuffer(decoded, 900);
      state.sourceBuffer = null;
      state.waveformMode = 'decoded';
      return;
    } catch (error) {
      console.warn('Detailed decode failed; falling back to lightweight waveform.', error);
    }
  }

  setStatus('Sampling file chunks for lightweight waveform preview', 18);
  state.waveform = await buildWaveformFromFileChunks(file, 900);
  state.waveformMode = 'chunked';
}

function estimateDurationFromFileSize(file) {
  const assumedBytesPerSecond = 24_000;
  return Math.max(30, file.size / assumedBytesPerSecond);
}

function getDefaultSelection(duration) {
  const safeDuration = Math.max(1, duration || 1);
  const start = Math.max(0, safeDuration * 0.2);
  const end = Math.min(safeDuration, start + Math.max(3, safeDuration * 0.18));
  return { start, end };
}

function buildWaveformFromBuffer(buffer, buckets) {
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

  return normalizePeaks(peaks);
}

async function buildWaveformFromFileChunks(file, buckets) {
  const peaks = [];
  const bytesPerBucket = Math.max(1, Math.floor(file.size / buckets));
  const sampleBytesPerBucket = 256;

  for (let bucket = 0; bucket < buckets; bucket++) {
    const start = bucket * bytesPerBucket;
    const end = Math.min(file.size, start + sampleBytesPerBucket);
    const slice = await file.slice(start, end).arrayBuffer();
    const bytes = new Uint8Array(slice);
    let sum = 0;

    for (const byte of bytes) {
      sum += Math.abs(byte - 128) / 128;
    }
    peaks.push(bytes.length ? sum / bytes.length : 0.05);
  }

  return normalizePeaks(peaks).map((peak) => Math.max(0.08, peak));
}

function normalizePeaks(peaks) {
  const largest = Math.max(...peaks, 0.001);
  return peaks.map((peak) => peak / largest);
}

function drawWaveform() {
  if (!state.waveform.length || !state.duration) return;

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
  return (relative / rect.width) * state.duration;
}

function timeToX(time) {
  return (time / Math.max(0.001, state.duration)) * canvas.width;
}

function updateSelectionReadout() {
  const duration = Math.max(0, state.selection.end - state.selection.start);
  selectionStartEl.textContent = formatTime(state.selection.start);
  selectionEndEl.textContent = formatTime(state.selection.end);
  selectionDurationEl.textContent = `${duration.toFixed(1)}s`;
  referenceProcessBtn.disabled = duration < 0.25;
}

function startSelectionDrag(event) {
  if (!state.duration) return;
  const time = xToTime(event.clientX);
  const handleThreshold = state.duration * 0.025;

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
  if (!state.dragMode || !state.duration) return;
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
  state.selection.end = Math.min(state.duration, state.selection.end);
  drawWaveform();
  updateSelectionReadout();
}

function stopSelectionDrag(event) {
  if (state.dragMode) canvas.releasePointerCapture(event.pointerId);
  state.dragMode = null;
}

function getWorker() {
  if (!state.worker) {
    state.worker = new Worker('ffmpeg-worker.js');
    state.worker.addEventListener('message', handleWorkerMessage);
    state.worker.addEventListener('error', (event) => {
      state.processing = false;
      setStatus(memoryFriendlyError(event.error || event.message), 0);
      enableProcessingButtons();
    });
  }
  return state.worker;
}

async function runProcessing(mode) {
  if (!state.file || state.processing) return;

  state.processing = true;
  setStep('process');
  resultSection.hidden = true;
  disableProcessingButtons();
  setStatus('Preparing local file for FFmpeg worker', 5);

  try {
    getWorker().postMessage({
      type: 'process',
      payload: {
        mode,
        file: state.file,
        fileName: state.file.name,
        extension: getExtension(state.file),
        outputFormat: outputFormat.value,
        selection: state.selection,
        duration: state.duration,
        automatic: {
          targetLoudness: Number(targetLoudness.value),
          filter: ffmpegFilter.value,
          peakProtection: peakProtection.checked,
        },
      },
    });
  } catch (error) {
    state.processing = false;
    setStatus(memoryFriendlyError(error), 0);
    enableProcessingButtons();
  }
}

function handleWorkerMessage(event) {
  const { type, payload } = event.data;

  if (type === 'progress') {
    setStatus(payload.message, payload.progress);
    return;
  }

  if (type === 'done') {
    state.processing = false;
    const mimeType = payload.format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    const blob = new Blob([payload.data], { type: mimeType });

    if (state.activeObjectUrl) URL.revokeObjectURL(state.activeObjectUrl);
    state.activeObjectUrl = URL.createObjectURL(blob);
    previewPlayer.src = state.activeObjectUrl;
    downloadBtn.href = state.activeObjectUrl;
    downloadBtn.download = `${state.file.name.replace(/\.[^.]+$/, '') || 'volumeflow'}-leveled.${payload.format}`;
    downloadBtn.textContent = `Download ${payload.format.toUpperCase()}`;

    setStatus('Ready to download', 100);
    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    enableProcessingButtons();
    return;
  }

  if (type === 'error') {
    state.processing = false;
    setStatus(memoryFriendlyError(payload.message), 0);
    enableProcessingButtons();
  }
}

function disableProcessingButtons() {
  referenceProcessBtn.disabled = true;
  autoProcessBtn.disabled = true;
}

function enableProcessingButtons() {
  if (!state.file) return;
  referenceProcessBtn.disabled = false;
  autoProcessBtn.disabled = false;
}

function memoryFriendlyError(error) {
  const message = String(error?.message || error || 'Unknown processing error.');
  if (/memory|allocation|out of bounds|ArrayBuffer|abort/i.test(message)) {
    return 'This browser ran out of memory while processing. Try WAV output, close other tabs, use a desktop browser, or split the audio into smaller parts.';
  }
  if (/SharedArrayBuffer|cross-origin|wasm/i.test(message)) {
    return 'FFmpeg could not start in this browser context. Try a modern desktop browser or serve the page with the headers required by ffmpeg.wasm.';
  }
  return message;
}

function resetOutputOnly() {
  if (state.activeObjectUrl) URL.revokeObjectURL(state.activeObjectUrl);
  state.activeObjectUrl = null;
  previewPlayer.removeAttribute('src');
  downloadBtn.removeAttribute('href');
  resultSection.hidden = true;
  progressBar.style.width = '0%';
}

function terminateWorker() {
  if (state.worker) {
    state.worker.postMessage({ type: 'cleanup' });
    state.worker.terminate();
    state.worker = null;
  }
  state.processing = false;
}

function resetAll() {
  resetOutputOnly();
  terminateWorker();
  state.file = null;
  state.sourceBuffer = null;
  state.duration = 0;
  state.waveform = [];
  state.waveformMode = 'none';
  fileInput.value = '';
  fileMeta.hidden = true;
  fileWarnings.hidden = true;
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
window.addEventListener('beforeunload', () => {
  resetOutputOnly();
  terminateWorker();
});
window.addEventListener('resize', drawWaveform);
