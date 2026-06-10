import { buildLowResolutionPeaks, drawWaveform, formatBytes, formatTime } from './waveform.js';

const elements = {
  fileInput: document.querySelector('#fileInput'),
  chooseFileButton: document.querySelector('#chooseFileButton'),
  dropZone: document.querySelector('#dropZone'),
  fileName: document.querySelector('#fileName'),
  fileSize: document.querySelector('#fileSize'),
  fileDuration: document.querySelector('#fileDuration'),
  audioPreview: document.querySelector('#audioPreview'),
  waveformCanvas: document.querySelector('#waveformCanvas'),
  startHandle: document.querySelector('#startHandle'),
  endHandle: document.querySelector('#endHandle'),
  startTime: document.querySelector('#startTime'),
  endTime: document.querySelector('#endTime'),
  selectionLabel: document.querySelector('#selectionLabel'),
  runtimeMode: document.querySelector('#runtimeMode'),
  processButton: document.querySelector('#processButton'),
  cancelButton: document.querySelector('#cancelButton'),
  downloadButton: document.querySelector('#downloadButton'),
  progressBar: document.querySelector('#progressBar'),
  statusText: document.querySelector('#statusText'),
  errorText: document.querySelector('#errorText'),
  gainReadout: document.querySelector('#gainReadout'),
  resetButton: document.querySelector('#resetButton'),
  autoFilter: document.querySelector('#autoFilter'),
  autoFilterWrap: document.querySelector('#autoFilterWrap'),
  matchCard: document.querySelector('#matchCard'),
  autoCard: document.querySelector('#autoCard')
};

const state = {
  file: null,
  duration: 0,
  peaks: null,
  previewUrl: null,
  downloadUrl: null,
  selection: { start: 0, end: 0 },
  worker: null,
  processing: false,
  preferMultiThread: window.crossOriginIsolated === true
};

boot();

function boot() {
  setRuntimeMode(state.preferMultiThread ? 'Fast mode enabled' : 'Compatibility mode enabled');
  registerServiceWorker();
  createWorker();
  wireEvents();
  drawWaveform(elements.waveformCanvas, null, state.selection, state.duration);
  warmupFfmpeg();
}

function createWorker() {
  state.worker = new Worker('./ffmpeg-worker.js');
  state.worker.addEventListener('message', onWorkerMessage);
}

function warmupFfmpeg() {
  setStatus('Loading FFmpeg', 2);
  state.worker.postMessage({ type: 'warmup', payload: { preferMultiThread: state.preferMultiThread } });
}

function wireEvents() {
  elements.chooseFileButton.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', () => handleFile(elements.fileInput.files?.[0]));
  elements.resetButton.addEventListener('click', resetApp);
  elements.processButton.addEventListener('click', processCurrentFile);
  elements.cancelButton.addEventListener('click', cancelProcessing);
  window.addEventListener('resize', redraw);

  elements.dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    elements.dropZone.classList.add('dragover');
  });
  elements.dropZone.addEventListener('dragleave', () => elements.dropZone.classList.remove('dragover'));
  elements.dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove('dragover');
    handleFile(event.dataTransfer.files?.[0]);
  });

  document.querySelectorAll('input[name="mode"]').forEach((radio) => {
    radio.addEventListener('change', updateModeUi);
  });

  elements.startTime.addEventListener('input', () => updateSelectionFromInputs('start'));
  elements.endTime.addEventListener('input', () => updateSelectionFromInputs('end'));
  installHandleDrag(elements.startHandle, 'start');
  installHandleDrag(elements.endHandle, 'end');
}

async function handleFile(file) {
  clearError();
  revokeDownload();

  if (!file) return;
  if (!isMp3(file)) {
    showError('Please choose an MP3 file only. WAV, M4A, AAC, FLAC, OGG, and other formats are not supported.');
    return;
  }

  state.file = file;
  state.duration = 0;
  state.selection = { start: 0, end: 0 };
  elements.fileName.textContent = file.name;
  elements.fileSize.textContent = formatBytes(file.size);
  elements.fileDuration.textContent = 'Reading metadata…';
  elements.processButton.disabled = true;
  elements.resetButton.disabled = false;
  setStatus('Building lightweight waveform preview', 0);

  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = URL.createObjectURL(file);
  elements.audioPreview.src = state.previewUrl;

  const metadataPromise = readDuration();
  const peaksPromise = buildLowResolutionPeaks(file, 900);
  const [duration, peaks] = await Promise.all([metadataPromise, peaksPromise]);

  state.duration = duration || 0;
  state.selection = { start: 0, end: Math.max(0, Math.min(30, state.duration || 0)) };
  if (state.duration && state.duration < 30) state.selection.end = state.duration;
  state.peaks = peaks;
  elements.fileDuration.textContent = state.duration ? formatTime(state.duration) : 'Unavailable';
  elements.startTime.max = state.duration || '';
  elements.endTime.max = state.duration || '';
  elements.startTime.value = state.selection.start.toFixed(2);
  elements.endTime.value = state.selection.end.toFixed(2);
  updateSelectionUi();
  setStatus('MP3 ready. Choose a mode and process.', 0);
  elements.processButton.disabled = false;
}

