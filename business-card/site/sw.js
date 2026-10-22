// Built by build.py; do not edit by hand. Version 2f1c7fe33887
const CACHE = 'card-2f1c7fe33887';
const SHELL = [
  './',
  'phill-mcgurk.vcf',
  'manifest.webmanifest',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'media/app-icon-180.png',
  'media/app-icon-192.png',
  'media/app-icon-512.png',
  'media/unite-group-nexus-logo-square-1f404d60.png',
  'media/unite-nexus-u-reveal-poster.jpg',
  'media/edition-origami-poster.jpg',
  'media/edition-blueprint-poster.jpg',
  'media/edition-restoration-poster.jpg',
];
self.addEventListener('install', e =>
  e.waitUntil(
    caches
      .open(CACHE)
      .then(c =>
        Promise.all(
          SHELL.map(u =>
            c
              .add(
                new Request(u, u.startsWith('http') ? { mode: 'no-cors' } : {})
              )
              .catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  )
);
self.addEventListener('activate', e =>
  e.waitUntil(
    caches
      .keys()
      .then(ks =>
        Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
);
self.addEventListener('fetch', e => {
  const r = e.request;
  if (
    r.method !== 'GET' ||
    r.headers.has('range') ||
    /\.(mp4|webm)$/.test(new URL(r.url).pathname)
  )
    return;
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }
  e.respondWith(
    caches.match(r, { ignoreSearch: true }).then(
      hit =>
        hit ||
        fetch(r).then(res => {
          if (res.ok || res.type === 'opaque') {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(r, copy));
          }
          return res;
        })
    )
  );
});
