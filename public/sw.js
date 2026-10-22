// RetroScope moved to https://nextroscope.lovelesslabs.net. This worker replaces the old caching one: it
// deletes its caches and unregisters itself, so returning visitors load the redirecting index.html.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("retroscope-pwa-")).map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => c.navigate(c.url));
    })()
  );
});
