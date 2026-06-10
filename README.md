# VolumeFlow Fast

VolumeFlow Fast is a complete static, browser-based MP3 volume matching app. It is designed to feel like a fast Termux FFmpeg workflow, but it runs locally in the browser with no backend, no server upload, and no persistent file storage.

## How the app works

1. The user selects or drops an MP3 file.
2. The app rejects non-MP3 files before processing.
3. A lightweight visual waveform preview is drawn from low-resolution byte samples. The preview avoids Web Audio API `AudioBuffer` rendering and does not duplicate the full audio file in memory.
4. The user chooses one of two modes:
   - **Match to selected section**
   - **Automatic leveling**
5. FFmpeg WASM runs in `ffmpeg-worker.js`, keeping the main UI responsive.
6. The processed file is exported as MP3 only and exposed through a temporary Blob URL for download.
7. Blob URLs are released on reset or when a new file is loaded.

## Why MP3-only is used

VolumeFlow Fast intentionally accepts and exports MP3 only because the target workflow is MP3 volume matching. Keeping one input and output format reduces UI ambiguity, avoids accidental WAV conversion, lowers storage pressure for long audio, and keeps the FFmpeg command path predictable:

```bash
ffmpeg -i input.mp3 -af ... -c:a libmp3lame -b:a 320k output.mp3
```

The app rejects WAV, M4A, AAC, FLAC, OGG, and all other non-MP3 files.

## Selected-section matching

Selected-section matching is useful when one part of an MP3 has the volume you want the whole file to match.

The worker runs FFmpeg volume analysis on the selected region:

```bash
ffmpeg -ss START -t DURATION -i input.mp3 -af volumedetect -f null -
```

Then it analyzes the whole MP3:

```bash
ffmpeg -i input.mp3 -af volumedetect -f null -
```

The app parses `mean_volume` from FFmpeg logs and calculates:

```text
gain = selectedSectionMeanVolume - wholeFileMeanVolume
```

Then it applies that gain to the complete MP3 and exports a 320 kbps MP3:

```bash
ffmpeg -i input.mp3 -af "volume=${gain}dB" -c:a libmp3lame -b:a 320k output.mp3
```

## Automatic mode

Automatic mode processes the complete MP3 with one of two FFmpeg filters:

```bash
ffmpeg -i input.mp3 -af dynaudnorm -c:a libmp3lame -b:a 320k output.mp3
```

or:

```bash
ffmpeg -i input.mp3 -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a libmp3lame -b:a 320k output.mp3
```

`dynaudnorm` is useful for smoothing changing volume over time. `loudnorm` targets broadcast-style loudness around -16 LUFS with true peak and loudness range limits.

## Local-only privacy model

- No backend is required.
- Files are not uploaded to a server.
- Files are not stored in `localStorage`.
- Processing happens in a browser Web Worker using FFmpeg WASM.
- Downloads are created with temporary Blob URLs.

## Performance notes for long MP3 files

VolumeFlow Fast is optimized to avoid unnecessary full-size audio copies:

- FFmpeg WASM handles analysis and final rendering.
- The UI never converts MP3 to WAV.
- The waveform is a low-resolution visual preview only.
- The FFmpeg virtual filesystem is cleaned after processing.
- A service worker caches app files and FFmpeg WASM assets when the browser permits it.
- The app warms FFmpeg after page load so the first render can start sooner.

Large files, including 1-hour MP3s, can still take time because browser WASM processing depends heavily on CPU, memory, browser limits, and device thermal performance.

## Fast multithread mode

The app checks `window.crossOriginIsolated`.

- If `true`, it tries to load the FFmpeg multithread core and shows **Fast mode enabled**.
- If `false`, it uses the single-thread core and shows **Compatibility mode enabled**.

Multithread WASM requires cross-origin isolation. Configure hosting with these headers:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### Firebase Hosting example

```json
{
  "hosting": {
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
          { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
        ]
      }
    ]
  }
}
```

### Netlify example

Create `_headers`:

```text
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

### Vercel example

Add headers in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

GitHub Pages generally does not allow custom response headers, so it usually runs in compatibility mode.

## Browser limitations

- FFmpeg WASM downloads are large and require network access the first time unless already cached.
- Mobile browsers may terminate heavy processing tabs under memory pressure.
- Very long MP3 files can require significant time and temporary memory inside FFmpeg's virtual filesystem.
- Multithread mode is available only on cross-origin isolated pages.
- Some browser privacy modes limit service worker or Cache API behavior.

## Deploying

This is a static app. Deploy these files to Firebase Hosting, Netlify, Vercel, GitHub Pages, or any static web host:

- `index.html`
- `styles.css`
- `app.js`
- `ffmpeg-worker.js`
- `waveform.js`
- `service-worker.js`
- `README.md`

No server runtime or API key is required.
