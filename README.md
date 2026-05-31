# Nebula Studio Browser Synthesizer

Nebula Studio is an original, fully editable browser wavetable-style synthesizer built with vanilla HTML, CSS, JavaScript, and the Web Audio API. It includes three editable oscillator layers, a multimode filter, amp envelope, LFO modulation, four working effects, performance macros, live visualizers, patch randomization, 256 original factory patches, local user-patch saving, a dedicated Nebula preset loader, synth-only audio recording, and a playable piano keyboard.

## Run locally

```bash
python3 -m http.server 4173
```

Open [http://localhost:4173](http://localhost:4173) in a modern browser. Click a piano key or use the mapped computer keyboard keys to start Web Audio.

## Play and customize

- Play notes with the on-screen keyboard or `A W S E D F T G Y H U J K`.
- Change oscillator waveform, octave, semitone, detune, and level in each oscillator panel.
- Shape the multimode filter, amp envelope, LFO target/rate/depth, effects, macros, and master volume.
- Browse 256 included original factory patches, click **RANDOMIZE** for inspiration, and click **SAVE PATCH** to store custom sounds in Nebula Studio's dedicated browser-local patch storage. When saving, assign the sound to an instrument folder so your own patches remain organized.

## Dedicated preset loader

Click **PRESET LOADER** to open Nebula Studio's in-app sound library. Search by name, browse instrument folders such as **Lead**, **Pad**, **Bass**, **Keys**, **Pluck**, **Arp**, **Chord**, and **Texture**, switch between the factory bank and your saved presets, load a patch, or delete one of your own patches. The loader only lists patches bundled with or saved by Nebula Studio; it does not scan unrelated browser files or external preset folders.

## Record and export audio

Click **RECORD**, perform with the synth, and click **STOP**. Click **EXPORT AUDIO** to download the captured take. Recording is connected directly to Nebula Studio's master output, so it captures this synth only and does not request microphone access. The download uses the encoded audio format supported by your browser, normally `.webm` or `.ogg` with Opus audio.

Nebula Studio is an original browser synth. It does not include or redistribute proprietary Serum presets or assets.

## Import and export Nebula preset files

The loader accepts portable `.nebula.json` files created specifically for Nebula Studio. Open **LOAD PRESET**, click **IMPORT FILE**, and select one or more compatible files from your device. Imported sounds are validated and stored in **MY SAVED PATCHES**. Unrelated JSON files are rejected. Use **EXPORT CURRENT** to download the currently edited sound as a portable Nebula file.

Each portable file uses this versioned envelope:

```json
{
  "format": "nebula-studio-preset",
  "version": 1,
  "patch": {
    "name": "My Lead",
    "category": "Lead",
    "cutoff": 2600,
    "resonance": 5,
    "drive": 8,
    "filterEnv": 28,
    "attack": 0.04,
    "decay": 0.48,
    "sustain": 0.68,
    "release": 1.2,
    "chorus": 20,
    "delay": 16,
    "reverb": 20,
    "distortion": 8,
    "lfoShape": "sine",
    "lfoTarget": "cutoff",
    "lfoRate": 1.2,
    "lfoDepth": 18,
    "master": 62,
    "oscillators": [
      { "enabled": true, "wave": "sawtooth", "octave": 0, "semi": 0, "detune": -6, "level": 72, "pan": -12 },
      { "enabled": true, "wave": "triangle", "octave": -1, "semi": 7, "detune": 5, "level": 42, "pan": 14 },
      { "enabled": true, "wave": "sine", "octave": -2, "semi": 0, "detune": 0, "level": 24, "pan": 0 }
    ]
  }
}
```

To create preset files without hand-writing JSON, customize a sound in Nebula Studio and click **EXPORT CURRENT** inside the loader. To generate preset packs in code, copy `presets/nebula-preset-template.nebula.json`, edit its values, or adapt the `makePatch()` factory-preset shape in `app.js`; keep `format` set to `nebula-studio-preset`, `version` set to `1`, and include exactly three validated oscillators.

## Preview sounds inside the loader

Click **AUDITION** beside any preset to apply it without closing the loader, then use the labeled two-octave preview keyboard at the bottom of the dialog. Click **LOAD** when you want to close the loader and keep working with that sound in the main synthesizer.

Both the main performance keyboard and the in-loader audition keyboard display note names on every key. Changing the global octave refreshes the displayed note labels on both keyboards.
