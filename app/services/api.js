import axios from 'axios';

const API_BASE_URL = 'https://bidly-auction-backend.onrender.com/api';

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
    
    // Add authentication token if available
    const token = localStorage.getItem('authToken');
    console.log('🔐 Auth Debug:', {
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'None',
      url: config.url
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
  }
};

// Shopify API endpoints
export const shopifyAPI = {
  // Product operations
  searchProducts: async (query, limit = 10) => {
    const response = await api.get('/shopify/products/search', {
      params: { q: query, limit }
    });
    return response.data.data; // Return the actual products array
  },

  getProductSuggestions: async (query, limit = 20) => {
    const response = await api.get('/shopify/products/suggestions', {
      params: { q: query, limit }
    });
    return response.data;
  },

  getProduct: async (productId) => {
    const response = await api.get(`/shopify/products/${productId}`);
    return response.data;
  },

  getAllProducts: async (limit = 50, pageInfo = null) => {
    const params = { limit };
    if (pageInfo) params.page_info = pageInfo;
    const response = await api.get('/shopify/products', { params });
    return response.data;
  },

  validateProduct: async (productId) => {
    const response = await api.get(`/shopify/products/${productId}/validate`);
    return response.data;
  },

  getProductInventory: async (productId) => {
    const response = await api.get(`/shopify/products/${productId}/inventory`);
    return response.data;
  },

  getProducts: async (productIds) => {
    const response = await api.post('/shopify/products/batch', { productIds });
    return response.data;
  },

  getProductByHandle: async (handle) => {
    const response = await api.get(`/shopify/products/handle/${handle}`);
    return response.data;
  },

  getProductsByVendor: async (vendor, limit = 50) => {
    const response = await api.get(`/shopify/products/vendor/${vendor}`, {
      params: { limit }
    });
    return response.data;
  },

  getProductsByType: async (productType, limit = 50) => {
    const response = await api.get(`/shopify/products/type/${productType}`, {
      params: { limit }
    });
    return response.data;
  },

  getProductsByTags: async (tags, limit = 50) => {
    const response = await api.post('/shopify/products/tags', { tags }, {
      params: { limit }
    });
    return response.data;
  },

  getServiceStatus: async () => {
    const response = await api.get('/shopify/status');
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

export default api;
