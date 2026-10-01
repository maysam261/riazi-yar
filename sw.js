/* ============================================================
   Service Worker — ریاضی‌یار
   استراتژی: Cache-First + سقوط به index.html در حالت آفلاین
   ============================================================ */
'use strict';

const CACHE_VERSION = 'riazi-yar-v1';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-maskable-512.svg',
  './icons/apple-touch-icon.svg'
];

// دامنه‌هایی که محتوایشان هم کش می‌شود (فونت وزیرمتن)
const RUNTIME_HOSTS = ['cdn.jsdelivr.net'];

/* ---------- Install: کش کردن App Shell ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => Promise.all(
        APP_SHELL.map(url =>
          cache.add(url).catch(err => console.warn('کش نشد:', url, err))
        )
      ))
      .then(() => self.skipWaiting())
  );
});

/* ---------- Activate: پاک‌سازی کش‌های قدیمی ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---------- Fetch ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  const isSameOrigin = url.origin === self.location.origin;
  const isRuntimeHost = RUNTIME_HOSTS.includes(url.hostname);
  if (!isSameOrigin && !isRuntimeHost) return;

  // ناوبری صفحه → اگر آفلاین بود، index.html بیاور
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html').then(r => r || offlineResponse()))
    );
    return;
  }

  // بقیه منابع → Cache-First
  event.respondWith(
    caches.match(req).then(cached => cached || fetchAndCache(req))
  );
});

/* ---------- Fetch + ذخیره ---------- */
async function fetchAndCache(req) {
  try {
    const res = await fetch(req);
    if (res && (res.status === 200 || res.type === 'opaque')) {
      const copy = res.clone();
      caches.open(CACHE_VERSION)
        .then(cache => cache.put(req, copy))
        .catch(() => {});
    }
    return res;
  } catch {
    const accept = req.headers.get('accept') || '';
    if (accept.includes('text/html')) {
      const fb = await caches.match('./index.html');
      if (fb) return fb;
    }
    return offlineResponse();
  }
}

function offlineResponse() {
  return new Response('آفلاین — منبع یافت نشد', {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

/* ---------- پیام از سمت کلاینت ---------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => event.source && event.source.postMessage({ type: 'CACHE_CLEARED' }));
  }
});