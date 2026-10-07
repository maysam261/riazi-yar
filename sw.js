'use strict';

const CACHE_VERSION = 'riazi-yar-v24';

const APP_SHELL = [
  './', './index.html', './style.css', './script.js', './manifest.json',
  './icons/icon-192.svg', './icons/icon-512.svg', './icons/icon-maskable-512.svg',
  './icons/apple-touch-icon.svg', './icons/telegram-logo.png', './icons/bale-logo.png',
  './icons/eitaa-logo.png',
  './fonts/webfonts/Vazirmatn-Regular.woff2',
  './fonts/webfonts/Vazirmatn-Bold.woff2'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function(cache) {
        return Promise.all(APP_SHELL.map(function(url) {
          return cache.add(url).catch(function(err) { console.warn('کش نشد:', url, err); });
        }));
      })
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(keys.filter(function(k) { return k !== CACHE_VERSION; }).map(function(k) { return caches.delete(k); }));
      })
      .then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(function() {
      return caches.match('./index.html').then(function(r) { return r || offlineResp(); });
    }));
    return;
  }

  // ✅ Network-first برای فایل‌های اصلی
  if (url.pathname.endsWith('/script.js') || url.pathname.endsWith('/style.css') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req).then(function(res) {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(function(cache) { cache.put(req, copy); }).catch(function() {});
        }
        return res;
      }).catch(function() {
        return caches.match(req).then(function(c) { return c || offlineResp(); });
      })
    );
    return;
  }

  // Cache-first برای بقیه
  event.respondWith(caches.match(req).then(function(cached) { return cached || fetchAndCache(req); }));
});

async function fetchAndCache(req) {
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then(function(cache) { cache.put(req, copy); }).catch(function() {});
    }
    return res;
  } catch (e) {
    return offlineResp();
  }
}

function offlineResp() {
  return new Response('آفلاین — منبع یافت نشد', {
    status: 503, statusText: 'Offline',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

self.addEventListener('message', function(event) {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(function(keys) { return Promise.all(keys.map(function(k) { return caches.delete(k); })); })
      .then(function() { if (event.source) event.source.postMessage({ type: 'CACHE_CLEARED' }); });
  }
});