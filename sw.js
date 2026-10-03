'use strict';

const CACHE_VERSION = 'riazi-yar-v11';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-maskable-512.svg',
  './icons/apple-touch-icon.svg',
  './fonts/webfonts/Vazirmatn-Regular.woff2',
  './fonts/webfonts/Vazirmatn-Bold.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => Promise.all(
        APP_SHELL.map(url => cache.add(url).catch(err => console.warn('کش نشد:', url, err)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('./index.html').then(r => r || offlineResp())));
    return;
  }
  event.respondWith(caches.match(req).then(c => c || fetchAndCache(req)));
});

async function fetchAndCache(req) {
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then(cache => cache.put(req, copy)).catch(() => {});
    }
    return res;
  } catch {
    const accept = req.headers.get('accept') || '';
    if (accept.includes('text/html')) {
      const fb = await caches.match('./index.html');
      if (fb) return fb;
    }
    return offlineResp();
  }
}

function offlineResp() {
  return new Response('آفلاین', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
