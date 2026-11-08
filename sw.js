/* OTW PWA service worker — v1.
   Caches the app shell (HTML/CSS/JS/icons) so the app loads fast and can be
   installed on the home screen. Firebase and CDN requests always go to the
   network — the service worker never caches them.
   To ship a new shell version, bump the CACHE name below. */
const CACHE = 'otw-shell-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/i18n.js',
  './js/utils.js',
  './js/storage.js',
  './js/members.js',
  './js/finance.js',
  './js/scanner.js',
  './js/reports.js',
  './js/app.js',
  './js/cloud.js',
  './js/firebase-config.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Same-origin GET requests for the app shell only; everything else
  // (Firebase, Google Fonts, CDNs) goes straight to the network.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const isShell = url.pathname.endsWith('/') ||
    /\.(html|css|js|png|jpg|jpeg|svg|webp|json|ico)$/i.test(url.pathname);
  if (!isShell) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
