const SW_VERSION = 'inner-pwa-v1';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SW_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key !== SW_VERSION)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate';
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.png' ||
    url.pathname === '/manifest.webmanifest';

  if (isNavigation) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        return fresh;
      } catch {
        const cache = await caches.open(SW_VERSION);
        return (
          (await cache.match('/')) ||
          new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          })
        );
      }
    })());
    return;
  }

  if (isStaticAsset) {
    event.respondWith((async () => {
      const cache = await caches.open(SW_VERSION);
      const cached = await cache.match(request);
      if (cached) return cached;

      const fresh = await fetch(request);
      cache.put(request, fresh.clone());
      return fresh;
    })());
  }
});
