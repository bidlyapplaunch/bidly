import { createApp } from '@shopify/app-bridge';

export function initAppBridge() {
  if (typeof window === 'undefined') {
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const host = urlParams.get('host');

  if (!host) {
    // No host means we're not in an embedded context yet
    return;
  }

  if (window.shopify) {
    // Already initialized
    return;
  }

  // Try multiple sources for the API key
  let apiKey = null;
  
  // 1. Try URL parameter (Shopify embedded apps include it)
  apiKey = urlParams.get('apiKey') || urlParams.get('api_key');
  
  // 2. Try from window (injected via script tag in HTML)
  if (!apiKey && window.SHOPIFY_API_KEY) {
    apiKey = window.SHOPIFY_API_KEY;
  }
  
  // 3. Try from meta tag
  if (!apiKey) {
    const metaTag = document.querySelector('meta[name="shopify-api-key"]');
    if (metaTag) {
      apiKey = metaTag.getAttribute('content');
    }
  }
  
  // 4. Try environment variable (Vite injects these at build time)
  if (!apiKey) {
    apiKey = import.meta.env.VITE_SHOPIFY_API_KEY;
  }

  // If still no API key, log warning but don't throw
  // App Bridge might be initialized later in React context
  if (!apiKey) {
    console.warn('⚠️ Shopify API key not found. App Bridge initialization skipped. It will be initialized when available.');
    return;
  }

  try {
    const app = createApp({
      apiKey,
      host,
      forceRedirect: true
    });

    window.shopify = app;
    console.log('✅ App Bridge initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize App Bridge:', error);
    // Don't throw - let React handle initialization if needed
  }
}