function isMp3(file) {
  const name = file.name.toLowerCase();
  return name.endsWith('.mp3') && (file.type === '' || file.type === 'audio/mpeg' || file.type === 'audio/mp3');
}

function readDuration() {
  return new Promise((resolve) => {
    const done = () => resolve(Number.isFinite(elements.audioPreview.duration) ? elements.audioPreview.duration : 0);
    elements.audioPreview.addEventListener('loadedmetadata', done, { once: true });
    elements.audioPreview.addEventListener('error', () => resolve(0), { once: true });
  });
}

function updateModeUi() {
  const mode = getMode();
  elements.matchCard.classList.toggle('selected', mode === 'match');
  elements.autoCard.classList.toggle('selected', mode === 'auto');
  elements.autoFilterWrap.classList.toggle('visible', mode === 'auto');
}

function getMode() {
  return document.querySelector('input[name="mode"]:checked')?.value || 'match';
}

function processCurrentFile() {
  clearError();
  revokeDownload();
  if (!state.file) {
    showError('Select an MP3 before processing.');
    return;
  }

  const mode = getMode();
  if (mode === 'match') {
    if (!state.duration) {
      showError('Duration metadata is required for selected-section matching. Try another MP3 file.');
      return;
    }
    if (state.selection.end <= state.selection.start) {
      showError('End time must be greater than start time.');
      return;
    }
  }

  state.processing = true;
  elements.processButton.disabled = true;
  elements.cancelButton.disabled = false;
  elements.resetButton.disabled = true;
  elements.gainReadout.textContent = 'Gain: —';
  setStatus(mode === 'match' ? 'Analyzing selected section' : 'Processing MP3', 8);

  state.worker.postMessage({
    type: 'process',
    payload: {
      file: state.file,
      mode,
      start: state.selection.start,
      end: state.selection.end,
      autoFilter: elements.autoFilter.value,
      preferMultiThread: state.preferMultiThread
    }
  });
}

function cancelProcessing() {
  if (!state.processing) return;
  setStatus('Cancelling…', 0);
  elements.cancelButton.disabled = true;
  state.worker.postMessage({ type: 'cancel' });
}

function onWorkerMessage(event) {
  const { type, status, error, blob, meta, progress } = event.data || {};
  if (type === 'status') {
    if (status?.runtimeMode) setRuntimeMode(status.runtimeMode === 'fast' ? 'Fast mode enabled' : 'Compatibility mode enabled');
    setStatus(status?.message || 'Working…', status?.progress ?? undefined);
  }

  if (type === 'ffmpeg-progress' && state.processing) {
    const base = getMode() === 'match' ? 64 : 18;
    const range = getMode() === 'match' ? 27 : 72;
    setProgress(base + progress * range);
  }

  if (type === 'done') handleDone(blob, meta);
  if (type === 'cancelled') handleCancelled();
  if (type === 'error') handleWorkerError(error);
}

function handleDone(blob, meta = {}) {
  state.processing = false;
  elements.processButton.disabled = false;
  elements.cancelButton.disabled = true;
  elements.resetButton.disabled = false;
  state.downloadUrl = URL.createObjectURL(blob);
  elements.downloadButton.href = state.downloadUrl;
  elements.downloadButton.classList.remove('disabled');
  elements.downloadButton.setAttribute('aria-disabled', 'false');
  const safeName = (state.file?.name || 'output.mp3').replace(/\.mp3$/i, '');
  elements.downloadButton.download = `${safeName}-volumeflow-fast.mp3`;
  if (Number.isFinite(meta.gain)) {
    elements.gainReadout.textContent = `Gain: ${meta.gain.toFixed(2)} dB`;
  } else if (meta.filter) {
    elements.gainReadout.textContent = `Filter: ${meta.filter}`;
  }
  setStatus('Ready to download', 100);
}

