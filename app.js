const formats = [
  { id: 'mp3', name: 'MP3', detail: 'Universal', codec: ['-codec:a', 'libmp3lame', '-q:a', '2'] },
  { id: 'wav', name: 'WAV', detail: 'Lossless', codec: ['-codec:a', 'pcm_s16le'] },
  { id: 'm4a', name: 'M4A', detail: 'Apple', codec: ['-codec:a', 'aac', '-b:a', '256k'] },
  { id: 'flac', name: 'FLAC', detail: 'Hi-res', codec: ['-codec:a', 'flac'] },
  { id: 'ogg', name: 'OGG', detail: 'Open', codec: ['-codec:a', 'libvorbis', '-q:a', '6'] },
  { id: 'aac', name: 'AAC', detail: 'Compact', codec: ['-codec:a', 'aac', '-b:a', '256k'] },
  { id: 'opus', name: 'OPUS', detail: 'Modern', codec: ['-codec:a', 'libopus', '-b:a', '192k'] },
  { id: 'wma', name: 'WMA', detail: 'Windows', codec: ['-codec:a', 'wmav2', '-b:a', '256k'] },
  { id: 'aiff', name: 'AIFF', detail: 'Studio', codec: ['-codec:a', 'pcm_s16be'] },
];

const SESSION_KEYS = ['waveshift:source', 'waveshift:converted'];
const $ = (selector) => document.querySelector(selector);
const views = ['uploadView', 'workspaceView', 'progressView', 'successView'];
let inputFile;
let outputUrl;
let selectedFormat = formats[0];
let ffmpeg;
let toastTimer;

const formatGrid = $('#formatGrid');
formats.forEach((format) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `format-option${format === selectedFormat ? ' selected' : ''}`;
  button.innerHTML = `<b>${format.name}</b><small>${format.detail}</small>`;
  button.addEventListener('click', () => {
    selectedFormat = format;
    document.querySelectorAll('.format-option').forEach((item) => item.classList.remove('selected'));
    button.classList.add('selected');
  });
  formatGrid.append(button);
});

function showView(id) {
  views.forEach((view) => $(`#${view}`).classList.toggle('hidden', view !== id));
}

function setStep(step) {
  document.querySelectorAll('.step').forEach((item, index) => {
    item.classList.toggle('active', index + 1 === step);
    item.classList.toggle('complete', index + 1 < step);
  });
  document.querySelectorAll('.step-line i').forEach((line, index) => line.style.width = index + 1 < step ? '100%' : '0');
}

function prettyBytes(bytes) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const rank = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** rank)).toFixed(rank ? 1 : 0)} ${units[rank]}`;
}

function stripExtension(name) {
  return name.replace(/\.[^/.]+$/, '');
}

function notify(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
}

function clearStoredAudio() {
  SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function temporarilyStore(key, blob, name) {
  try {
    const dataUrl = await blobToDataUrl(blob);
    localStorage.setItem(key, JSON.stringify({ name, type: blob.type, size: blob.size, dataUrl }));
  } catch (error) {
    console.warn('WaveShift could not cache this file in localStorage:', error);
    notify('This file is larger than your browser storage limit. It remains private and conversion will still work.');
  }
}

async function selectFile(file) {
  if (!file) return;
  if (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|m4a|aac|ogg|opus|wma|aiff?)$/i.test(file.name)) {
    notify('Please choose an audio file to continue.');
    return;
  }
  clearStoredAudio();
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  inputFile = file;
  $('#fileName').textContent = file.name;
  $('#fileType').textContent = `${(file.name.split('.').pop() || 'audio').toUpperCase()} audio`;
  $('#fileSize').textContent = prettyBytes(file.size);
  await temporarilyStore(SESSION_KEYS[0], file, file.name);
  showView('workspaceView');
  setStep(2);
}

async function ensureFFmpeg() {
  if (ffmpeg) return ffmpeg;
  $('#progressText').textContent = 'Loading the private audio engine for the first time';
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
    import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js'),
    import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js'),
  ]);
  ffmpeg = new FFmpeg();
  ffmpeg.on('progress', ({ progress }) => updateProgress(Math.max(16, Math.round(progress * 100))));
  const coreBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  return ffmpeg;
}

function updateProgress(value) {
  const safeValue = Math.min(100, Math.max(0, value));
  $('#progressBar').style.width = `${safeValue}%`;
  $('#progressValue').textContent = `${safeValue}%`;
  if (safeValue > 22) $('#progressText').textContent = `Encoding a high-quality ${selectedFormat.name} file`;
}

async function convert() {
  if (!inputFile) return;
  setStep(3);
  showView('progressView');
  updateProgress(4);
  const inputExtension = (inputFile.name.split('.').pop() || 'audio').toLowerCase();
  const inputName = `input.${inputExtension}`;
  const outputName = `${stripExtension(inputFile.name)}.${selectedFormat.id}`;
  try {
    const [{ fetchFile }, engine] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js'),
      ensureFFmpeg(),
    ]);
    updateProgress(14);
    await engine.writeFile(inputName, await fetchFile(inputFile));
    await engine.exec(['-i', inputName, '-vn', ...selectedFormat.codec, outputName]);
    const bytes = await engine.readFile(outputName);
    await engine.deleteFile(inputName);
    await engine.deleteFile(outputName);
    const result = new Blob([bytes.buffer], { type: `audio/${selectedFormat.id}` });
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = URL.createObjectURL(result);
    $('#downloadButton').href = outputUrl;
    $('#downloadButton').download = outputName;
    $('#resultName').textContent = outputName;
    $('#resultSize').textContent = `${prettyBytes(result.size)} · ${selectedFormat.name} audio`;
    $('#successText').textContent = `Your ${selectedFormat.name} file has been converted in this browser and is ready to download.`;
    await temporarilyStore(SESSION_KEYS[1], result, outputName);
    updateProgress(100);
    setTimeout(() => showView('successView'), 300);
  } catch (error) {
    console.error(error);
    showView('workspaceView');
    setStep(2);
    notify('Conversion could not be completed. Check your connection for the first engine load, then try another audio file.');
  }
}

function reset() {
  clearStoredAudio();
  inputFile = undefined;
  $('#fileInput').value = '';
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  outputUrl = undefined;
  showView('uploadView');
  setStep(1);
}

const dropZone = $('#dropZone');
dropZone.addEventListener('click', () => $('#fileInput').click());
$('#fileInput').addEventListener('change', (event) => selectFile(event.target.files[0]));
['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.add('dragging');
}));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragging');
}));
dropZone.addEventListener('drop', (event) => selectFile(event.dataTransfer.files[0]));
$('#removeButton').addEventListener('click', reset);
$('#againButton').addEventListener('click', reset);
$('#convertButton').addEventListener('click', convert);
window.addEventListener('pagehide', clearStoredAudio);
window.addEventListener('beforeunload', clearStoredAudio);
clearStoredAudio();
