const FFMPEG_VERSION = '0.12.10';
const FFMPEG_BASE = `https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/umd`;
const UTIL_BASE = `https://unpkg.com/@ffmpeg/util@${FFMPEG_VERSION}/dist/umd`;
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${FFMPEG_VERSION}/dist/umd`;

let ffmpeg;
let loaded = false;
let logLines = [];
let activeInputName = '';
let activeOutputName = '';
let execProgress = { label: 'Processing audio', base: 0, span: 0 };

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  if (type === 'cleanup') {
    await cleanupFiles();
    return;
  }

  if (type !== 'process') return;

  try {
    await ensureFFmpegLoaded();
    const result = await processAudio(payload);
    self.postMessage({ type: 'done', payload: result }, [result.data.buffer]);
  } catch (error) {
    await cleanupFiles();
    self.postMessage({ type: 'error', payload: { message: friendlyWorkerError(error) } });
  }
};

async function ensureFFmpegLoaded() {
  if (loaded) return;

  postProgress('Loading FFmpeg engine in worker', 8);
  if (!self.FFmpegWASM || !self.FFmpegUtil) {
    importScripts(`${FFMPEG_BASE}/ffmpeg.js`, `${UTIL_BASE}/index.js`);
  }

  const { FFmpeg } = self.FFmpegWASM;
  const { toBlobURL } = self.FFmpegUtil;
  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    logLines.push(message);
    if (logLines.length > 500) logLines.shift();
  });

  ffmpeg.on('progress', ({ progress }) => {
    if (Number.isFinite(progress) && execProgress.span) {
      const bounded = Math.max(0, Math.min(1, progress));
      postProgress(execProgress.label, execProgress.base + Math.round(bounded * execProgress.span));
    }
  });

  await ffmpeg.load({
    coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  loaded = true;
  postProgress('FFmpeg ready', 18);
}

async function processAudio(payload) {
  const safeBase = sanitizeBaseName(payload.fileName);
  const inputExt = sanitizeExtension(payload.extension || 'audio');
  const outputFormat = payload.outputFormat === 'mp3' ? 'mp3' : 'wav';
  activeInputName = `${safeBase || 'input'}.${inputExt}`;
  activeOutputName = `${safeBase || 'volumeflow'}-leveled.${outputFormat}`;
  logLines = [];

  await cleanupFiles();
  activeInputName = `${safeBase || 'input'}.${inputExt}`;
  activeOutputName = `${safeBase || 'volumeflow'}-leveled.${outputFormat}`;

  postProgress('Reading local file inside worker', 20);
  const fileBuffer = await payload.file.arrayBuffer();
  postProgress('Writing temporary file to FFmpeg virtual filesystem', 22);
  await ffmpeg.writeFile(activeInputName, new Uint8Array(fileBuffer));

  let filter;
  if (payload.mode === 'reference') {
    filter = await buildReferenceMatchFilter(payload.selection, payload.automatic?.peakProtection !== false);
  } else {
    filter = buildAutomaticFilter(payload.automatic);
  }

  postProgress('Rendering final audio in worker', 58);
  try {
    setExecProgress('Exporting processed audio', 58, 34);
    await ffmpeg.exec(buildExportArgs(filter, outputFormat));
  } catch (error) {
    if (outputFormat === 'mp3') {
      postProgress('MP3 encoder unavailable; falling back to WAV export', 62);
      activeOutputName = `${safeBase || 'volumeflow'}-leveled.wav`;
      setExecProgress('Exporting fallback WAV audio', 62, 30);
      await ffmpeg.exec(buildExportArgs(filter, 'wav'));
      const wavData = await ffmpeg.readFile(activeOutputName);
      await cleanupFiles();
      return { data: wavData, format: 'wav' };
    }
    throw error;
  }

  postProgress('Reading processed output from FFmpeg virtual filesystem', 94);
  const data = await ffmpeg.readFile(activeOutputName);
  await cleanupFiles();
  postProgress('Cleaning temporary audio data', 98);
  return { data, format: outputFormat };
}

async function buildReferenceMatchFilter(selection, peakProtection) {
  const selectedDuration = Math.max(0.25, (selection?.end || 0) - (selection?.start || 0));

  postProgress('Analyzing selected reference region loudness', 30);
  const referenceMean = await analyzeMeanVolume('Analyzing selected reference region loudness', 30, 10, [
    '-hide_banner',
    '-ss', String(Math.max(0, selection?.start || 0)),
    '-t', String(selectedDuration),
    '-i', activeInputName,
    '-af', 'volumedetect',
    '-f', 'null',
    '-',
  ]);

  postProgress('Analyzing whole-file loudness', 44);
  const fullMean = await analyzeMeanVolume('Analyzing whole-file loudness', 44, 8, [
    '-hide_banner',
    '-i', activeInputName,
    '-af', 'volumedetect',
    '-f', 'null',
    '-',
  ]);

  const gainDb = clamp(referenceMean - fullMean, -18, 18);
  const stages = [`volume=${gainDb.toFixed(2)}dB`];
  if (peakProtection) stages.push('alimiter=limit=0.97');
  postProgress(`Applying ${gainDb.toFixed(1)} dB gain to match selected region`, 54);
  return stages.join(',');
}

async function analyzeMeanVolume(label, base, span, args) {
  logLines = [];
  setExecProgress(label, base, span);
  await ffmpeg.exec(args);
  const logs = logLines.join('\n');
  const match = logs.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
  if (!match) {
    throw new Error('Could not analyze loudness for this file. Try a shorter selection or a different format.');
  }
  return Number(match[1]);
}

function buildAutomaticFilter(settings = {}) {
  const peakLimiter = settings.peakProtection === false ? '' : ',alimiter=limit=0.97';
  const target = clamp(Number(settings.targetLoudness) || -16, -24, -10);

  postProgress('Preparing automatic FFmpeg normalization filter', 42);
  if (settings.filter === 'dynaudnorm') {
    return `dynaudnorm=f=250:g=15:p=0.95:m=20${peakLimiter}`;
  }
  return `loudnorm=I=${target}:TP=-1.5:LRA=11:linear=false${peakLimiter}`;
}

function buildExportArgs(filter, outputFormat) {
  const args = [
    '-hide_banner',
    '-i', activeInputName,
    '-vn',
    '-af', filter,
  ];

  if (outputFormat === 'mp3') {
    args.push('-codec:a', 'libmp3lame', '-b:a', '192k', '-f', 'mp3', activeOutputName);
  } else {
    args.push('-codec:a', 'pcm_s16le', '-f', 'wav', activeOutputName);
  }

  return args;
}

async function cleanupFiles() {
  if (!ffmpeg) return;
  await Promise.allSettled(
    [activeInputName, activeOutputName].filter(Boolean).map((name) => ffmpeg.deleteFile(name)),
  );
}

function setExecProgress(label, base, span) {
  execProgress = { label, base, span };
}

function postProgress(message, progress) {
  self.postMessage({ type: 'progress', payload: { message, progress } });
}

function sanitizeBaseName(fileName = '') {
  return fileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

function sanitizeExtension(extension = 'audio') {
  return extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'audio';
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function friendlyWorkerError(error) {
  const message = String(error?.message || error || 'Unknown FFmpeg worker error.');
  if (/memory|allocation|out of bounds|ArrayBuffer|abort/i.test(message)) {
    return 'This device does not have enough browser memory for that file. Try WAV output, close other tabs, use a desktop browser, or process a shorter file.';
  }
  if (/fetch|network|load|importScripts|ffmpeg-core/i.test(message)) {
    return 'FFmpeg could not load in this browser. Check your network connection and try again.';
  }
  if (/libmp3lame|Unknown encoder/i.test(message)) {
    return 'MP3 export is not supported by this FFmpeg build. Choose WAV output and process again.';
  }
  return message;
}