function handleCancelled() {
  state.worker.terminate();
  createWorker();
  warmupFfmpeg();
  state.processing = false;
  elements.processButton.disabled = !state.file;
  elements.cancelButton.disabled = true;
  elements.resetButton.disabled = false;
  setStatus('Cancelled. FFmpeg is reloading for the next run.', 0);
}

function handleWorkerError(error) {
  state.processing = false;
  elements.processButton.disabled = !state.file;
  elements.cancelButton.disabled = true;
  elements.resetButton.disabled = false;
  showError(error || 'Processing failed.');
  setStatus('Processing failed', 0);
}

function updateSelectionFromInputs(changed) {
  const max = state.duration || Number.POSITIVE_INFINITY;
  const start = clamp(Number.parseFloat(elements.startTime.value) || 0, 0, max);
  const end = clamp(Number.parseFloat(elements.endTime.value) || 0, 0, max);
  state.selection = changed === 'start'
    ? { start: Math.min(start, Math.max(0, end - 0.01)), end }
    : { start, end: Math.max(end, start + 0.01) };
  updateSelectionUi();
}

function installHandleDrag(handle, edge) {
  handle.addEventListener('pointerdown', (event) => {
    if (!state.duration) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent) => {
      const rect = elements.waveformCanvas.getBoundingClientRect();
      const ratio = clamp((moveEvent.clientX - rect.left) / rect.width, 0, 1);
      const value = ratio * state.duration;
      if (edge === 'start') state.selection.start = Math.min(value, state.selection.end - 0.01);
      else state.selection.end = Math.max(value, state.selection.start + 0.01);
      updateSelectionUi();
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up, { once: true });
  });
}

function updateSelectionUi() {
  const { start, end } = state.selection;
  elements.startTime.value = Number.isFinite(start) ? start.toFixed(2) : '0.00';
  elements.endTime.value = Number.isFinite(end) ? end.toFixed(2) : '0.00';
  elements.selectionLabel.textContent = `${formatTime(start)} → ${formatTime(end)}`;
  const startPct = state.duration ? (start / state.duration) * 100 : 0;
  const endPct = state.duration ? (end / state.duration) * 100 : 100;
  elements.startHandle.style.left = `${clamp(startPct, 0, 100)}%`;
  elements.endHandle.style.left = `${clamp(endPct, 0, 100)}%`;
  elements.startHandle.setAttribute('aria-valuemax', String(Math.round(state.duration || 0)));
  elements.endHandle.setAttribute('aria-valuemax', String(Math.round(state.duration || 0)));
  elements.startHandle.setAttribute('aria-valuenow', String(Math.round(start || 0)));
  elements.endHandle.setAttribute('aria-valuenow', String(Math.round(end || 0)));
  redraw();
}

function redraw() {
  drawWaveform(elements.waveformCanvas, state.peaks, state.selection, state.duration);
}

function resetApp() {
  if (state.processing) return;
  revokePreview();
  revokeDownload();
  state.file = null;
  state.duration = 0;
  state.peaks = null;
  state.selection = { start: 0, end: 0 };
  elements.fileInput.value = '';
  elements.fileName.textContent = 'No MP3 selected';
  elements.fileSize.textContent = '—';
  elements.fileDuration.textContent = '—';
  elements.audioPreview.removeAttribute('src');
  elements.audioPreview.load();
  elements.startTime.value = '0';
  elements.endTime.value = '0';
  elements.processButton.disabled = true;
  elements.resetButton.disabled = true;
  elements.gainReadout.textContent = 'Gain: —';
  clearError();
  updateSelectionUi();
  setStatus('Select an MP3 to begin.', 0);
}

function revokePreview() {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = null;
}

function revokeDownload() {
  if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);
  state.downloadUrl = null;
  elements.downloadButton.removeAttribute('href');
  elements.downloadButton.classList.add('disabled');
  elements.downloadButton.setAttribute('aria-disabled', 'true');
}

function setRuntimeMode(text) {
  elements.runtimeMode.textContent = text;
}

function setStatus(text, progress) {
  elements.statusText.textContent = text;
  if (progress !== undefined) setProgress(progress);
}

function setProgress(progress) {
  elements.progressBar.style.width = `${clamp(progress, 0, 100)}%`;
}

function showError(message) {
  elements.errorText.textContent = message;
}

function clearError() {
  elements.errorText.textContent = '';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      // The app still works without SW caching, such as on file:// during local testing.
    });
  });
}
