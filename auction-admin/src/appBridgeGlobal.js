import { createApp } from '@shopify/app-bridge';

export function initAppBridge() {
  if (typeof window === 'undefined') {
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const host = urlParams.get('host');

  if (!host || window.shopify) {
    return;
  }

  const app = createApp({
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
    host,
    forceRedirect: true
  });

  window.shopify = app;
}

