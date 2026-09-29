// Service Worker Oficial para Agentise Mega CRM (PWA 24/7) - V4 Guia Atualizado
const CACHE_NAME = 'agentise-crm-cache-v4-guia-2026';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/guia',
  '/guia.html',
  '/style.css?v=2.2.0',
  '/app.js?v=2.2.0',
  '/manifest.json',
  '/termos',
  '/privacidade'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch((err) => {
      console.warn('[SW] Falha ao pré-carregar alguns ativos no cache:', err);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => {
          console.log('[SW] Purgando cache legado:', k);
          return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Não intercepta chamadas de API REST para garantir tempo real e 24/7 sem stale data
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Estratégia Network-First para documentos HTML/rotas: no celular sempre busca a versão mais recente quando online
  const isDocument = event.request.mode === 'navigate' || 
                     event.request.destination === 'document' ||
                     url.pathname === '/' || 
                     url.pathname.endsWith('.html') || 
                     url.pathname === '/guia' || 
                     url.pathname === '/termos' || 
                     url.pathname === '/privacidade';

  if (isDocument) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Para assets (CSS, JS, manifest), busca da rede primeiro para garantir atualização instantânea, com fallback no cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
