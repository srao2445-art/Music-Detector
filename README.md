# Studio Voice Cleaner

Studio Voice Cleaner is a complete browser-based voice cleanup app. It records microphone audio, accepts uploaded audio files, runs RNNoise through WebAssembly as the first cleanup stage, applies a professional offline DSP chain, previews before/after audio, and exports a high-quality WAV file.

## Features

- Microphone recording with clear permission error handling.
- Existing audio file upload and decoding in the browser.
- Before/after waveform preview and playback.
- First-two-seconds noise profile capture for steady fan, room hiss, and hum.
- One-click presets: Clean Voice, Studio Enhance, Podcast Voice, Light Noise Reduction, and Strong Noise Reduction.
- Adjustable noise reduction, gate threshold, clarity, warmth, compression, de-esser, and output loudness controls.
- RNNoise WebAssembly denoising as the first cleanup stage, followed by deterministic DSP: residual spectral polish, high-pass and low-pass filtering, gate/expander, compressor, de-esser, EQ/presence shaping, limiter, and loudness normalization.
- Fast Preview Mode for quick checks and High Quality Export Mode for best-quality downloads.
- WAV export rendered locally with `OfflineAudioContext`; no backend, paid API, or cloud audio processing.

## Run locally

Serve the directory with any static web server and open `index.html` in a modern browser:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

> Microphone recording requires a secure context. `localhost` is treated as secure by modern browsers; remote hosting should use HTTPS.
>
> The app imports a pinned RNNoise WebAssembly package in the browser. The audio samples are processed locally in the browser and are not uploaded for processing.
