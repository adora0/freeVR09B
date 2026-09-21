const CACHE_NAME = 'midi-cache-v2'; // bump ad ogni release: forza refresh su Android

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        'index.html',
        'vr09b.js',
        'styles.css',
        'manifest.json'
      ]).catch((error) => {
        console.warn('Cache addAll failed, continuing anyway:', error);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) =>
      response || fetch(event.request)
    ).catch(() => {
      // Fallback per le richieste offline
      if (event.request.method === 'GET') {
        return caches.match('index.html');
      }
    })
  );
});
