/**
 * Backend URL Configuration
 * Maps shop domains to their respective backend URLs
 * 
 * When you deploy a new Shopify app for a different store,
 * add the store domain and its backend URL to STORE_BACKEND_MAP
 */

// Store-to-backend mapping
const STORE_BACKEND_MAP = {
  // Default store
  'bidly-2.myshopify.com': 'https://bidly-auction-backend.onrender.com',
  
  // New store with second backend
  '6sb15z-k1.myshopify.com': 'https://bidly-auction-backend-2.onrender.com',
  'true-nordic-dev.myshopify.com': 'https://bidly-auction-backend-2.onrender.com',
};

// Default backend URL (fallback for stores not in the map)
const DEFAULT_BACKEND = 'https://bidly-auction-backend.onrender.com';

/**
 * Get backend URL for a given shop domain
 * @param {string} shopDomain - The shop's domain (e.g., 'mystore.myshopify.com')
 * @returns {string} The backend URL for that shop
 */
export function getBackendUrl(shopDomain) {
  if (!shopDomain) {
    console.warn('⚠️ No shop domain provided, using default backend');
    return DEFAULT_BACKEND;
  }
  
  // Clean the shop domain (remove protocol, trailing slashes)
  const cleanShop = shopDomain
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase()
    .trim();
  
  // Check if we have a mapping for this shop
  const backendUrl = STORE_BACKEND_MAP[cleanShop];
  
  if (backendUrl) {
    console.log(`🔗 Mapped shop "${cleanShop}" to backend: ${backendUrl}`);
    return backendUrl;
  }
  
  // Fallback to default
  console.log(`⚠️ No mapping found for shop "${cleanShop}", using default backend: ${DEFAULT_BACKEND}`);
  return DEFAULT_BACKEND;
}

/**
 * Get API base URL for a given shop domain
 * @param {string} shopDomain - The shop's domain
 * @returns {string} The API base URL (backend URL + '/api')
 */
export function getApiBaseUrl(shopDomain) {
  return `${getBackendUrl(shopDomain)}/api`;
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

