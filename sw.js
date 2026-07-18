// Nombre de la caché - Incrementado a v11 para invalidar cachés obsoletas y asegurar la carga segura de app.js e index.html actualizados
const CACHE_NAME = 'romanico-v11';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data.js',
  './data.json',
  './manifest.json',
  './events.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Forzar la activación del Service Worker en cuanto se descargue
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    clients.claim().then(() => { // Tomar el control de los clientes activos inmediatamente
      return caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (cache !== CACHE_NAME) {
              console.log('Service Worker: Limpiando caché obsoleta', cache);
              return caches.delete(cache);
            }
          })
        );
      });
    })
  );
});

self.addEventListener('fetch', event => {
  // Excluir peticiones que no sean GET (como el POST de registro o inicio de sesión)
  // y cualquier llamada a los endpoints de la API del backend (/api/) para que vayan directas a red
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(response => {
      return response || fetch(event.request);
    })
  );
});
