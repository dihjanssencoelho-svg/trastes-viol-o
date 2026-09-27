// Service worker do Trastes — permite abrir o app offline depois da 1ª visita.
// Precisa estar hospedado num servidor real com HTTPS (ou localhost) para funcionar;
// não funciona quando o HTML é aberto direto do disco (file://) nem dentro do
// preview de artifacts do Claude.ai.
const CACHE_NAME = 'trastes-v2'; // troque este número sempre que quiser forçar todo mundo a pegar a versão nova
const APP_SHELL = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// index.html (e navegação) usa "rede primeiro": sempre busca a versão mais nova
// quando há internet, e só cai no cache se estiver offline. Isso evita o
// problema clássico de PWA mostrar uma versão antiga do app depois de uma
// atualização. Ícones e manifest (que quase nunca mudam) continuam servidos
// do cache primeiro, para abrir instantaneamente.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const isAppCode = event.request.mode === 'navigate' || event.request.url.endsWith('index.html') || event.request.url.endsWith('/');

  if (isAppCode) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
