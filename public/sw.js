const CACHE_PREFIX = "retroscope-pwa-";
const CACHE_VERSION = "v1";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// Dev safety: if a SW from a previous production build controls localhost dev,
// it can cache and serve stale assets, causing "old UI" and white-screen reloads.
// On localhost:8081, immediately unregister and disable all caching.
const IS_DEV_HOST =
  (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") &&
  self.location.port === "8081";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      self.skipWaiting();
      if (IS_DEV_HOST) return;
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
      if (IS_DEV_HOST) {
        // Nuke ALL caches (including our current cache) and unregister.
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
        await self.registration.unregister().catch(() => {});
        // Ask clients to reload so they get the dev server fresh.
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        clients.forEach((c) => c.postMessage({ type: "SW_UNREGISTERED_DEV" }));
        return;
      }
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
  if (IS_DEV_HOST) return;

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

