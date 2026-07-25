/* LifeHub service worker — 离线缓存，让应用可安装、可离线打开 */
const CACHE = 'lifehub-v53';
const ASSETS = [
  './',
  './index.html',
  './assets/style.css',
  './assets/store.js',
  './assets/sport-cats.js',
  './assets/learn.js',
  './assets/app.js',
  './assets/life.js',
  './assets/sports.js',
  './assets/travel.js',
  './assets/ai.js',
  './assets/settings.js',
  './assets/manifest.webmanifest',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
  // 新版本接管后，强制刷新所有已打开的页面，确保立即用上新缓存（避免一直停留在旧版）
  e.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((cs) => cs.forEach((c) => { try { c.navigate(c.url); } catch (_) {} }))
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isNav = e.request.mode === 'navigate'; // 仅导航请求（打开页面）才兜底到 index.html
  // 缓存优先 + 后台静默更新（stale-while-revalidate），离线也能开，在线永远拿最新
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((resp) => {
          // 只缓存同源的 2xx 响应，避免把 WebLLM/模型等大体积跨域资源塞进 SW 缓存
          if (resp && resp.ok && url.origin === self.location.origin) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return resp;
        })
        .catch(() => (isNav ? caches.match('./index.html') : cached || Response.error()));
      if (cached) return cached; // 命中缓存先返回，后台再更新
      return network; // 未命中：等网络；导航失败才兜底 index.html
    })
  );
});
