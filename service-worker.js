self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('midi-cache').then((cache) =>
      cache.addAll(['index.html', 'midi.js', 'manifest.json'])
    )
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) =>
      response || fetch(event.request)
    )
  );
});
