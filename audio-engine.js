// Studio Voice Cleaner audio engine.
// RNNoise WASM runs first in rnnoise-engine.js; this file then applies
// deterministic Web Audio DSP, OfflineAudioContext rendering, and spectral polish.
(function () {
  'use strict';

  const PRESETS = {
    cleanVoice: { nr: 34, protection: 82, gate: -58, clarity: 64, warmth: 58, compression: 46, deesser: 38, loudness: -16 },
    studioEnhance: { nr: 32, protection: 86, gate: -60, clarity: 78, warmth: 62, compression: 54, deesser: 42, loudness: -15 },
    podcastVoice: { nr: 40, protection: 80, gate: -56, clarity: 72, warmth: 72, compression: 62, deesser: 44, loudness: -16 },
    lightNoise: { nr: 22, protection: 90, gate: -64, clarity: 56, warmth: 58, compression: 38, deesser: 28, loudness: -18 },
    strongNoise: { nr: 58, protection: 70, gate: -54, clarity: 66, warmth: 60, compression: 58, deesser: 46, loudness: -16 }
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
    const rnnoiseBuffer = await RNNoiseWasmDenoiser.denoiseAudioBuffer(audioBuffer, settings, onProgress);
    const quality = mode === 'high' ? highQualityPlan(rnnoiseBuffer.sampleRate) : fastPlan(rnnoiseBuffer.sampleRate);
    onProgress(32, 'Preparing residual spectral polish after RNNoise…');

    const spectralBuffer = await runSpectralPasses(rnnoiseBuffer, settings, noiseProfile, quality, onProgress);
    onProgress(68, 'Offline rendering professional EQ, expander, compressor, and de-esser…');

    const rendered = await renderWebAudioChain(spectralBuffer, settings, quality);
    onProgress(78, 'Applying speech-preserving dynamic clarity enhancer…');

    const clarified = await applyDynamicClarityEnhancer(rendered, settings);
    onProgress(84, 'Applying transparent look-ahead limiter…');

    const limited = applyLookAheadLimiter(clarified, settings);
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
    const protection = settings.protection / 100;
    const overSubtract = 0.35 + amount * (0.95 - protection * 0.45);
    const floor = quality.floor + 0.14 * protection + (1 - amount) * 0.08;
    let previousFrameEnergy = 0;

    for (let start = 0; start < input.length; start += hopSize) {
      real.fill(0); imag.fill(0);
      for (let i = 0; i < fftSize; i += 1) real[i] = (input[start + i] || 0) * window[i];
      fft(real, imag, false);

      const speech = analyzeSpeechFrame(real, imag, noiseBins, sampleRate, previousFrameEnergy);
      previousFrameEnergy = speech.energy;

      for (let bin = 0; bin <= fftSize / 2; bin += 1) {
        const mag = Math.hypot(real[bin], imag[bin]) || 1e-12;
        const hz = bin * sampleRate / fftSize;
        const voiceBand = hz >= 110 && hz <= 7600;
        const consonantBand = hz >= 2200 && hz <= 9500;
        const speechProtection = Math.max(
          speech.voice * (voiceBand ? 1 : 0.35),
          speech.transient * (consonantBand ? 0.95 : 0.35),
          speech.sibilance * (hz >= 4500 && hz <= 11500 ? 1 : 0.25)
        ) * protection;
        const localOverSubtract = overSubtract * (1 - speechProtection * 0.82);
        const localFloor = Math.min(0.92, floor + speechProtection * 0.36);
        const noise = noiseBins[bin] * localOverSubtract;
        let gain = Math.max(localFloor, (mag - noise) / mag);
        if (speech.voice > 0.62 && voiceBand) gain = Math.max(gain, 0.72 + protection * 0.18);
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
    const hp = new BiquadFilterNode(context, { type: 'highpass', frequency: 45 + (100 - settings.warmth) * 0.18, Q: 0.62 });
    const warm = new BiquadFilterNode(context, { type: 'lowshelf', frequency: 170, gain: (settings.warmth - 50) * 0.055 });
    const mudCut = new BiquadFilterNode(context, { type: 'peaking', frequency: 330, Q: 0.9, gain: -0.5 - settings.clarity * 0.01 });
    const presence = new BiquadFilterNode(context, { type: 'peaking', frequency: 3300, Q: 0.8, gain: (settings.clarity - 45) * 0.035 });
    const air = new BiquadFilterNode(context, { type: 'highshelf', frequency: 9500, gain: Math.max(-2.5, (settings.clarity - settings.deesser) * 0.022) });
    const lp = new BiquadFilterNode(context, { type: 'lowpass', frequency: 17500 - settings.deesser * 18, Q: 0.55 });
    const compressor = new DynamicsCompressorNode(context, {
      threshold: -24 + settings.compression * 0.08,
      knee: 24,
      ratio: 1.35 + settings.compression * 0.03,
      attack: quality.passes > 1 ? 0.018 : 0.012,
      release: 0.22
    });
    const deEsser = new BiquadFilterNode(context, { type: 'peaking', frequency: 7100, Q: 2.5, gain: -settings.deesser * 0.045 });
    const safetyGain = new GainNode(context, { gain: 0.9 });

    source.connect(hp).connect(warm).connect(mudCut).connect(presence).connect(air).connect(lp).connect(compressor).connect(deEsser).connect(safetyGain).connect(context.destination);
    source.start();
    return context.startRendering();
  }

  async function applyDynamicClarityEnhancer(audioBuffer, settings) {
    const presence = await renderFilteredCopy(audioBuffer, 'bandpass', 3400, 1.05, 0);
    const air = await renderFilteredCopy(audioBuffer, 'bandpass', 9500, 0.8, 0);
    const output = createEmptyAudioBuffer(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
    const clarity = settings.clarity / 100;
    const protection = settings.protection / 100;
    const presenceAmount = 0.08 + clarity * 0.16;
    const airAmount = 0.025 + clarity * 0.055;

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const dry = audioBuffer.getChannelData(channel);
      const presenceBand = presence.getChannelData(channel);
      const airBand = air.getChannelData(channel);
      const data = new Float32Array(dry.length);
      let env = 0;
      let airEnv = 0;
      const envCoeff = Math.exp(-1 / (audioBuffer.sampleRate * 0.012));
      const releaseCoeff = Math.exp(-1 / (audioBuffer.sampleRate * 0.09));
      for (let i = 0; i < dry.length; i += 1) {
        const level = Math.abs(dry[i]);
        env = level > env ? envCoeff * env + (1 - envCoeff) * level : releaseCoeff * env + (1 - releaseCoeff) * level;
        airEnv = 0.985 * airEnv + 0.015 * Math.abs(airBand[i]);
        const speechLift = smoothstep(dbToGain(-42), dbToGain(-18), env);
        const loudGuard = 1 - 0.55 * smoothstep(dbToGain(-18), dbToGain(-8), env);
        const sibilanceGuard = 1 - Math.min(0.65, (airEnv / Math.max(env, 1e-5)) * settings.deesser * 0.018);
        const dynamicPresence = presenceAmount * speechLift * loudGuard;
        const dynamicAir = airAmount * speechLift * sibilanceGuard * (0.75 + protection * 0.25);
        data[i] = dry[i] + presenceBand[i] * dynamicPresence + airBand[i] * dynamicAir;
      }
      output.copyToChannel(data, channel);
    }
    return output;
  }

  async function renderFilteredCopy(audioBuffer, type, frequency, q, gain) {
    const context = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
    const source = new AudioBufferSourceNode(context, { buffer: audioBuffer });
    const filter = new BiquadFilterNode(context, { type, frequency, Q: q, gain });
    source.connect(filter).connect(context.destination);
    source.start();
    return context.startRendering();
  }

  function analyzeSpeechFrame(real, imag, noiseBins, sampleRate, previousEnergy) {
    let total = 0;
    let voice = 0;
    let presence = 0;
    let sibilance = 0;
    let noise = 0;
    const half = real.length / 2;
    for (let bin = 1; bin <= half; bin += 1) {
      const hz = bin * sampleRate / real.length;
      const mag = Math.hypot(real[bin], imag[bin]);
      total += mag;
      noise += noiseBins[bin] || 0;
      if (hz >= 110 && hz <= 1200) voice += mag;
      if (hz >= 1800 && hz <= 5200) presence += mag;
      if (hz >= 4500 && hz <= 10500) sibilance += mag;
    }
    const energy = total / Math.max(1, half);
    const snr = total / Math.max(noise, 1e-6);
    const voiceRatio = (voice + presence * 0.72) / Math.max(total, 1e-6);
    const sibilanceRatio = sibilance / Math.max(total, 1e-6);
    const transient = Math.max(0, (energy - previousEnergy) / Math.max(previousEnergy, 1e-6));
    return {
      energy,
      voice: clamp01(smoothstep(1.18, 2.65, snr) * 0.58 + smoothstep(0.18, 0.48, voiceRatio) * 0.42),
      sibilance: clamp01(smoothstep(0.035, 0.16, sibilanceRatio) * smoothstep(1.05, 2.4, snr)),
      transient: clamp01(smoothstep(0.12, 1.3, transient))
    };
  }

  function applyGateAndExpander(input, settings, sampleRate) {
    const output = new Float32Array(input.length);
    const protection = settings.protection / 100;
    const threshold = dbToGain(settings.gate - protection * 10);
    const attack = 0.004;
    const release = 0.16 + protection * 0.12;
    const attackCoeff = Math.exp(-1 / (sampleRate * attack));
    const releaseCoeff = Math.exp(-1 / (sampleRate * release));
    let env = 0;
    let gain = 1;

    for (let i = 0; i < input.length; i += 1) {
      const level = Math.abs(input[i]);
      env = level > env ? attackCoeff * env + (1 - attackCoeff) * level : releaseCoeff * env + (1 - releaseCoeff) * level;
      const target = env < threshold ? Math.max(0.35 + protection * 0.35, Math.pow(env / Math.max(threshold, 1e-6), 0.9 + (1 - protection) * 0.6)) : 1;
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

  function smoothstep(edge0, edge1, value) {
    const x = clamp01((value - edge0) / Math.max(edge1 - edge0, 1e-9));
    return x * x * (3 - 2 * x);
  }

  function clamp01(value) { return Math.max(0, Math.min(1, value)); }

  function dbToGain(db) { return Math.pow(10, db / 20); }
  function gainToDb(gain) { return 20 * Math.log10(Math.max(gain, 1e-12)); }
  function yieldToUi() { return new Promise((resolve) => setTimeout(resolve, 0)); }

  window.StudioAudioEngine = { PRESETS, defaultSettings, captureNoiseProfile, processAudioBuffer };
}());
