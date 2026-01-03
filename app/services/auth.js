/**
 * @deprecated THIS FILE IS DISABLED
 * 
 * Authentication is handled by Shopify's OAuth flow and session tokens.
 * All API calls must go through authenticated Remix routes under /api/*
 * using authenticatedFetch from App Bridge.
 * 
 * DO NOT USE THIS FILE - Use Shopify's built-in authentication instead.
 */

throw new Error(
  'app/services/auth.js is disabled. ' +
  'Use Shopify\'s built-in OAuth authentication. ' +
  'All API calls must use authenticatedFetch("/api/...") instead.'
);

export default {
  login: () => { throw new Error('authService is disabled'); },
  register: () => { throw new Error('authService is disabled'); },
  logout: () => { throw new Error('authService is disabled'); },
  isAuthenticated: () => false,
  getToken: () => null,
  getUser: () => null,
};
