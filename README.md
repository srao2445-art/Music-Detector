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
