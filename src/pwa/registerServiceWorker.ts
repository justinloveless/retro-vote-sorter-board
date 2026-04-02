export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Never register during Vite dev: sw.js uses cache-first for same-origin assets, which serves
  // stale bundles and breaks HMR. Production and `vite preview` use PROD and still get the SW.
  if (!import.meta.env.PROD) {
    // Runtime evidence: an old SW can still control dev and serve stale assets, producing “old UI”
    // and white-screen reloads. In dev, proactively unregister and clear caches.
    try {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) void r.unregister();
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cachesAny = (window as any).caches as CacheStorage | undefined;
      if (cachesAny?.keys) {
        void cachesAny.keys().then((keys) => Promise.all(keys.map((k) => cachesAny.delete(k))));
      }
    } catch {
      // ignore
    }
    return;
  }

  const swUrl = `${import.meta.env.BASE_URL}sw.js`;

  navigator.serviceWorker
    .register(swUrl)
    .catch((err) => console.error('Service worker registration failed:', err));
}

