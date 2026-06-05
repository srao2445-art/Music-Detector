// RNNoise WebAssembly integration.
// RNNoise is used as the first cleanup stage only. After this denoising pass,
// audio-engine.js applies the professional DSP chain for tone, dynamics, safety,
// and export loudness. The WASM module is loaded in the browser and all samples
// are processed locally; no audio is uploaded for processing.
(function () {
  'use strict';

  const RNNOISE_MODULE_URL = 'https://unpkg.com/@echogarden/rnnoise-wasm@0.2.0/rnnoise.js';
  const RNNOISE_WASM_URL = 'https://unpkg.com/@echogarden/rnnoise-wasm@0.2.0/rnnoise.wasm';
  const REQUIRED_SAMPLE_RATE = 48000;

  let modulePromise;

  async function denoiseAudioBuffer(audioBuffer, onProgress = () => {}) {
    onProgress(6, 'Loading RNNoise WebAssembly denoiser…');
    const rnnoise = await getModule();
    const frameSize = rnnoise._rnnoise_get_frame_size ? rnnoise._rnnoise_get_frame_size() : 480;
    const processingBuffer = audioBuffer.sampleRate === REQUIRED_SAMPLE_RATE
      ? cloneAudioBuffer(audioBuffer)
      : await resampleAudioBuffer(audioBuffer, REQUIRED_SAMPLE_RATE);

    const output = new AudioBuffer({
      numberOfChannels: processingBuffer.numberOfChannels,
      length: processingBuffer.length,
      sampleRate: REQUIRED_SAMPLE_RATE
    });

    for (let channel = 0; channel < processingBuffer.numberOfChannels; channel += 1) {
      const samples = processingBuffer.getChannelData(channel);
      const { denoised, vad } = processChannel(rnnoise, samples, frameSize);
      output.copyToChannel(denoised, channel);
      onProgress(8 + ((channel + 1) / processingBuffer.numberOfChannels) * 22, `RNNoise voice denoising channel ${channel + 1}/${processingBuffer.numberOfChannels}…`);
      await yieldToUi();
      console.debug('RNNoise average VAD probability', average(vad).toFixed(3));
    }

    return output;
  }

  async function getModule() {
    if (!modulePromise) {
      modulePromise = import(RNNOISE_MODULE_URL).then((mod) => {
        const initializer = mod.default || mod;
        return initializer({ locateFile: (path) => path.endsWith('.wasm') ? RNNOISE_WASM_URL : path });
      });
    }
    return modulePromise;
  }

  function processChannel(rnnoise, samples, frameSize) {
    const state = rnnoise._rnnoise_create(0);
    const inputPtr = rnnoise._malloc(frameSize * Float32Array.BYTES_PER_ELEMENT);
    const outputPtr = rnnoise._malloc(frameSize * Float32Array.BYTES_PER_ELEMENT);
    const inputHeap = rnnoise.HEAPF32.subarray(inputPtr >> 2, (inputPtr >> 2) + frameSize);
    const outputHeap = rnnoise.HEAPF32.subarray(outputPtr >> 2, (outputPtr >> 2) + frameSize);
    const frames = [];
    const vadProbabilities = [];

    for (let offset = 0; offset < samples.length; offset += frameSize) {
      inputHeap.fill(0);
      for (let i = 0; i < frameSize && offset + i < samples.length; i += 1) {
        inputHeap[i] = Math.max(-32768, Math.min(32767, samples[offset + i] * 32768));
      }
      const vad = rnnoise._rnnoise_process_frame(state, outputPtr, inputPtr);
      vadProbabilities.push(vad);
      if (offset > 0) frames.push(Float32Array.from(outputHeap, (sample) => sample / 32768));
    }

    // RNNoise has one frame of algorithmic latency. Flush with silence so the
    // final spoken frame is preserved, then trim back to the original length.
    inputHeap.fill(0);
    const finalVad = rnnoise._rnnoise_process_frame(state, outputPtr, inputPtr);
    vadProbabilities.push(finalVad);
    frames.push(Float32Array.from(outputHeap, (sample) => sample / 32768));

    rnnoise._rnnoise_destroy(state);
    rnnoise._free(inputPtr);
    rnnoise._free(outputPtr);

    return { denoised: concatAndTrim(frames, samples.length), vad: vadProbabilities };
  }

  async function resampleAudioBuffer(audioBuffer, sampleRate) {
    const length = Math.ceil(audioBuffer.duration * sampleRate);
    const context = new OfflineAudioContext(audioBuffer.numberOfChannels, length, sampleRate);
    const source = new AudioBufferSourceNode(context, { buffer: audioBuffer });
    source.connect(context.destination);
    source.start();
    return context.startRendering();
  }

  function cloneAudioBuffer(audioBuffer) {
    const copy = new AudioBuffer({
      numberOfChannels: audioBuffer.numberOfChannels,
      length: audioBuffer.length,
      sampleRate: audioBuffer.sampleRate
    });
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      copy.copyToChannel(audioBuffer.getChannelData(channel), channel);
    }
    return copy;
  }

  function concatAndTrim(frames, length) {
    const output = new Float32Array(length);
    let writeOffset = 0;
    for (const frame of frames) {
      output.set(frame.subarray(0, Math.min(frame.length, length - writeOffset)), writeOffset);
      writeOffset += frame.length;
      if (writeOffset >= length) break;
    }
    return output;
  }

  function average(values) {
    return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  }

  function yieldToUi() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  window.RNNoiseWasmDenoiser = { denoiseAudioBuffer, REQUIRED_SAMPLE_RATE };
}());
