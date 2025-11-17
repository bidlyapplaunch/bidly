import axios from 'axios';

// Helper function to get shop from URL parameters
const getShopFromURL = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('shop') || 'ezza-auction.myshopify.com';
};

const getBackendUrl = () => {
  const shopDomain = getShopFromURL();
  if (window.BidlyBackendConfig && typeof window.BidlyBackendConfig.getBackendUrl === 'function') {
    return window.BidlyBackendConfig.getBackendUrl(shopDomain);
  }
  return 'https://bidly-auction-backend.onrender.com';
};

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
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
