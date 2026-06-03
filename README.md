# Echo Atelier — Browser Vintage Algorithmic Reverb

A professional, browser-only stereo algorithmic reverb web app built with plain HTML, CSS, JavaScript, Web Audio API, and AudioWorklet. It is vintage-inspired while using original UI, preset names, and implementation.

## Features

- Audio file upload with large-file guardrails and decode error handling
- Real-time playback preview through an AudioWorklet reverb engine
- Modes: Plate, Room, Hall, Chamber, Cathedral, Ambience
- Controls for mix, decay, size, predelay, filtering, damping, modulation, width, input gain, and output gain
- Vintage color modes: Dark Vintage, Bright 80s, Clean Modern
- Locked factory presets plus editable localStorage user presets
- Save, duplicate, import, export, validate, and reset presets
- Wet solo and bypass buttons
- Waveform display with playback cursor
- Offline WAV rendering through OfflineAudioContext
- Mobile-friendly dark responsive UI

## Run locally

Serve the directory with any static file server; AudioWorklet modules require a local HTTP origin in many browsers.

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.
