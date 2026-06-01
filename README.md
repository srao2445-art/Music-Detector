# Nocturne Hybrid Wavetable Synth

An original, responsive browser-based hybrid synthesizer. Nocturne uses the Web Audio API and prefers an `AudioWorklet` for low-latency polyphonic synthesis, while preserving a native Web Audio compatibility mode when a browser blocks worklets.

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`, click a piano key to initialize audio, and play using the on-screen keyboard or the computer keyboard (`A` through `K`, with black keys on `W`, `E`, `T`, `Y`, and `U`). Serving the files over HTTP is recommended because some browsers block worklet modules from `file://` pages.

## Playable features

- Three playable oscillators with selectable wavetable, sampler, multisample, granular, and additive spectral modes.
- Connected oscillator unison, detune, stereo width, pan, phase, random-phase, level, warp, and wavetable-position controls.
- Sample playback uses decoded audio buffers with MIDI pitch tracking. Multisample playback maps selected files across root notes and selects the nearest zone for the played note.
- Granular mode schedules windowed grains from the decoded sample buffer. Spectral mode uses a lightweight harmonic-resynthesis bank with blur, shift, formant, and stretch shaping.
- Drag an LFO source chip onto a knob to add a modulation route, or adjust and remove routes in the modulation matrix.
- Route each oscillator to Filter A, Filter B, or the direct master path. The two audible filters support parallel, series A → B, and series B → A modes.
- A 16-step sequencer that triggers notes with per-step velocity while its transport is running.
- Click or drag modules from the FX library into the rack to insert removable DSP modules. The browser implementation provides lightweight flanger, phaser, convolution-style echo, filter, stereo, mid/side, multiband saturation, and mono-bass processors rather than studio plug-in replacements.
- A live activity-based CPU meter, animated oscilloscopes, preset browser, patch JSON import/export, distortion, delay, convolution reverb, and responsive layout.
- Automatic native Web Audio compatibility mode when `AudioWorklet` is unavailable or blocked by the browser context.

## Scope

Nocturne is a browser synth implementation, not a clone of a commercial synthesizer. Its granular, spectral, and FX modules are intentionally compact Web Audio DSP engines designed for interactive sound design; they are not marketed as feature-equivalent replacements for desktop production plug-ins.
