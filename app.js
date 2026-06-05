// Browser app controller for Studio Voice Cleaner. It keeps capture, preview,
// processing, A/B comparison, and downloads local to the browser.
(function () {
  'use strict';

  const controlsDefinition = [
    ['nr', 'Noise Reduction Amount', 0, 100, 1, '%'],
    ['protection', 'Voice Protection', 0, 100, 1, '%'],
    ['gate', 'Gate Threshold', -80, -25, 1, ' dB'],
    ['clarity', 'Voice Clarity', 0, 100, 1, '%'],
    ['warmth', 'Warmth', 0, 100, 1, '%'],
    ['compression', 'Compression', 0, 100, 1, '%'],
    ['deesser', 'De-esser', 0, 100, 1, '%'],
    ['loudness', 'Output Loudness', -24, -10, 1, ' LUFS']
  ];

  const els = {
    heroStartBtn: document.querySelector('#heroStartBtn'),
    heroUploadBtn: document.querySelector('#heroUploadBtn'),
    recordBtn: document.querySelector('#recordBtn'),
    stopBtn: document.querySelector('#stopBtn'),
    fileInput: document.querySelector('#fileInput'),
    recordTimer: document.querySelector('#recordTimer'),
    originalPlayer: document.querySelector('#originalPlayer'),
    processedPlayer: document.querySelector('#processedPlayer'),
    playOriginalBtn: document.querySelector('#playOriginalBtn'),
    playProcessedBtn: document.querySelector('#playProcessedBtn'),
    abBtn: document.querySelector('#abBtn'),
    captureNoiseBtn: document.querySelector('#captureNoiseBtn'),
    processBtn: document.querySelector('#processBtn'),
    downloadBtn: document.querySelector('#downloadBtn'),
    controls: document.querySelector('#controls'),
    waveform: document.querySelector('#waveform'),
    progressBar: document.querySelector('#progressBar'),
    progressText: document.querySelector('#progressText'),
    statusText: document.querySelector('#statusText'),
    stateDot: document.querySelector('#stateDot')
  };

  let audioContext;
  let mediaRecorder;
  let mediaStream;
  let recordStart = 0;
  let timerId;
  let chunks = [];
  let originalBuffer;
  let processedBuffer;
  let originalUrl;
  let processedUrl;
  let wavUrl;
  let noiseProfile;
  let compareMode = 'original';
  const settings = StudioAudioEngine.defaultSettings();

  initControls();
  bindEvents();
  setStatus('Ready');

  function bindEvents() {
    els.heroStartBtn.addEventListener('click', startRecording);
    els.heroUploadBtn.addEventListener('click', () => els.fileInput.click());
    els.recordBtn.addEventListener('click', startRecording);
    els.stopBtn.addEventListener('click', stopRecording);
    els.fileInput.addEventListener('change', handleFileUpload);
    els.captureNoiseBtn.addEventListener('click', captureNoise);
    els.processBtn.addEventListener('click', () => processCurrent(getSelectedQuality()));
    els.downloadBtn.addEventListener('click', downloadHighQualityWav);
    els.playOriginalBtn.addEventListener('click', () => els.originalPlayer.paused ? els.originalPlayer.play() : els.originalPlayer.pause());
    els.playProcessedBtn.addEventListener('click', () => els.processedPlayer.paused ? els.processedPlayer.play() : els.processedPlayer.pause());
    els.abBtn.addEventListener('click', toggleAB);
    document.querySelectorAll('.preset').forEach((button) => {
      button.addEventListener('click', () => applyPreset(button.dataset.preset, button.textContent));
    });
  }

  function initControls() {
    controlsDefinition.forEach(([key, label, min, max, step, unit]) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'control';
      wrapper.innerHTML = `
        <label for="${key}"><span>${label}</span><output id="${key}Out"></output></label>
        <input id="${key}" type="range" min="${min}" max="${max}" step="${step}">
      `;
      els.controls.appendChild(wrapper);
      const input = wrapper.querySelector('input');
      const output = wrapper.querySelector('output');
      input.value = settings[key];
      const update = () => {
        settings[key] = Number(input.value);
        output.value = `${settings[key]}${unit}`;
      };
      input.addEventListener('input', update);
      update();
    });
  }

  function applyPreset(name, label) {
    Object.assign(settings, StudioAudioEngine.PRESETS[name]);
    controlsDefinition.forEach(([key, , , , , unit]) => {
      document.querySelector(`#${key}`).value = settings[key];
      document.querySelector(`#${key}Out`).value = `${settings[key]}${unit}`;
    });
    setStatus(`Preset loaded: ${label || name}`);
  }

  async function ensureAudioContext() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') await audioContext.resume();
    return audioContext;
  }

  async function startRecording() {
    try {
      const context = await ensureAudioContext();
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      await maybeLoadWorklet(context);
      chunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
      mediaRecorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
      mediaRecorder.onstop = finishRecording;
      mediaRecorder.start(250);
      recordStart = performance.now();
      timerId = setInterval(updateTimer, 100);
      els.heroStartBtn.disabled = true;
      els.recordBtn.disabled = true;
      els.stopBtn.disabled = false;
      setStatus('Recording…', 'busy');
    } catch (error) {
      setStatus(`Microphone error: ${friendlyMicError(error)}`, 'error');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
    clearInterval(timerId);
    els.heroStartBtn.disabled = false;
    els.recordBtn.disabled = false;
    els.stopBtn.disabled = true;
    setStatus('Decoding recording…', 'busy');
  }

  async function finishRecording() {
    try {
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      await loadBlob(blob, 'recording.webm');
      setStatus('Recording loaded');
    } catch (error) {
      setStatus(`Could not decode recording: ${error.message}`, 'error');
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      setStatus('Loading audio file…', 'busy');
      await loadBlob(file, file.name);
      setStatus(`Loaded ${file.name}`);
    } catch (error) {
      setStatus(`Upload error: ${error.message}`, 'error');
    }
  }

  async function loadBlob(blob, name) {
    const context = await ensureAudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    originalBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    processedBuffer = null;
    noiseProfile = null;
    revokeUrls();
    originalUrl = URL.createObjectURL(blob);
    els.originalPlayer.src = originalUrl;
    els.processedPlayer.removeAttribute('src');
    els.playOriginalBtn.disabled = false;
    els.playProcessedBtn.disabled = true;
    els.abBtn.disabled = true;
    els.captureNoiseBtn.disabled = false;
    els.processBtn.disabled = false;
    els.downloadBtn.disabled = true;
    setProgress(0, `Loaded ${name}. Capture a noise profile or process directly.`);
    drawWaveform(originalBuffer, null);
  }

  async function captureNoise() {
    if (!originalBuffer) return;
    setStatus('Capturing noise profile…', 'busy');
    noiseProfile = await StudioAudioEngine.captureNoiseProfile(originalBuffer, 2);
    setStatus('Noise profile captured from first 2 seconds');
    setProgress(0, 'Noise profile ready.');
  }

  async function processCurrent(mode) {
    if (!originalBuffer) return;
    try {
      setBusy(true);
      setStatus(mode === 'high' ? 'High quality processing…' : 'Fast preview processing…', 'busy');
      processedBuffer = await StudioAudioEngine.processAudioBuffer(originalBuffer, { ...settings }, noiseProfile, mode, setProgress);
      const wavBlob = WavExport.audioBufferToWav(processedBuffer);
      if (processedUrl) URL.revokeObjectURL(processedUrl);
      processedUrl = URL.createObjectURL(wavBlob);
      els.processedPlayer.src = processedUrl;
      els.playProcessedBtn.disabled = false;
      els.abBtn.disabled = false;
      els.downloadBtn.disabled = false;
      drawWaveform(originalBuffer, processedBuffer);
      setStatus('Processed preview ready');
    } catch (error) {
      setStatus(`Processing failed: ${error.message}`, 'error');
      setProgress(0, 'Processing failed. Try a shorter file or close other tabs.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadHighQualityWav() {
    if (!originalBuffer) return;
    setStatus('Rendering high quality WAV for download…', 'busy');
    setBusy(true);
    try {
      const exportBuffer = await StudioAudioEngine.processAudioBuffer(originalBuffer, { ...settings }, noiseProfile, 'high', setProgress);
      const blob = WavExport.audioBufferToWav(exportBuffer);
      if (wavUrl) URL.revokeObjectURL(wavUrl);
      wavUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = wavUrl;
      link.download = `studio-voice-cleaner-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
      link.click();
      processedBuffer = exportBuffer;
      if (processedUrl) URL.revokeObjectURL(processedUrl);
      processedUrl = URL.createObjectURL(blob);
      els.processedPlayer.src = processedUrl;
      drawWaveform(originalBuffer, processedBuffer);
      setStatus('High quality WAV downloaded');
    } catch (error) {
      setStatus(`Export failed: ${error.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  function toggleAB() {
    if (!processedBuffer) return;
    const currentTime = compareMode === 'original' ? els.originalPlayer.currentTime : els.processedPlayer.currentTime;
    els.originalPlayer.pause();
    els.processedPlayer.pause();
    compareMode = compareMode === 'original' ? 'processed' : 'original';
    const player = compareMode === 'original' ? els.originalPlayer : els.processedPlayer;
    player.currentTime = Math.min(currentTime, player.duration || currentTime);
    player.play();
    els.abBtn.textContent = `A/B Compare: ${compareMode === 'original' ? 'Original' : 'Processed'}`;
  }

  function drawWaveform(before, after) {
    const canvas = els.waveform;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    if (before) plotBuffer(ctx, before, width, height, '#6ee7ff', 0.9);
    if (after) plotBuffer(ctx, after, width, height, '#a78bfa', 0.82);
  }

  function plotBuffer(ctx, audioBuffer, width, height, color, alpha) {
    const data = audioBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / width));
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (let x = 0; x < width; x += 1) {
      let min = 1;
      let max = -1;
      for (let i = 0; i < step; i += 1) {
        const sample = data[x * step + i] || 0;
        min = Math.min(min, sample);
        max = Math.max(max, sample);
      }
      ctx.moveTo(x, (1 + min) * height / 2);
      ctx.lineTo(x, (1 + max) * height / 2);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function getSelectedQuality() {
    return document.querySelector('input[name="quality"]:checked').value;
  }

  function updateTimer() {
    const elapsed = (performance.now() - recordStart) / 1000;
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = Math.floor(elapsed % 60).toString().padStart(2, '0');
    const tenths = Math.floor((elapsed % 1) * 10);
    els.recordTimer.textContent = `${minutes}:${seconds}.${tenths}`;
  }

  function setProgress(percent, text) {
    els.progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    els.progressText.textContent = text;
  }

  function setStatus(text, type = 'ok') {
    els.statusText.textContent = text;
    els.stateDot.classList.toggle('busy', type === 'busy');
    els.stateDot.classList.toggle('error', type === 'error');
  }

  function setBusy(isBusy) {
    els.processBtn.disabled = isBusy || !originalBuffer;
    els.downloadBtn.disabled = isBusy || !processedBuffer;
    els.captureNoiseBtn.disabled = isBusy || !originalBuffer;
  }

  function friendlyMicError(error) {
    if (error.name === 'NotAllowedError') return 'permission was denied. Enable microphone access in your browser settings.';
    if (error.name === 'NotFoundError') return 'no microphone was found.';
    if (!navigator.mediaDevices) return 'this browser does not support microphone recording.';
    return error.message || error.name || 'unknown microphone problem.';
  }

  async function maybeLoadWorklet(context) {
    if (!context.audioWorklet || maybeLoadWorklet.loaded) return;
    try {
      await context.audioWorklet.addModule('worklet/noise-processor.js');
      maybeLoadWorklet.loaded = true;
    } catch (error) {
      console.info('AudioWorklet preview helper unavailable:', error);
    }
  }

  function revokeUrls() {
    [originalUrl, processedUrl, wavUrl].filter(Boolean).forEach((url) => URL.revokeObjectURL(url));
    originalUrl = processedUrl = wavUrl = undefined;
  }
}());
