// __SW_VERSION__ is replaced at build time (vite/sw-version-plugin.ts) so each
// release gets its own cache and the activate handler evicts the previous one.
const CACHE_NAME = 'struxure-__SW_VERSION__';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests — POST/etc can't be cached
  if (event.request.method !== 'GET') return;

  // Only the app's own static assets are cached. Cross-origin calls (AI
  // providers, analytics, a local LM Studio) and anything carrying credentials
  // go straight to the network, so a key check never sees a stale 200 and no
  // API reply is written to disk.
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.headers.has('Authorization')) return;

  // Network-first for navigation, cache-first for assets
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || fetched;
    })
  );
});
