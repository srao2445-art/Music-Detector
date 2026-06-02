# Nocturne Hybrid Synth

An original, responsive browser-based hybrid synthesizer. Nocturne uses the Web Audio API and an `AudioWorklet` for its primary polyphonic synthesis path, while preserving a reduced native Web Audio compatibility mode when a browser blocks worklets.

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`, click a piano key to initialize audio, and play using the on-screen keyboard or the computer keyboard (`A` through `K`, with black keys on `W`, `E`, `T`, `Y`, and `U`). Serving the files over HTTP is recommended for consistent AudioWorklet loading.

## Playable engine

- Three oscillators with selectable wavetable, sampler, multisample, granular, and additive spectral modes.
- A drawable 256-frame wavetable editor with smooth frame interpolation, oversampled rendering, mip-style sample averaging for imported tables, and PolyBLEP correction for built-in saw and square shapes.
- Bend, sync, mirror, remap, FM, AM, fold, and PWM-style warp algorithms plus unison, detune, stereo width, pan, phase, random phase, level, warp, and position controls.
- Sample playback with MIDI pitch tracking, start/end selection, forward and ping-pong looping, reverse, slicing, stretch-rate control, and loop crossfades.
- SFZ pack import for local `.sfz` files selected alongside their audio assets. The parser maps key zones, velocity layers, root keys, loop bounds, loop mode, and loop crossfade values into the sampler.
- A stereo grain-cloud engine with size, density, position, random position, pitch, spread, and freeze controls.
- FFT analysis of loaded sample buffers into an editable 32-partial spectral bank with blur, shift, formant, stretch, and freeze-oriented partial capture.
- Drag modulation sources onto assignable knobs, then edit bipolar depth or remove assignments in the matrix. Sources include LFOs, envelopes, velocity, key tracking, random, note, and synchronized macros. Supported DSP targets include oscillator position, warp, level and pan; filter cutoff, resonance and mix; and FX drive.

## Workflow and performance

- Editable oscillator routing to Filter A, Filter B, or direct master, plus serial and parallel dual-filter modes. Filter A is a driven low-pass stage; Filter B adds a compact vowel/formant resonator bank. Both stages apply cutoff, resonance, drive, wet/dry mix, and pan.
- Connected oscillator unison, detune, width, pan, phase, random phase, dual-warp depth and warp-mode controls, plus sub shape/direct and noise color/key controls. Factory patches materialize complete sound snapshots, the randomizer publishes audible settings immediately, and all eight macros ship with supported matrix assignments.
- A removable, parameterized FX rack with BUS A, BUS B, and MASTER processing stages. Visible cards expose module-specific controls: distortion mix/drive/tone; chorus mix/rate/depth/width; delay mix/time/feedback/filter; reverb mix/size/decay/damping; compressor mix/threshold/ratio; three-band EQ; frequency shift; and utility width/mono-bass behavior. Lightweight library inserts remain available for additional effects.
- A 16-step clip and arpeggiator editor with audible editable notes, velocity, probability, gate, and ratchet controls.
- Web MIDI keyboard input, MIDI CC learn from knob context menus, undo/redo history, and A/B patch comparison.
- Full version-3 preset snapshots save and restore oscillator modes and controls, dual filters, modulation routes, macros, utility engines, FX parameters and inserts, sampler values, quality settings, spectral partials, sequencer steps, and master volume.
- Master-output WAV recording with record/stop status and one-click export of the latest stereo take.
- Selectable high, balanced, and eco quality modes; 1×, 2×, and 4× oversampling; configurable polyphony; released-voice-first stealing; measured AudioWorklet CPU telemetry; a single coalesced UI-to-DSP publication path; and one sequencer transport clock.
- AudioWorklet mode renders its FX exclusively inside the worklet. The reduced compatibility mode alone uses native Web Audio distortion, delay, and reverb nodes, avoiding double-processing during normal playback.
- Optional local WASM clipping: place your untracked `dsp-core.wasm.base64.txt` beside `index.html` to enable the WASM `soft_clip` kernel. The browser decodes and transfers it to the worklet at runtime. If the local file is absent, the synth automatically keeps using its JavaScript soft-clipping fallback. You may also keep an untracked local `dsp-core.c` beside `index.html` when you want to rebuild the Base64 module. No C source, compiled WASM binary, or encoded WASM artifact is committed.

## Scope and next architecture steps

Nocturne is a browser synth implementation, not a clone of a commercial synthesizer. Its engines are compact browser DSP modules designed for interactive sound design; they are not marketed as feature-equivalent replacements for desktop production plug-ins.

The next production milestones are migrating more hot DSP loops into WASM, a full radix-FFT overlap/add spectral pipeline, band-limited mipmap generation offline, broader SFZ opcode support, dedicated FX buses, preset packs with author metadata and preview rendering, MPE, modulation depth rings, parameter reset tooltips, and profiling on physical Android WebView devices.


## Optional local WASM DSP files

The repository intentionally does not commit `dsp-core.c`, a `.wasm` binary, or `dsp-core.wasm.base64.txt`. Keep your saved DSP files outside the repository when preparing a pull request. If you want to test the optional WASM path locally, temporarily copy `dsp-core.wasm.base64.txt` into the project root next to `index.html`, run the synth, and remove the file again before staging changes.

The browser runtime uses `dsp-core.wasm.base64.txt`, not the C source directly. If the Base64 text file is present when the app is served, Nocturne decodes it and sends the WASM bytes to the `AudioWorklet`. If it is absent, the synth automatically keeps using the JavaScript fallback.

If you want to rebuild your local Base64 module from your saved `dsp-core.c`, run:

```bash
clang --target=wasm32 -O3 -nostdlib -Wl,--no-entry \
  -Wl,--export=soft_clip -Wl,--export=saturate \
  -o /tmp/dsp-core.wasm dsp-core.c
base64 /tmp/dsp-core.wasm > dsp-core.wasm.base64.txt
```

Do not stage or commit either local DSP file. Only `dsp-core.wasm.base64.txt` needs to be present beside `index.html` at runtime; `dsp-core.c` is optional rebuild source material and can remain outside the repository. Remove any temporarily copied DSP files before preparing a pull request.
