self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('midi-cache-v1').then((cache) => {
      return cache.addAll([
        'index.html',
        'vr09b.js',
        'styles.css',
        'manifest.json'
      ]).catch((error) => {
        console.warn('Cache addAll failed, continuing anyway:', error);
      });
    })
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
