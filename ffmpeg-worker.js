/* global FFmpegWASM, FFmpegUtil */
const FFMPEG_VERSION = '0.12.10';
const CORE_VERSION = '0.12.6';
const CDN = 'https://unpkg.com';

let ffmpeg;
let loaded = false;
let loadPromise;
let activeLogs = [];
let runtimeMode = 'compatibility';
let currentInput = 'input.mp3';
let currentOutput = 'output.mp3';

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};
  try {
    if (type === 'warmup') {
      await ensureLoaded(payload?.preferMultiThread);
      postStatus('ready', runtimeMode === 'fast' ? 'Fast mode enabled' : 'Compatibility mode enabled', 0);
      return;
    }

    if (type === 'process') {
      await processMp3(payload);
      return;
    }

    if (type === 'cancel') {
      await cancelWork();
    }
  } catch (error) {
    postMessage({ type: 'error', error: normalizeError(error) });
  }
};

async function ensureLoaded(preferMultiThread = false) {
  if (loaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    postStatus('loading', 'Loading FFmpeg', 2);
    importScripts(`${CDN}/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/umd/ffmpeg.js`);
    importScripts(`${CDN}/@ffmpeg/util@${FFMPEG_VERSION}/dist/umd/index.js`);

    const { FFmpeg } = FFmpegWASM;
    const { toBlobURL } = FFmpegUtil;
    ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => activeLogs.push(message));
    ffmpeg.on('progress', ({ progress }) => {
      if (Number.isFinite(progress)) postMessage({ type: 'ffmpeg-progress', progress: Math.max(0, Math.min(1, progress)) });
    });

    const useMt = Boolean(preferMultiThread);
    const corePackage = useMt ? 'core-mt' : 'core';
    runtimeMode = useMt ? 'fast' : 'compatibility';
    const coreBase = `${CDN}/@ffmpeg/${corePackage}@${CORE_VERSION}/dist/umd`;

    // Multithread FFmpeg core requires a cross-origin isolated page. Hosting must send:
    // Cross-Origin-Opener-Policy: same-origin
    // Cross-Origin-Embedder-Policy: require-corp
    await ffmpeg.load({
      coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm'),
      ...(useMt ? { workerURL: await toBlobURL(`${coreBase}/ffmpeg-core.worker.js`, 'text/javascript') } : {})
    });

    loaded = true;
  })();

  return loadPromise;
}

async function processMp3(payload) {
  const { file, mode, start, end, autoFilter, preferMultiThread } = payload;
  await ensureLoaded(preferMultiThread);

  currentInput = `input-${Date.now()}.mp3`;
  currentOutput = `output-${Date.now()}.mp3`;
  await cleanupFile(currentInput);
  await cleanupFile(currentOutput);

  postStatus('writing', 'Preparing local MP3', 5);
  await ffmpeg.writeFile(currentInput, new Uint8Array(await file.arrayBuffer()));

  let resultMeta = {};
  if (mode === 'match') {
    const duration = Math.max(0.01, end - start);
    postStatus('analyzing-selection', 'Analyzing selected section', 12);
    const selectedMean = await runVolumeDetect(['-ss', String(start), '-t', String(duration), '-i', currentInput, '-af', 'volumedetect', '-f', 'null', '-']);

    postStatus('analyzing-full', 'Analyzing full audio', 34);
    const wholeMean = await runVolumeDetect(['-i', currentInput, '-af', 'volumedetect', '-f', 'null', '-']);

    postStatus('gain', 'Calculating gain', 58);
    const gain = selectedMean - wholeMean;
    resultMeta = { selectedMean, wholeMean, gain };

    postStatus('processing', 'Processing MP3', 64);
    await runFfmpeg(['-i', currentInput, '-af', `volume=${gain.toFixed(2)}dB`, '-c:a', 'libmp3lame', '-b:a', '320k', currentOutput]);
  } else {
    postStatus('processing', 'Processing MP3', 18);
    const filter = autoFilter === 'loudnorm' ? 'loudnorm=I=-16:TP=-1.5:LRA=11' : 'dynaudnorm';
    await runFfmpeg(['-i', currentInput, '-af', filter, '-c:a', 'libmp3lame', '-b:a', '320k', currentOutput]);
    resultMeta = { filter };
  }

  postStatus('exporting', 'Exporting MP3', 92);
  const output = await ffmpeg.readFile(currentOutput);
  const blob = new Blob([output], { type: 'audio/mpeg' });
  await cleanupFile(currentInput);
  await cleanupFile(currentOutput);
  postMessage({ type: 'done', blob, meta: resultMeta });
  postStatus('done', 'Ready to download', 100);
}

async function runVolumeDetect(args) {
  activeLogs = [];
  await ffmpeg.exec(['-hide_banner', ...args]);
  const logs = activeLogs.join('\n');
  const match = logs.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
  if (!match) throw new Error('FFmpeg did not report mean_volume. Try a different MP3 or a longer selected section.');
  return Number.parseFloat(match[1]);
}

async function runFfmpeg(args) {
  activeLogs = [];
  await ffmpeg.exec(['-hide_banner', '-y', ...args]);
}

async function cleanupFile(path) {
  if (!ffmpeg || !loaded) return;
  try { await ffmpeg.deleteFile(path); } catch (_) { /* File may not exist in the virtual FS. */ }
}

async function cancelWork() {
  if (ffmpeg) ffmpeg.terminate();
  ffmpeg = undefined;
  loaded = false;
  loadPromise = undefined;
  activeLogs = [];
  postMessage({ type: 'cancelled' });
}

function postStatus(code, message, progress) {
  postMessage({ type: 'status', status: { code, message, progress, runtimeMode } });
}

function normalizeError(error) {
  if (typeof error === 'string') return error;
  return error?.message || 'Unexpected FFmpeg worker error.';
}
