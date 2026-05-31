# Nocturne Hybrid Wavetable Synth

An original, responsive browser-based hybrid wavetable synthesizer concept. The MVP uses the Web Audio API and an `AudioWorklet` for playable three-oscillator wavetable synthesis, with a dark instrument interface for advanced sound-design workflows.

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`, click a piano key to initialize audio, and play using the on-screen keyboard or the computer keyboard (`A` through `K`, with black keys on `W`, `E`, `T`, `Y`, and `U`).

## Included

- Three playable wavetable oscillators with table-position morphing in the worklet.
- Sub/noise panels, dual-filter workspace, modulation matrix, envelopes, LFOs, macros, routing, FX rack, step sequencer, piano roll, preset browser, JSON import/export, and responsive layout.
- Web Audio distortion, delay, convolution reverb, master gain, and synthesized voices rendered in an `AudioWorklet`.
- Automatic native Web Audio compatibility mode when `AudioWorklet` is unavailable or blocked by the browser context.
- Audible patch presets that update oscillator warp, filters, amp envelope, sub/noise mix, modulation depth, and FX values; exported JSON files include the full patch snapshot.
