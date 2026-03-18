const CACHE_PREFIX = "retroscope-pwa-";
const CACHE_VERSION = "v1";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      self.skipWaiting();
      const cache = await caches.open(CACHE_NAME);
      const indexUrl = new URL("index.html", self.registration.scope).toString();

      // Cache the app shell so navigations work offline.
      await cache.add(indexUrl).catch(() => {});
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      );
      self.clients.claim();
    })()
  );
});

function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (!isSameOrigin(request)) return;

  const scope = self.registration.scope;
  const indexUrl = new URL("index.html", scope).toString();

  // SPA navigation requests should fall back to the cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(indexUrl, fresh.clone()).catch(() => {});
          return fresh;
        } catch (err) {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(indexUrl)) || Promise.reject(err);
        }
      })()
    );
    return;
  }

  // For static assets: cache-first, then network.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;

      const fresh = await fetch(request);
      if (fresh && fresh.ok) {
        cache.put(request, fresh.clone()).catch(() => {});
      }
      return fresh;
    })()
  );
});

