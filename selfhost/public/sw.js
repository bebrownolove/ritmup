// Оболочка приложения «Ритм»: мгновенный запуск с домашнего экрана и работа без сети.
// Данные аккаунта (/api/*) никогда не кэшируются.
const CACHE = "ritm-shell-v2";
const SHELL = ["/", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request) || await cache.match("/");
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") { event.respondWith(networkFirst(request)); return; }
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
