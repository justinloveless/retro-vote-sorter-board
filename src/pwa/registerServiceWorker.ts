export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Never register during Vite dev: sw.js uses cache-first for same-origin assets, which serves
  // stale bundles and breaks HMR. Production and `vite preview` use PROD and still get the SW.
  if (!import.meta.env.PROD) return;

  const swUrl = `${import.meta.env.BASE_URL}sw.js`;

  navigator.serviceWorker
    .register(swUrl)
    .catch((err) => console.error('Service worker registration failed:', err));
}

