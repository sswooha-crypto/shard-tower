/**
 * sw.js — SHARD TOWER v0.8.1 Mobile PWA Service Worker
 * Strategy:
 *  - NEVER intercept Supabase Cloud (*.supabase.co) or local /api/v1/* real-time endpoints
 *  - Network-First for HTML / JS / manifest (instant live balance & bugfix updates!)
 *  - Cache-First for immutable HD-2D PNG/JPG sprites & WAV SFX (zero-lag mobile reloads!)
 */
const CACHE_NAME = 'shard-tower-assets-v722';
const CORE_SHELL = [
  './',
  './index.html',
  './privacy.html',
  './native_bridge.js?v=1',
  './net_dominion.js?v=35',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './art/items/cat_elixir.png',
  './art/sprites/forge_hammer.png',
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        CORE_SHELL.map((u) =>
          fetch(u, { cache: 'no-cache', credentials: 'same-origin' })
            .then((res) => (res && res.ok ? cache.put(u, res) : null))
            .catch(() => {})
        )
      ))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Strictly bypass real-time cloud / API / cross-origin traffic
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Network-first with HTTP revalidation ('no-cache') so GitHub Pages max-age=600 NEVER serves stale HTML/JS!
  const isDocOrCode =
    req.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.webmanifest');

  if (isDocOrCode) {
    event.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for art sprites, backgrounds, icons, and WAV SFX (v3.4.2: never cache broken/non-image responses!)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached && cached.ok) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type !== 'opaque') {
          const ct = (res.headers.get('content-type') || '').toLowerCase();
          const isImgReq = /\.(png|jpg|jpeg|webp)$/i.test(url.pathname);
          if (!isImgReq || ct.includes('image/')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
        }
        return res;
      }).catch(() => cached || new Response('', { status: 503 }));
    })
  );
});
