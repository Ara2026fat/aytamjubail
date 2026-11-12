/* Service Worker — استراتيجية مبدئية للهيكل الأولي
   App Shell: cache-first  |  الطلبات الأخرى: network-first مع بديل دون اتصال */
const VERSION = 'v1.2.0';
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const SHELL_ASSETS = [
  './', './index.html', './offline.html', './manifest.webmanifest',
  './icon-192.png'
];
const FONTS = `fonts-${VERSION}`;
/* الخطوط تأتي من نطاق خارجي، فلم تكن تُخزَّن إطلاقاً: شرط
   origin === location.origin كان يستبعدها. النتيجة أن أي انقطاع شبكة
   أو جدار حماية مؤسسي يُسقط التنضيد كله إلى خط النظام. هذه القائمة
   تُخزَّن خزناً دائماً بعد أول زيارة متصلة. */
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![SHELL, RUNTIME, FONTS].includes(k)).map(k => caches.delete(k))))
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

  const url = new URL(request.url);

  /* الخطوط: المخزّن أولاً ثم الشبكة، وتُخزَّن بلا شرط النطاق.
     الاستجابة من نطاق آخر مبهمة (opaque) لكنها تُخزَّن وتُقدَّم بنجاح. */
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(res => {
        const copy = res.clone();
        caches.open(FONTS).then(c => c.put(request, copy));
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // الأصول: المخزّن أولاً
  e.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(res => {
      if (res.ok && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(RUNTIME).then(c => c.put(request, copy));
      }
      return res;
    }).catch(() => caches.match('./offline.html')))
  );
});
