// Service worker: giữ phần vỏ app trong máy để mở được cả khi mất mạng.
// Tăng CACHE_VERSION mỗi lần sửa giao diện để máy tải bản mới.
const CACHE_VERSION = "chi-tieu-v2";
const SHELL = [
  "./",
  "./index.html",
  "./style.css?v=2",
  "./app.js?v=2",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;

  // Chỉ phục vụ phần vỏ từ cache. Lệnh gọi Apps Script luôn đi thẳng ra mạng
  // để không bao giờ đọc phải số liệu cũ.
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, copy)).catch(() => {});
        return res;
      });
    }).catch(() => caches.match("./index.html"))
  );
});
