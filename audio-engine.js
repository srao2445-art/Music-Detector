// Studio Voice Cleaner audio engine.
// RNNoise WASM runs first in rnnoise-engine.js; this file then applies
// deterministic Web Audio DSP, OfflineAudioContext rendering, and spectral polish.
(function () {
  'use strict';

  const PRESETS = {
    cleanVoice: { nr: 58, gate: -50, clarity: 60, warmth: 45, compression: 52, deesser: 45, loudness: -16 },
    studioEnhance: { nr: 50, gate: -52, clarity: 76, warmth: 62, compression: 62, deesser: 54, loudness: -14 },
    podcastVoice: { nr: 64, gate: -48, clarity: 68, warmth: 72, compression: 72, deesser: 50, loudness: -16 },
    lightNoise: { nr: 34, gate: -58, clarity: 48, warmth: 42, compression: 42, deesser: 34, loudness: -18 },
    strongNoise: { nr: 86, gate: -44, clarity: 58, warmth: 48, compression: 64, deesser: 62, loudness: -16 }
  };

  function defaultSettings() {
    return { ...PRESETS.cleanVoice };
  }

  async function captureNoiseProfile(audioBuffer, seconds = 2) {
    const mono = mixToMono(audioBuffer);
    const length = Math.min(mono.length, Math.floor(audioBuffer.sampleRate * seconds));
    const slice = mono.subarray(0, Math.max(1, length));
    return computeNoiseProfile(slice, audioBuffer.sampleRate, 4096, 1024);
  }

  async function processAudioBuffer(audioBuffer, settings, noiseProfile, mode, onProgress = () => {}) {
    const rnnoiseBuffer = await RNNoiseWasmDenoiser.denoiseAudioBuffer(audioBuffer, onProgress);
    const quality = mode === 'high' ? highQualityPlan(rnnoiseBuffer.sampleRate) : fastPlan(rnnoiseBuffer.sampleRate);
    onProgress(32, 'Preparing residual spectral polish after RNNoise…');

    const spectralBuffer = await runSpectralPasses(rnnoiseBuffer, settings, noiseProfile, quality, onProgress);
    onProgress(68, 'Offline rendering professional EQ, expander, compressor, and de-esser…');

    const rendered = await renderWebAudioChain(spectralBuffer, settings, quality);
    onProgress(84, 'Applying transparent limiter…');

    const limited = applyLookAheadLimiter(rendered, settings);
    onProgress(92, 'Normalizing loudness and preventing clipping…');

    const normalized = normalizeLoudness(limited, settings.loudness);
    onProgress(100, 'Processing complete.');
    return normalized;
  }

  function fastPlan(sampleRate) {
    return { fftSize: sampleRate > 48000 ? 4096 : 2048, hopRatio: 4, passes: 1, floor: 0.08, smoothing: 0.62 };
  }

  function highQualityPlan(sampleRate) {
    return { fftSize: sampleRate > 48000 ? 8192 : 4096, hopRatio: 4, passes: 2, floor: 0.045, smoothing: 0.78 };
  }

  async function runSpectralPasses(audioBuffer, settings, noiseProfile, quality, onProgress) {
    let working = cloneAudioBuffer(audioBuffer);
    for (let pass = 0; pass < quality.passes; pass += 1) {
      const output = createEmptyAudioBuffer(working.numberOfChannels, working.length, working.sampleRate);
      for (let channel = 0; channel < working.numberOfChannels; channel += 1) {
        const input = working.getChannelData(channel);
        const profile = noiseProfile || computeNoiseProfile(input.subarray(0, Math.min(input.length, working.sampleRate * 2)), working.sampleRate, quality.fftSize, Math.floor(quality.fftSize / quality.hopRatio));
        const cleaned = spectralSubtraction(input, profile, settings, quality, working.sampleRate);
        output.copyToChannel(cleaned, channel);
        onProgress(34 + ((pass * working.numberOfChannels + channel + 1) / (quality.passes * working.numberOfChannels)) * 26, 'Polishing residual steady noise after RNNoise…');
        await yieldToUi();
      }
      working = output;
    }
    return working;
  }

  function computeNoiseProfile(samples, sampleRate, fftSize, hopSize) {
    const window = hann(fftSize);
    const bins = new Float32Array(fftSize / 2 + 1);
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);
    let frames = 0;

    for (let start = 0; start < Math.max(1, samples.length - fftSize); start += hopSize) {
      real.fill(0); imag.fill(0);
      for (let i = 0; i < fftSize; i += 1) real[i] = (samples[start + i] || 0) * window[i];
      fft(real, imag, false);
      for (let bin = 0; bin < bins.length; bin += 1) bins[bin] += Math.hypot(real[bin], imag[bin]);
      frames += 1;
    }

    const inv = 1 / Math.max(1, frames);
    for (let bin = 0; bin < bins.length; bin += 1) bins[bin] *= inv;
    return { bins, sampleRate, fftSize, hopSize };
  }

  function spectralSubtraction(input, profile, settings, quality, sampleRate) {
    const fftSize = quality.fftSize;
    const hopSize = Math.floor(fftSize / quality.hopRatio);
    const window = hann(fftSize);
    const output = new Float32Array(input.length + fftSize);
    const norm = new Float32Array(output.length);
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);
    const previousGain = new Float32Array(fftSize / 2 + 1).fill(1);
    const noiseBins = resampleProfile(profile, fftSize);
    const amount = settings.nr / 100;
    const overSubtract = 0.75 + amount * 1.9;
    const floor = quality.floor + (1 - amount) * 0.08;

    for (let start = 0; start < input.length; start += hopSize) {
      real.fill(0); imag.fill(0);
      for (let i = 0; i < fftSize; i += 1) real[i] = (input[start + i] || 0) * window[i];
      fft(real, imag, false);

      for (let bin = 0; bin <= fftSize / 2; bin += 1) {
        const mag = Math.hypot(real[bin], imag[bin]) || 1e-12;
        const noise = noiseBins[bin] * overSubtract;
        let gain = Math.max(floor, (mag - noise) / mag);
        gain = quality.smoothing * previousGain[bin] + (1 - quality.smoothing) * gain;
        previousGain[bin] = gain;
        real[bin] *= gain;
        imag[bin] *= gain;
        if (bin > 0 && bin < fftSize / 2) {
          real[fftSize - bin] = real[bin];
          imag[fftSize - bin] = -imag[bin];
        }
      }

      fft(real, imag, true);
      for (let i = 0; i < fftSize; i += 1) {
        const index = start + i;
        const w = window[i];
        output[index] += real[i] * w;
        norm[index] += w * w;
      }
    }

    const trimmed = new Float32Array(input.length);
    for (let i = 0; i < trimmed.length; i += 1) trimmed[i] = output[i] / Math.max(1e-8, norm[i]);
    return applyGateAndExpander(trimmed, settings, sampleRate);
  }

  async function renderWebAudioChain(audioBuffer, settings, quality) {
    const context = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
    const source = new AudioBufferSourceNode(context, { buffer: audioBuffer });
    const hp = new BiquadFilterNode(context, { type: 'highpass', frequency: 65 + settings.warmth * 0.35, Q: 0.7 });
    const warm = new BiquadFilterNode(context, { type: 'lowshelf', frequency: 180, gain: (settings.warmth - 50) * 0.08 });
    const mudCut = new BiquadFilterNode(context, { type: 'peaking', frequency: 320, Q: 1.0, gain: -1.2 - settings.clarity * 0.018 });
    const presence = new BiquadFilterNode(context, { type: 'peaking', frequency: 3200, Q: 0.85, gain: (settings.clarity - 35) * 0.075 });
    const air = new BiquadFilterNode(context, { type: 'highshelf', frequency: 8500, gain: Math.max(-4, (settings.clarity - settings.deesser) * 0.045) });
    const lp = new BiquadFilterNode(context, { type: 'lowpass', frequency: 14500 - settings.deesser * 32, Q: 0.65 });
    const compressor = new DynamicsCompressorNode(context, {
      threshold: -28 + settings.compression * 0.12,
      knee: 18,
      ratio: 1.6 + settings.compression * 0.055,
      attack: quality.passes > 1 ? 0.006 : 0.004,
      release: 0.16
    });
    const deEsser = new BiquadFilterNode(context, { type: 'peaking', frequency: 6800, Q: 3.2, gain: -settings.deesser * 0.075 });
    const safetyGain = new GainNode(context, { gain: 0.9 });

    source.connect(hp).connect(warm).connect(mudCut).connect(presence).connect(air).connect(lp).connect(compressor).connect(deEsser).connect(safetyGain).connect(context.destination);
    source.start();
    return context.startRendering();
  }

  function applyGateAndExpander(input, settings, sampleRate) {
    const output = new Float32Array(input.length);
    const threshold = dbToGain(settings.gate);
    const attack = 0.008;
    const release = 0.09;
    const attackCoeff = Math.exp(-1 / (sampleRate * attack));
    const releaseCoeff = Math.exp(-1 / (sampleRate * release));
    let env = 0;
    let gain = 1;

    for (let i = 0; i < input.length; i += 1) {
      const level = Math.abs(input[i]);
      env = level > env ? attackCoeff * env + (1 - attackCoeff) * level : releaseCoeff * env + (1 - releaseCoeff) * level;
      const target = env < threshold ? Math.max(0.08, Math.pow(env / Math.max(threshold, 1e-6), 1.8)) : 1;
      gain = target < gain ? 0.92 * gain + 0.08 * target : 0.985 * gain + 0.015 * target;
      output[i] = input[i] * gain;
    }
    return output;
  }

  function applyLookAheadLimiter(audioBuffer, settings) {
    const lookAhead = Math.floor(audioBuffer.sampleRate * 0.004);
    const ceiling = 0.96;
    const output = createEmptyAudioBuffer(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const input = audioBuffer.getChannelData(channel);
      const data = new Float32Array(input.length);
      let gain = 1;
      for (let i = 0; i < input.length; i += 1) {
        let peak = 0;
        for (let j = 0; j < lookAhead && i + j < input.length; j += 1) peak = Math.max(peak, Math.abs(input[i + j]));
        const target = peak > ceiling ? ceiling / peak : 1;
        gain = target < gain ? 0.45 * gain + 0.55 * target : 0.995 * gain + 0.005 * target;
        data[i] = input[i] * gain;
      }
      output.copyToChannel(data, channel);
    }
    return output;
  }

  function normalizeLoudness(audioBuffer, targetLufs) {
    const output = createEmptyAudioBuffer(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
    let sum = 0;
    let count = 0;
    let peak = 0;
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const data = audioBuffer.getChannelData(channel);
      for (let i = 0; i < data.length; i += 1) {
        const sample = data[i];
        sum += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
        count += 1;
      }
    }
    const rms = Math.sqrt(sum / Math.max(1, count));
    const currentDb = gainToDb(rms) - 3; // RMS-to-LUFS approximation for speech material.
    const desiredGain = dbToGain(targetLufs - currentDb);
    const safeGain = Math.min(desiredGain, 0.96 / Math.max(peak, 1e-6));

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const input = audioBuffer.getChannelData(channel);
      const data = new Float32Array(input.length);
      for (let i = 0; i < input.length; i += 1) data[i] = Math.max(-0.98, Math.min(0.98, input[i] * safeGain));
      output.copyToChannel(data, channel);
    }
    return output;
  }

  function resampleProfile(profile, fftSize) {
    const target = new Float32Array(fftSize / 2 + 1);
    if (!profile || !profile.bins) return target;
    for (let i = 0; i < target.length; i += 1) {
      const pos = (i / (target.length - 1)) * (profile.bins.length - 1);
      const lo = Math.floor(pos);
      const hi = Math.min(profile.bins.length - 1, lo + 1);
      const frac = pos - lo;
      target[i] = profile.bins[lo] * (1 - frac) + profile.bins[hi] * frac;
    }
    return target;
  }

  function mixToMono(audioBuffer) {
    const mono = new Float32Array(audioBuffer.length);
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const data = audioBuffer.getChannelData(channel);
      for (let i = 0; i < mono.length; i += 1) mono[i] += data[i] / audioBuffer.numberOfChannels;
    }
    return mono;
  }

  function cloneAudioBuffer(audioBuffer) {
    const copy = createEmptyAudioBuffer(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) copy.copyToChannel(audioBuffer.getChannelData(channel), channel);
    return copy;
  }

  function createEmptyAudioBuffer(channels, length, sampleRate) {
    return new AudioBuffer({ numberOfChannels: channels, length, sampleRate });
  }

  function hann(size) {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i += 1) window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    return window;
  }

  function fft(real, imag, inverse) {
    const n = real.length;
    for (let i = 1, j = 0; i < n; i += 1) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const angle = (inverse ? 2 : -2) * Math.PI / len;
      const wLenReal = Math.cos(angle);
      const wLenImag = Math.sin(angle);
      for (let i = 0; i < n; i += len) {
        let wReal = 1;
        let wImag = 0;
        for (let j = 0; j < len / 2; j += 1) {
          const uReal = real[i + j];
          const uImag = imag[i + j];
          const vReal = real[i + j + len / 2] * wReal - imag[i + j + len / 2] * wImag;
          const vImag = real[i + j + len / 2] * wImag + imag[i + j + len / 2] * wReal;
          real[i + j] = uReal + vReal;
          imag[i + j] = uImag + vImag;
          real[i + j + len / 2] = uReal - vReal;
          imag[i + j + len / 2] = uImag - vImag;
          const nextReal = wReal * wLenReal - wImag * wLenImag;
          wImag = wReal * wLenImag + wImag * wLenReal;
          wReal = nextReal;
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < n; i += 1) {
        real[i] /= n;
        imag[i] /= n;
      }
    }
  }

  function dbToGain(db) { return Math.pow(10, db / 20); }
  function gainToDb(gain) { return 20 * Math.log10(Math.max(gain, 1e-12)); }
  function yieldToUi() { return new Promise((resolve) => setTimeout(resolve, 0)); }

  window.StudioAudioEngine = { PRESETS, defaultSettings, captureNoiseProfile, processAudioBuffer };
}());
