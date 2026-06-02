# WaveShift audio converter

WaveShift is a modern, browser-only audio conversion interface. Uploaded files and generated downloads stay on the user's device: the page temporarily caches both in browser `localStorage`, then removes the cached copies when the user leaves or closes the page.

## Features

- Drag-and-drop or file-picker audio uploads.
- In-browser conversion with FFmpeg WebAssembly.
- Common output targets: MP3, WAV, M4A, FLAC, OGG, AAC, OPUS, WMA, and AIFF.
- Downloadable browser-generated output files.
- Explicit localStorage cleanup on `pagehide` and `beforeunload`.
- Responsive layout for desktop and mobile screens.

## Run locally

Serve the repository with any static file server, for example:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>. The first conversion downloads the browser FFmpeg core runtime from jsDelivr, with an automatic unpkg fallback; subsequent conversions reuse the loaded runtime for that page session. The application wrapper and Web Worker are served locally with the site so browsers do not need to start a worker from a third-party origin.
