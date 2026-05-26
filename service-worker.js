/*
  service-worker.js - RetroRide MVP v2.7
  PWA機能・オフライン対応
  CLAUDE.md準拠：必ず守ること - オフライン動作
*/

const CACHE_NAME = 'retro-ride-v2.7';
const CACHE_ASSETS = [
  '/',
  '/index.html',
  '/src/main.js',
  '/src/style.css',
  '/manifest.webmanifest'
];

// インストール時：アセットをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// アクティブ時：古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// フェッチ時：キャッシュファーストで応答
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // キャッシュにあれば返す、なければネットワークから取得
        return response || fetch(event.request);
      })
      .catch(() => {
        // オフライン時はindex.htmlを返す（SPA対応）
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});