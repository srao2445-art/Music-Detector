# Nocturne Hybrid Synth

An original, responsive browser-based hybrid synthesizer. Nocturne uses the Web Audio API and an `AudioWorklet` for its primary polyphonic synthesis path, while preserving a reduced native Web Audio compatibility mode when a browser blocks worklets.

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`, click a piano key to initialize audio, and play using the on-screen keyboard or the computer keyboard (`A` through `K`, with black keys on `W`, `E`, `T`, `Y`, and `U`). Serving the files over HTTP is recommended because browsers commonly block worklet modules from `file://` pages.

## Playable features

- Three playable oscillators with selectable wavetable, sampler, multisample, granular, and additive spectral modes.
- A drawable 256-frame wavetable editor. The worklet interpolates smoothly between adjacent frames and supports bend, sync, mirror, remap, FM, AM, fold, and PWM-style warp selections.
- Connected oscillator unison, detune, stereo width, pan, phase, random-phase, level, warp, and wavetable-position controls.
- Sample playback with decoded buffers, MIDI pitch tracking, start/end selection, forward and ping-pong looping, reverse playback, slicing, and pitch/stretch-rate control.
- Multisample playback that maps selected files across root notes and selects the nearest zone for the played note.
- A stereo grain-cloud engine with size, density, position, random position, pitch, spread, and freeze controls.
- A lightweight additive spectral-resynthesis bank with blur, shift, formant, and stretch shaping.
- Drag modulation sources onto assignable knobs, then edit bipolar depth or remove assignments in the matrix. Sources include LFOs, envelopes, velocity, key tracking, random, note, and macros.
- Route each oscillator to Filter A, Filter B, or the direct master path. The two audible filters support parallel, series A → B, and series B → A modes.
- A 16-step sequencer with per-step velocity, probability, gate, and ratchet controls.
- Click or drag modules from the FX library into the rack to insert removable DSP modules, including lightweight flanger, phaser, convolution-style echo, filter, stereo, mid/side, multiband saturation, and mono-bass processors.
- Selectable 1×, 2×, or 4× worklet oversampling, a configurable polyphony limit, oldest-voice stealing, live CPU activity feedback, preset JSON import/export, animated scopes, and a responsive layout.

## Scope and next architecture steps

Nocturne is a browser synth implementation, not a clone of a commercial synthesizer. Its granular, spectral, warp, sampler, and FX modules are compact Web Audio DSP engines designed for interactive sound design; they are not marketed as feature-equivalent replacements for desktop production plug-ins.

The next production-oriented milestones would be a WASM DSP core, band-limited wavetable generation, FFT-based spectral editing and freeze, SFZ parsing with key/velocity zones, dedicated FX-bus routing, a full piano-roll data model, preset packs with metadata and favorites, and profiling-driven mobile optimization.
