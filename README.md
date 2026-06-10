# WebViewForge

A premium, fully client-side SaaS-style builder that converts a static website ZIP into a ready-to-build Android WebView project.

## What it does

- Upload a static website ZIP containing HTML, CSS, JavaScript, and assets.
- Inspect total files, total size, and the detected `index.html` entry point.
- Customize Android app metadata, package name, versioning, WebView behavior, branding colors, app icon, and splash logo.
- Preview the Android app shell in a live phone mockup.
- Generate a downloadable Android Studio project ZIP entirely in the browser using JSZip.

## Run locally

Open `index.html` directly in a browser, or serve the folder with any static server:

```bash
python3 -m http.server 4173
```

Then visit `http://127.0.0.1:4173/index.html`.
