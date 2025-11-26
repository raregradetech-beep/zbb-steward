// super-simple offline cache
const CACHE = 'zbb-v1';
const FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js'
];

// install event – cache files
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  );
});

// fetch event – serve from cache when offline
self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request).then(res => res || fetch(evt.request))
  );
});
