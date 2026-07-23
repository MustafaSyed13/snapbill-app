// Snapbill service worker — app-shell caching for offline use + auto-update.
const VERSION = 'snapbill-v1.2.0';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png', './assets/favicon-64.png',
  './js/app.js', './js/lib.js', './js/db.js', './js/format.js', './js/model.js',
  './js/intelligence.js', './js/invoice-doc.js', './js/seed.js', './js/screens-common.js',
  './js/screens-auth.js', './js/screens-dashboard.js', './js/screens-invoices.js',
  './js/screens-customers.js', './js/screens-catalog.js', './js/screens-insights.js', './js/screens-settings.js',
  './js/vendor/jspdf.umd.min.js', './js/vendor/html2canvas.min.js', './js/vendor/supabase.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))).catch(() => {});
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // don't touch cross-origin (e.g. optional AI API)

  // Network-first for navigations (get latest HTML), fall back to cache offline.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION); cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  // Stale-while-revalidate for same-origin assets.
  e.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then(res => {
      if (res && res.status === 200) caches.open(VERSION).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => null);
    return cached || (await network) || new Response('Offline', { status: 503 });
  })());
});
