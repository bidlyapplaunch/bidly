/**
 * Backend URL Configuration
 * Maps shop domains to their respective backend URLs
 * 
 * When you deploy a new Shopify app for a different store,
 * add the store domain and its backend URL to STORE_BACKEND_MAP
 */

// Store-to-backend mapping (disabled - frontend must never know backend domains)
const STORE_BACKEND_MAP = {};

// Default backend URL (disabled - use relative /api only)
const DEFAULT_BACKEND = '';

/**
 * Get backend URL for a given shop domain
 * @param {string} shopDomain - The shop's domain (e.g., 'mystore.myshopify.com')
 * @returns {string} The backend URL for that shop
 */
export function getBackendUrl(shopDomain) {
  // Frontend must never know backend domains; always use relative paths.
  return '';
}

/**
 * Get API base URL for a given shop domain
 * @param {string} shopDomain - The shop's domain
 * @returns {string} The API base URL (backend URL + '/api')
 */
export function getApiBaseUrl(shopDomain) {
  // Always return relative API root
  return `/api`;
}

/**
 * Get all mapped stores
 * @returns {Array} Array of shop domains that have mappings
 */
export function getMappedStores() {
  return Object.keys(STORE_BACKEND_MAP);
}

export default {
  getBackendUrl,
  getApiBaseUrl,
  getMappedStores,
  STORE_BACKEND_MAP,
  DEFAULT_BACKEND
};

