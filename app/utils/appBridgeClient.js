import createApp from "@shopify/app-bridge";

let cachedApp = null;
let cachedKey = null;
let cachedHost = null;

export function getEmbeddedAppBridgeApp() {
  if (typeof window === "undefined") return null;

  const apiKey = window.__SHOPIFY_API_KEY__ || window.SHOPIFY_API_KEY;
  const host = new URLSearchParams(window.location.search).get("host");

  if (!apiKey || !host) return null;

  if (cachedApp && cachedKey === apiKey && cachedHost === host) {
    return cachedApp;
  }

  cachedKey = apiKey;
  cachedHost = host;
  cachedApp = createApp({
    apiKey,
    host,
    forceRedirect: true,
  });

  return cachedApp;
}


