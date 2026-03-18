export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Register on production and when running locally (service workers require HTTPS except on localhost).
  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '[::1]';
  if (!(import.meta.env.PROD || isLocalhost)) return;

  const swUrl = `${import.meta.env.BASE_URL}sw.js`;

  navigator.serviceWorker
    .register(swUrl)
    .catch((err) => console.error('Service worker registration failed:', err));
}

