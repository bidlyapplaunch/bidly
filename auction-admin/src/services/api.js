import axios from 'axios';

const API_BASE_URL = 'https://bidly-auction-backend.onrender.com/api';

// Helper function to get shop from URL parameters
const getShopFromURL = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('shop') || 'ezza-auction.myshopify.com';
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging and auth
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
    
    // Add shop parameter to all requests
    const shopDomain = getShopFromURL();
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

// Customization API endpoints
export const customizationAPI = {
  // Get customization settings
  getCustomization: async (shopDomain = null) => {
    const shop = shopDomain || getShopFromURL();
    const response = await api.get('/customization', {
      params: { shop }
    });
    return response.data;
  },

  // Save customization settings
  saveCustomization: async (shopDomain, customizationData) => {
    const shop = shopDomain || getShopFromURL();
    const response = await api.post('/customization', customizationData, {
      params: { shop }
    });
    return response.data;
  }
};

export default api;
