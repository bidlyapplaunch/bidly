import axios from 'axios';
import { getApiBaseUrl } from '../config/backendConfig.js';
import authService from './auth.js';

// Helper function to get shop from URL parameters
// Try multiple sources: URL params, hash, App Bridge, or hostname
const getShopFromURL = () => {
  // Method 1: URL search params
  const urlParams = new URLSearchParams(window.location.search);
  let shop = urlParams.get('shop');
  
  if (shop) {
    console.log('🔍 Found shop in URL params:', shop);
    return shop;
  }
  
  // Method 2: Try URL hash (for embedded apps)
  if (window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    shop = hashParams.get('shop');
    if (shop) {
      console.log('🔍 Found shop in URL hash:', shop);
      return shop;
    }
  }
  
  // Method 3: Try App Bridge if available
  if (window.shopify && window.shopify.config) {
    const shopDomain = window.shopify.config.shop?.split('//')[1]?.split('/')[0];
    if (shopDomain) {
      console.log('🔍 Found shop in App Bridge config:', shopDomain);
      return shopDomain;
    }
  }
  
  // Method 4: Extract from hostname (for embedded apps)
  const hostname = window.location.hostname;
  if (hostname.includes('.myshopify.com')) {
    console.log('🔍 Found shop from hostname:', hostname);
    return hostname;
  }
  
  // Method 5: Try to get from parent window (if in iframe)
  try {
    if (window.parent && window.parent !== window) {
      const parentUrl = new URL(window.parent.location.href);
      shop = parentUrl.searchParams.get('shop');
      if (shop) {
        console.log('🔍 Found shop in parent window:', shop);
        return shop;
      }
    }
  } catch (e) {
    // Cross-origin, can't access parent
  }
  
  // Fallback: return null (will use default backend)
  console.warn('⚠️ Could not detect shop domain, using default backend');
  return null;
};

// Create axios instance with dynamic baseURL
const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

let isHandlingAuthError = false;

