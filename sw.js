// Glowmelan service worker - app offline bhi khule. Weather API cache nahi hota.
const CACHE = 'glowmelan-v9';
const SHELL = ['./', './index.html', './app.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable.png', './privacy.html', './terms.html', './refund.html',
  './instrument-serif.woff2', './instrument-serif-italic.woff2', './space-grotesk.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // sirf apni files
  // network pehle (naya version mile). 3 sec me na aaye ya fail ho to cache - kamzor internet pe bhi jaldi khule
  const fromCache = () => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'));
  const net = fetch(e.request).then(r => { if (r.ok){ const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; });
  e.respondWith(new Promise(resolve => {
    let done = false;
    const t = setTimeout(() => fromCache().then(r => { if (r && !done){ done = true; resolve(r); } }), 3000);
    net.then(r => { if (!done){ done = true; clearTimeout(t); resolve(r); } })
       .catch(() => fromCache().then(r => { if (!done){ done = true; clearTimeout(t); resolve(r || Response.error()); } }));
  }));
});
