const CACHE_NAME = 'volumeflow-fast-v1';
const APP_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './waveform.js',
  './ffmpeg-worker.js'
];
const FFMPEG_HOSTS = new Set(['unpkg.com']);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isGet = event.request.method === 'GET';
  if (!isGet) return;

  if (url.origin === self.location.origin || FFMPEG_HOSTS.has(url.host)) {
    event.respondWith(cacheFirst(event.request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    cache.put(request, response.clone()).catch(() => {
      // Cache quota or opaque response limitations should never block processing.
    });
  }
  return response;
}
