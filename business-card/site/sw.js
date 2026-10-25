// Built by build.py; do not edit by hand. Version 89e16771c43b
const CACHE = 'card-89e16771c43b';
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
const OFFLINE =
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<p style="font:16px/1.5 system-ui,sans-serif;padding:24px">You are offline, and this page was not saved on your phone. ' +
  '<a href="./">Open the card</a></p>';
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
    // only the card page itself replaces the offline copy: the contact file, the order page or an error page never do
    const u = new URL(r.url),
      scope = new URL(self.registration.scope).pathname;
    const card =
      u.origin === location.origin &&
      (u.pathname === scope || u.pathname === scope + 'index.html');
    e.respondWith(
      fetch(r)
        .then(res => {
          if (
            card &&
            res.ok &&
            (res.headers.get('content-type') || '').includes('text/html')
          ) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put('./', copy));
          }
          return res;
        })
        .catch(() =>
          card
            ? caches.match('./')
            : caches.match(r, { ignoreSearch: true }).then(
                hit =>
                  hit ||
                  new Response(OFFLINE, {
                    status: 503,
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                  })
              )
        )
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
