/* Service Worker — استراتيجية مبدئية للهيكل الأولي
   App Shell: cache-first  |  الطلبات الأخرى: network-first مع بديل دون اتصال */
const VERSION = 'v0.5.0';
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const SHELL_ASSETS = [
  './', './index.html', './offline.html', './manifest.webmanifest',
  './icon-192.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![SHELL, RUNTIME].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  // التنقل: الشبكة أولاً ثم الغلاف المخزّن
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => { caches.open(RUNTIME).then(c => c.put(request, res.clone())); return res; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./offline.html')))
    );
    return;
  }

  // الأصول: المخزّن أولاً
  e.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(res => {
      if (res.ok && new URL(request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(RUNTIME).then(c => c.put(request, copy));
      }
      return res;
    }).catch(() => caches.match('./offline.html')))
  );
});
