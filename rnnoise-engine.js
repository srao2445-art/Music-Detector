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

  async function denoiseAudioBuffer(audioBuffer, settings = {}, onProgress = () => {}) {
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
      const { denoised, vad } = processChannel(rnnoise, samples, frameSize, settings);
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

  function processChannel(rnnoise, samples, frameSize, settings) {
    const state = rnnoise._rnnoise_create(0);
    const inputPtr = rnnoise._malloc(frameSize * Float32Array.BYTES_PER_ELEMENT);
    const outputPtr = rnnoise._malloc(frameSize * Float32Array.BYTES_PER_ELEMENT);
    const inputHeap = rnnoise.HEAPF32.subarray(inputPtr >> 2, (inputPtr >> 2) + frameSize);
    const outputHeap = rnnoise.HEAPF32.subarray(outputPtr >> 2, (outputPtr >> 2) + frameSize);
    const frames = [];
    const vadProbabilities = [];
    const originalFrames = [];
    const protection = (settings.protection ?? 80) / 100;
    const requestedNoiseReduction = (settings.nr ?? 34) / 100;
    let previousEnergy = 0;

    for (let offset = 0; offset < samples.length; offset += frameSize) {
      inputHeap.fill(0);
      const originalFrame = new Float32Array(frameSize);
      for (let i = 0; i < frameSize && offset + i < samples.length; i += 1) {
        originalFrame[i] = samples[offset + i];
        inputHeap[i] = Math.max(-32768, Math.min(32767, samples[offset + i] * 32768));
      }
      originalFrames.push(originalFrame);
      const vad = rnnoise._rnnoise_process_frame(state, outputPtr, inputPtr);
      vadProbabilities.push(vad);
      if (offset > 0) {
        const delayedOriginal = originalFrames[originalFrames.length - 2];
        const speech = analyzeFrameForVoiceProtection(delayedOriginal, previousEnergy);
        previousEnergy = speech.energy;
        frames.push(blendRnnoiseFrame(delayedOriginal, outputHeap, vadProbabilities[vadProbabilities.length - 2] ?? vad, speech, protection, requestedNoiseReduction));
      }
    }

    // RNNoise has one frame of algorithmic latency. Flush with silence so the
    // final spoken frame is preserved, then trim back to the original length.
    inputHeap.fill(0);
    const finalVad = rnnoise._rnnoise_process_frame(state, outputPtr, inputPtr);
    vadProbabilities.push(finalVad);
    const delayedOriginal = originalFrames[originalFrames.length - 1] || new Float32Array(frameSize);
    const speech = analyzeFrameForVoiceProtection(delayedOriginal, previousEnergy);
    frames.push(blendRnnoiseFrame(delayedOriginal, outputHeap, vadProbabilities[vadProbabilities.length - 2] ?? finalVad, speech, protection, requestedNoiseReduction));

    rnnoise._rnnoise_destroy(state);
    rnnoise._free(inputPtr);
    rnnoise._free(outputPtr);

    return { denoised: concatAndTrim(frames, samples.length), vad: vadProbabilities };
  }


  function blendRnnoiseFrame(originalFrame, denoisedHeap, vad, speech, protection, requestedNoiseReduction) {
    const output = new Float32Array(originalFrame.length);
    const speechEvidence = Math.max(vad || 0, speech.voice, speech.transient * 0.85, speech.sibilance * 0.7);
    const silenceDenoise = 0.28 + requestedNoiseReduction * 0.42;
    const speechDenoise = 0.05 + requestedNoiseReduction * (0.26 - protection * 0.16);
    const rnnoiseMix = clamp01(silenceDenoise * (1 - speechEvidence) + speechDenoise * speechEvidence);
    const transientRestore = clamp01(speech.transient * (0.35 + protection * 0.45));
    const consonantRestore = clamp01(speech.sibilance * (0.25 + protection * 0.35));

    for (let i = 0; i < originalFrame.length; i += 1) {
      const original = originalFrame[i];
      const denoised = denoisedHeap[i] / 32768;
      const preserve = Math.max(transientRestore, consonantRestore * Math.abs(original) / Math.max(0.02, speech.peak));
      const mix = rnnoiseMix * (1 - preserve * 0.65);
      output[i] = denoised * mix + original * (1 - mix);
    }
    return output;
  }

  function analyzeFrameForVoiceProtection(frame, previousEnergy) {
    let sum = 0;
    let peak = 0;
    let zeroCrossings = 0;
    let previous = frame[0] || 0;
    for (let i = 0; i < frame.length; i += 1) {
      const sample = frame[i];
      sum += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
      if ((sample >= 0 && previous < 0) || (sample < 0 && previous >= 0)) zeroCrossings += 1;
      previous = sample;
    }
    const energy = Math.sqrt(sum / Math.max(1, frame.length));
    const zcr = zeroCrossings / Math.max(1, frame.length);
    const transient = Math.max(0, (energy - previousEnergy) / Math.max(previousEnergy, 1e-5));
    return {
      energy,
      peak,
      voice: smoothstep(0.006, 0.035, energy),
      transient: smoothstep(0.18, 1.6, transient) * smoothstep(0.004, 0.028, peak),
      sibilance: smoothstep(0.08, 0.22, zcr) * smoothstep(0.004, 0.025, energy)
    };
  }

  function smoothstep(edge0, edge1, value) {
    const x = clamp01((value - edge0) / Math.max(edge1 - edge0, 1e-9));
    return x * x * (3 - 2 * x);
  }

  function clamp01(value) { return Math.max(0, Math.min(1, value)); }

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
