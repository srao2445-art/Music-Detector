# Nocturne Hybrid Wavetable Synth

An original, responsive browser-based hybrid wavetable synthesizer. Nocturne uses the Web Audio API and prefers an `AudioWorklet` for low-latency polyphonic synthesis, while preserving a native Web Audio compatibility mode when a browser blocks worklets.

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`, click a piano key to initialize audio, and play using the on-screen keyboard or the computer keyboard (`A` through `K`, with black keys on `W`, `E`, `T`, `Y`, and `U`). Serving the files over HTTP is recommended because some browsers block worklet modules from `file://` pages.

## Playable features

- Three playable wavetable oscillators with table-position morphing, oscillator warp, sub and noise layers.
- Granular texture and spectral-resynthesis controls that alter the rendered voice in real time.
- User wavetable, sample, and multisample file inputs that decode audio and use its waveform as a custom oscillator source.
- Drag an LFO source chip onto a knob to add a real modulation route, or adjust and remove routes in the modulation matrix.
- Two audible filters with parallel, series A → B, and series B → A routing modes.
- A 16-step sequencer that triggers notes with per-step velocity while its transport is running.
- Click or drag modules from the FX library into the rack to insert audible DSP modules; inserted modules can be removed again.
- A live activity-based CPU meter, animated oscilloscopes, preset browser, patch JSON import/export, distortion, delay, convolution reverb, and responsive layout.
- Automatic native Web Audio compatibility mode when `AudioWorklet` is unavailable or blocked by the browser context.
