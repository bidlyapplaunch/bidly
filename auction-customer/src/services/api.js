import axios from 'axios';

// Helper function to get shop from URL parameters
const getShopFromURL = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const shop = urlParams.get('shop') || window.BidlyMarketplaceConfig?.shop || window.Shopify?.shop || '';
  if (!shop) console.warn('Bidly: No shop domain found in URL or config');
  return shop;
};

const getBackendUrl = () => {
  const shopDomain = getShopFromURL();
  if (window.BidlyBackendConfig && typeof window.BidlyBackendConfig.getBackendUrl === 'function') {
    return window.BidlyBackendConfig.getBackendUrl(shopDomain);
  }
  return '';
};

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 second timeout
});

// Request interceptor for logging and shop parameter
api.interceptors.request.use(
  (config) => {
    const backendUrl = getBackendUrl();
    config.baseURL = `${backendUrl}/api`;

    console.log(`Making ${config.method?.toUpperCase()} request to ${backendUrl}${config.url}`);
    
    // Add shop parameter to all requests
    const shopDomain = getShopFromURL();
    if (shopDomain && !config.params?.shop) {
      config.params = { ...config.params, shop: shopDomain };
      console.log('🏪 Added shop parameter:', shopDomain);
    }

    // Add auth token to requests if available
    try {
      const auth = JSON.parse(sessionStorage.getItem('customerAuth') || '{}');
      if (auth.token) {
        config.headers.Authorization = `Bearer ${auth.token}`;
      }
    } catch (e) {
      // ignore parse errors
    }

    // Add customer ID from localStorage if available (for bidly bidders)
    if (!config.headers.Authorization) {
      try {
        const bidder = JSON.parse(localStorage.getItem('bidly_bidder') || '{}');
        if (bidder.customerId) {
          config.headers['X-Bidly-Customer-Id'] = bidder.customerId;
        }
      } catch (e) {
        // ignore
      }
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
  // Get all visible auctions (pending and active)
  getVisibleAuctions: async () => {
    const response = await api.get('/auctions');
    return response.data;
  },

  // Get single auction by ID
  getAuctionById: async (id) => {
    const response = await api.get(`/auctions/${id}`);
    return response.data;
  },

  // Place bid on auction
  placeBid: async (id, bidData) => {
    const response = await api.post(`/auctions/${id}/bid`, bidData);
    return response.data;
  },

  // Buy now
  buyNow: async (id, payload) => {
    const response = await api.post(`/auctions/${id}/buy-now`, payload);
    return response.data;
  }
};

export const customerAPI = {
  saveCustomer: async (payload) => {
    const response = await api.post('/customers/saveCustomer', payload);
    return response.data;
  }
};

// Shopify API endpoints for customer frontend
export const shopifyAPI = {
  getProduct: async (productId) => {
    const response = await api.get(`/shopify/products/${productId}`);
    return response.data;
  },

  searchProducts: async (query, limit = 10) => {
    const response = await api.get('/shopify/products/search', {
      params: { q: query, limit }
    });
    return response.data;
  }
};

export default api;
