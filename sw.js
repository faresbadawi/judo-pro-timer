// Service Worker: legt alle App-Dateien beim ersten Besuch im Cache ab -> komplett offline nutzbar.
// Die Liste wird von `node tools/update-sw.mjs` erzeugt (vor jedem Veröffentlichen ausführen).
/* BEGIN GENERATED */
const CACHE = 'judo-0f91401311';
const FILES = [
  "./",
  "./audio/voice/ar/finish.mp3",
  "./audio/voice/ar/ready.mp3",
  "./audio/voice/ar/rest.mp3",
  "./audio/voice/ar/start.mp3",
  "./audio/voice/ar/stop.mp3",
  "./audio/voice/de/finish.mp3",
  "./audio/voice/de/ready.mp3",
  "./audio/voice/de/rest.mp3",
  "./audio/voice/de/start.mp3",
  "./audio/voice/de/stop.mp3",
  "./audio/voice/de/switch.mp3",
  "./audio/voice/en/finish.mp3",
  "./audio/voice/en/ready.mp3",
  "./audio/voice/en/rest.mp3",
  "./audio/voice/en/start.mp3",
  "./audio/voice/en/stop.mp3",
  "./audio/voice/en/switch.mp3",
  "./audio/voice/jp/finish.mp3",
  "./audio/voice/jp/rest.mp3",
  "./audio/voice/jp/start.mp3",
  "./audio/voice/jp/stop.mp3",
  "./css/style.css",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./index.html",
  "./js/app.js",
  "./js/audio.js",
  "./js/engine/clock.js",
  "./js/engine/interval.js",
  "./js/engine/program.js",
  "./js/i18n.js",
  "./js/lang/ar.js",
  "./js/lang/de.js",
  "./js/lang/en.js",
  "./js/session.js",
  "./js/store.js",
  "./js/ui.js",
  "./js/views.js",
  "./manifest.webmanifest"
];
/* END GENERATED */

self.addEventListener('install', (event) => {
  // cache: 'reload' umgeht den HTTP-Cache, damit nie alte und neue Dateien gemischt werden.
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(FILES.map((f) => fetch(new Request(f, { cache: 'reload' })).then((res) => {
        if (!res.ok) throw new Error(f + ' ' + res.status);
        return cache.put(f, res);
      }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('judo-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Töne, Bilder, Icons: Cache zuerst. Alles andere: Netz zuerst, Cache als Offline-Rückfall.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isAsset = /\/(audio|icons)\//.test(req.url);
  event.respondWith(
    isAsset
      ? caches.match(req).then((hit) => hit || fetch(req))
      : fetch(req, { cache: 'no-cache' })
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
