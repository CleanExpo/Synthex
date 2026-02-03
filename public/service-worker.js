/**
 * Service Worker for SYNTHEX
 * Handles caching, offline support, and performance optimization
 *
 * NOTE: This service worker is for the legacy static HTML site only.
 * The Next.js app does not use this service worker.
 */

// Self-unregister on production domains (Next.js app doesn't need this SW)
const PRODUCTION_DOMAINS = ['synthex.social', 'synthex.vercel.app', 'synthex.ai'];
const isProduction = PRODUCTION_DOMAINS.some(domain => self.location.hostname.includes(domain));

if (isProduction) {
  // Unregister this service worker on production
  self.addEventListener('install', () => {
    self.skipWaiting();
  });

  self.addEventListener('activate', async () => {
    // Clear all caches
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));

    // Unregister this service worker
    const registrations = await self.registration.unregister();
    console.log('Service worker unregistered on production:', registrations);

    // Reload all clients to clear SW control
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => client.navigate(client.url));
  });

  // Don't do anything else on production
  return;
}

const CACHE_NAME = 'synthex-v1.0.0';
const RUNTIME_CACHE = 'synthex-runtime';

// Files to cache immediately
const STATIC_CACHE_URLS = [
    '/',
    '/index.html',
    '/login.html',
    '/signup.html',
    '/dashboard.html',
    '/css/critical.css',
    '/css/synthex-unified.css',
    '/js/performance-optimizer.js',
    '/js/auth-api.js',
    '/js/theme-manager.js',
    '/manifest.json',
    '/offline.html'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .then(() => self.skipWaiting())
            .catch(err => console.error('Cache installation failed:', err))
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => {
                            return cacheName.startsWith('synthex-') && cacheName !== CACHE_NAME;
                        })
                        .map(cacheName => {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // API calls - network first, fallback to cache
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Static assets - cache first, fallback to network
    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // HTML pages - network first for freshness
    if (request.headers.get('Accept').includes('text/html')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Default strategy
    event.respondWith(staleWhileRevalidate(request));
});

/**
 * Cache-first strategy
 * Serve from cache, fallback to network
 */
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
        return cached;
    }
    
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.error('Fetch failed:', error);
        // Return offline page if available
        const offlinePage = await cache.match('/offline.html');
        if (offlinePage) {
            return offlinePage;
        }
        throw error;
    }
}

/**
 * Network-first strategy
 * Try network, fallback to cache
 */
async function networkFirst(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        
        // Return offline page for HTML requests
        if (request.headers.get('Accept').includes('text/html')) {
            const offlinePage = await caches.match('/offline.html');
            if (offlinePage) {
                return offlinePage;
            }
        }
        
        throw error;
    }
}

/**
 * Stale-while-revalidate strategy
 * Serve from cache immediately, update cache in background
 */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    
    const fetchPromise = fetch(request).then(response => {
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    });
    
    return cached || fetchPromise;
}

/**
 * Check if URL is a static asset
 */
function isStaticAsset(pathname) {
    const staticExtensions = [
        '.css', '.js', '.json', '.png', '.jpg', '.jpeg', 
        '.gif', '.svg', '.woff', '.woff2', '.ttf', '.eot'
    ];
    
    return staticExtensions.some(ext => pathname.endsWith(ext));
}

// Handle messages from clients
self.addEventListener('message', event => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'CACHE_URLS') {
        const urlsToCache = event.data.payload;
        caches.open(RUNTIME_CACHE)
            .then(cache => cache.addAll(urlsToCache))
            .catch(err => console.error('Failed to cache URLs:', err));
    }
    
    if (event.data.type === 'CLEAR_CACHE') {
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            })
            .then(() => {
                event.ports[0].postMessage({ success: true });
            })
            .catch(err => {
                event.ports[0].postMessage({ success: false, error: err.message });
            });
    }
});

// Background sync for offline actions
self.addEventListener('sync', event => {
    if (event.tag === 'sync-posts') {
        event.waitUntil(syncPosts());
    }
});

async function syncPosts() {
    // Sync any offline posts when connection is restored
    try {
        const cache = await caches.open('offline-posts');
        const requests = await cache.keys();
        
        for (const request of requests) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.delete(request);
                }
            } catch (error) {
                console.error('Failed to sync post:', error);
            }
        }
    } catch (error) {
        console.error('Sync failed:', error);
    }
}

// Push notifications
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'New notification from SYNTHEX',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };
    
    event.waitUntil(
        self.registration.showNotification('SYNTHEX', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});