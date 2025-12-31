/**
 * Utility for making authenticated fetch requests using App Bridge session tokens
 * This ensures all client-side requests include session tokens for Shopify compliance
 */

import { authenticatedFetch } from "@shopify/app-bridge/utilities";

/**
 * Creates an authenticated fetch function using App Bridge
 * @param {Object} app - App Bridge instance from useAppBridge()
 * @returns {Function} Authenticated fetch function
 */
export function createAuthenticatedFetch(app) {
  if (!app) {
    console.warn("App Bridge not available, falling back to regular fetch");
    return fetch;
  }

  return authenticatedFetch(app);
}

/**
 * Hook-style helper to get authenticated fetch
 * Use this in React components
 */
export function useAuthenticatedFetch(app) {
  if (!app) {
    return fetch;
  }
  return authenticatedFetch(app);
}

