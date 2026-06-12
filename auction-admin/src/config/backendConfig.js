/**
 * Backend URL Configuration
 *
 * The frontend must never know backend domains; all API access goes through
 * relative paths (e.g. `/api`) so the same build works behind any host/proxy.
 */

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
 * @returns {string} The API base URL (relative)
 */
export function getApiBaseUrl(shopDomain) {
  // Always return relative API root
  return `/api`;
}

export default {
  getBackendUrl,
  getApiBaseUrl
};
