/**
 * @deprecated THIS FILE IS DISABLED
 * 
 * All backend API calls must go through authenticated Remix routes under /api/*
 * using authenticatedFetch from App Bridge.
 * 
 * This ensures Shopify session token validation and passes the embedded app check.
 * 
 * DO NOT USE THIS FILE - Use authenticatedFetch('/api/...') instead.
 * 
 * Example:
 *   const app = useAppBridge();
 *   const authFetch = authenticatedFetch(app);
 *   const response = await authFetch('/api/auctions');
 */

throw new Error(
  'app/services/api.js is disabled. ' +
  'Use authenticatedFetch("/api/...") instead. ' +
  'See file comments for migration guide.'
);

export const auctionAPI = {};
export const shopifyAPI = {};
export const analyticsAPI = {};
export default null;