// Request interceptor for logging, auth, and dynamic backend URL
api.interceptors.request.use(
  (config) => {
    // Get shop domain and determine backend URL
    const shopDomain = getShopFromURL();
    const apiBaseUrl = getApiBaseUrl(shopDomain);
    
    // Set dynamic baseURL for this request
    config.baseURL = apiBaseUrl;
    
    console.log(`Making ${config.method?.toUpperCase()} request to ${apiBaseUrl}${config.url}`);
    console.log('🔗 Backend URL:', apiBaseUrl, 'for shop:', shopDomain);
    
    // Add shop parameter to all requests
    if (shopDomain && !config.params?.shop) {
      config.params = { ...config.params, shop: shopDomain };
      console.log('🏪 Added shop parameter:', shopDomain);
    }
    
    // Add authentication token if available
    const token = localStorage.getItem('authToken');
    console.log('🔐 Auth Debug:', {
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'None',
      url: config.url,
      shop: shopDomain
    });
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Added auth header to request');
    } else {
      console.log('⚠️ No auth token found for request');
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || '';
    const lowercaseMessage = typeof message === 'string' ? message.toLowerCase() : '';

    if (
      status === 401 &&
      !isHandlingAuthError &&
      (lowercaseMessage.includes('token') || lowercaseMessage.includes('unauthorized'))
    ) {
      isHandlingAuthError = true;
      console.warn('🔐 Detected invalid auth token. Logging out and reloading.');
      authService.logout();
      const { origin, pathname, search } = window.location;
      window.location.href = `${origin}${pathname}${search}`;
    }

    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Auction API endpoints
export const auctionAPI = {
  // Get all auctions with optional filters
  getAllAuctions: async (params = {}) => {
    const response = await api.get('/auctions', { params });
    return response.data;
  },

  // Get single auction by ID
  getAuctionById: async (id) => {
    const response = await api.get(`/auctions/${id}`);
    return response.data;
  },

  // Create new auction
  createAuction: async (auctionData) => {
    const response = await api.post('/auctions', auctionData);
    return response.data;
  },

  // Update auction
  updateAuction: async (id, updateData) => {
    const response = await api.put(`/auctions/${id}`, updateData);
    return response.data;
  },

  // Delete auction
  deleteAuction: async (id) => {
    const response = await api.delete(`/auctions/${id}`);
    return response.data;
  },

  // Place bid on auction
  placeBid: async (id, bidData) => {
    const response = await api.post(`/auctions/${id}/bid`, bidData);
    return response.data;
  },

  // Get auction statistics
  getAuctionStats: async () => {
    const response = await api.get('/auctions/stats');
    return response.data;
  },

  // Close auction (update status to closed)
  closeAuction: async (id) => {
    const response = await api.put(`/auctions/${id}`, { status: 'closed' });
    return response.data;
  },

  // Relist auction (reactivate ended auction without bids)
  relistAuction: async (id, auctionData) => {
    const response = await api.put(`/auctions/${id}/relist`, auctionData);
    return response.data;
  },

  // Shopify product data operations
  refreshProductData: async (auctionId) => {
    const response = await api.put(`/auctions/${auctionId}/refresh-product`);
    return response.data;
  },

  refreshAllProductData: async () => {
    const response = await api.put('/auctions/refresh-all-products');
    return response.data;
  },

  getAuctionsWithProductData: async (params = {}) => {
    const response = await api.get('/auctions/with-product-data', { params });
    return response.data;
  },

  // Get Shopify product details for store redirect
  getShopifyProduct: async (productId, shop = null) => {
    const shopDomain = shop || getShopFromURL();
    const response = await api.get(`/shopify/products/${productId}`, {
      params: { shop: shopDomain }
    });
    return response.data;
  }
};

// Shopify API endpoints
export const shopifyAPI = {
  // Product operations
  searchProducts: async (query, limit = 10, shop = null) => {
    const shopDomain = shop || getShopFromURL();
    const response = await api.get('/shopify/products/search', {
      params: { q: query, limit, shop: shopDomain }
    });
    return response.data.data; // Return the actual products array
  },

  getProductSuggestions: async (query, limit = 20, shop = null) => {
    const shopDomain = shop || getShopFromURL();
    const response = await api.get('/shopify/products/suggestions', {
      params: { q: query, limit, shop: shopDomain }
    });
    return response.data;
  },

  getProduct: async (productId, shop = null) => {
    const shopDomain = shop || getShopFromURL();
    const response = await api.get(`/shopify/products/${productId}`, {
      params: { shop: shopDomain }
    });
    return response.data;
  },

  getAllProducts: async (limit = 50, pageInfo = null, shop = null) => {
    const shopDomain = shop || getShopFromURL();
    const params = { limit, shop: shopDomain };
    if (pageInfo) params.page_info = pageInfo;
    const response = await api.get('/shopify/products', { params });
    return response.data;
  },

  validateProduct: async (productId, shop = null) => {
    const shopDomain = shop || getShopFromURL();
    const response = await api.get(`/shopify/products/${productId}/validate`, {
      params: { shop: shopDomain }
    });
    return response.data;
  },

  getProductInventory: async (productId, shop = null) => {
    const shopDomain = shop || getShopFromURL();
    const response = await api.get(`/shopify/products/${productId}/inventory`, {
      params: { shop: shopDomain }
    });
    return response.data;
  },

  getProducts: async (productIds, shop = null) => {
    const shopDomain = shop || getShopFromURL();
    const response = await api.post('/shopify/products/batch', { productIds, shop: shopDomain });
    return response.data;
  },

  getProductByHandle: async (handle, shop = null) => {
    const shopDomain = shop || getShopFromURL();
    const response = await api.get(`/shopify/products/handle/${handle}`, {
      params: { shop: shopDomain }
    });
    return response.data;
  },

  getProductsByVendor: async (vendor, limit = 50, shop = null) => {
    const shopDomain = shop || getShopFromURL();
    const response = await api.get(`/shopify/products/vendor/${vendor}`, {
      params: { limit, shop: shopDomain }
    });
    return response.data;
  },

  getProductsByType: async (productType, limit = 50, shop = null) => {
    const shopDomain = shop || getShopFromURL();
    const response = await api.get(`/shopify/products/type/${productType}`, {
      params: { limit, shop: shopDomain }
    });
    return response.data;
  },

  getProductsByTags: async (tags, limit = 50, shop = null) => {
    const shopDomain = shop || getShopFromURL();
    const response = await api.post('/shopify/products/tags', { tags, shop: shopDomain }, {
      params: { limit }
    });
    return response.data;
  },

  getServiceStatus: async (shop = null) => {
    const shopDomain = shop || getShopFromURL();
    const response = await api.get('/shopify/status', {
      params: { shop: shopDomain }
    });
    return response.data;
  }
};

// Analytics API endpoints
export const analyticsAPI = {
  // Get comprehensive analytics
  getAnalytics: async (period = '30d') => {
    const response = await api.get('/analytics/', {
      params: { period }
    });
    return response.data;
  },

  // Get revenue analytics
  getRevenueAnalytics: async (period = '30d') => {
    const response = await api.get('/analytics/revenue', {
      params: { period }
    });
    return response.data;
  },

  // Get user analytics
  getUserAnalytics: async (period = '30d') => {
    const response = await api.get('/analytics/users', {
      params: { period }
    });
    return response.data;
  }
};

export const customizationSettingsAPI = {
  async getSettings(type, options = {}) {
    const params = { ...options };
    if (options.includeMeta) {
      params.includeMeta = '1';
    }
    const response = await api.get(`/customization/${type}`, { params });
    return response.data;
  },

  async saveSettings(type, settings, options = {}) {
    const params = { ...options };
    const response = await api.put(`/customization/${type}`, settings, { params });
    return response.data;
  },

  async getPreview(type, state = 'active', options = {}) {
    const params = { state, ...options };
    const response = await api.get(`/customization/${type}/preview`, { params });
    return response.data;
  },

  async getMeta(type) {
    const response = await api.get(`/customization/${type}/meta`);
    return response.data;
  }
};

export const billingAPI = {
  async getCurrentPlan() {
    const response = await api.get('/billing/current');
    return response.data;
  },

  async subscribe(plan) {
    const response = await api.post('/billing/subscribe', { plan });
    return response.data;
  },

  async syncPlan() {
    const response = await api.post('/billing/sync');
    return response.data;
  },

  async getCapabilities() {
    const response = await api.get('/billing/capabilities');
    return response.data;
  }
};

export const onboardingAPI = {
  async getStatus() {
    const response = await api.get('/onboarding/status');
    return response.data;
  },

  async complete() {
    const response = await api.post('/onboarding/complete');
    return response.data;
  }
};

export default api;
