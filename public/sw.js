// Offline support for field use: the app shell, safety protocols and every
// incident already opened stay available without signal. Reports made offline
// are queued by the app and sent on reconnect.
const CACHE = 'comunidad-fuerte-v7';
const SHELL = [
  '/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/css/app.css', '/js/app.js', '/js/i18n.js', '/js/icons.js',
  '/vendor/ag-grid/ag-grid-community.min.js',
  '/vendor/fonts/atkinson-hyperlegible-latin-400-normal.woff2',
  '/vendor/fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  '/samples/A_before.jpg', '/samples/B_river.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Data: network first, cached copy when offline.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || new Response(JSON.stringify({ error: 'Offline: this information has not been saved on this device yet.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))));
    return;
  }

  // Pages: serve the app shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }

  // Static files and photos: cached copy first, refreshed in the background.
  event.respondWith(caches.match(req).then(hit => {
    const network = fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || network;
  }));
});
