/**
 * Synthex Next.js Service Worker (SYN-465)
 *
 * Strategies:
 *   - Next.js static chunks (_next/static/)  → cache-first (immutable, content-hashed)
 *   - API routes (/api/)                     → network-only (never stale)
 *   - HTML pages                             → network-first, offline fallback
 *   - Other assets (images, fonts, public/)  → stale-while-revalidate
 */

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `synthex-static-${CACHE_VERSION}`;
const PAGES_CACHE = `synthex-pages-${CACHE_VERSION}`;
const ASSETS_CACHE = `synthex-assets-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';

// ─── Install ────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then(cache => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ───────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  const validCaches = [STATIC_CACHE, PAGES_CACHE, ASSETS_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(
              key => key.startsWith('synthex-') && !validCaches.includes(key)
            )
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ──────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Next.js static chunks — content-hashed, cache forever
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // API routes — always network, never cache
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // HTML navigation — network first, offline fallback
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Images, fonts, other public assets — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE));
});

// ─── Strategies ─────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstWithOfflineFallback(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Return the pre-cached offline page
    return cache.match(OFFLINE_URL);
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached ?? fetchPromise;
}

// ─── Messages ───────────────────────────────────────────────────────────────

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
