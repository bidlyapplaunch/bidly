import axios from 'axios';
import { getApiBaseUrl } from '../config/backendConfig.js';

// Helper function to get shop from URL parameters
const getShopFromURL = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('shop');
};

class AuthService {
  constructor() {
    this.token = localStorage.getItem('authToken');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
  }

  async login(email, password) {
    try {
      // Get shop domain and determine backend URL dynamically
      const shopDomain = getShopFromURL();
      const apiBaseUrl = getApiBaseUrl(shopDomain);
      
      console.log('🔐 Login using backend:', apiBaseUrl, 'for shop:', shopDomain);
      
      const response = await axios.post(`${apiBaseUrl}/auth/login`, {
        email,
        password
      });

      if (response.data.success) {
        this.token = response.data.data.token;
        this.user = response.data.data.user;
        
        // Store in localStorage
        localStorage.setItem('authToken', this.token);
        localStorage.setItem('user', JSON.stringify(this.user));
        
        return response.data;
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async register(username, email, password, role = 'admin') {
    try {
      // Get shop domain and determine backend URL dynamically
      const shopDomain = getShopFromURL();
      const apiBaseUrl = getApiBaseUrl(shopDomain);
      
      console.log('🔐 Register using backend:', apiBaseUrl, 'for shop:', shopDomain);
      
      const response = await axios.post(`${apiBaseUrl}/auth/register`, {
        name: username, // Backend expects 'name' not 'username'
        email,
        password,
        role
      });

      if (response.data.success) {
        // Auto-login after registration
        return this.login(email, password);
      }
    } catch (error) {
      console.error('Registration error:', error);
      console.error('Registration error response:', error.response?.data);
      console.error('Registration error status:', error.response?.status);
      console.error('Registration error headers:', error.response?.headers);
      console.error('Registration request config:', {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      });
      
      // Re-throw with more context
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.errors?.map(e => `${e.field || e.path}: ${e.message || e.msg}`).join(', ') ||
                          error.message || 
                          'Registration failed';
      const enhancedError = new Error(errorMessage);
      enhancedError.response = error.response;
      throw enhancedError;
    }
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }

  isAuthenticated() {
    return !!this.token;
  }

  getToken() {
    return this.token;
  }

  getUser() {
    return this.user;
  }

  // Initialize auth headers if token exists
  initializeAuth() {
    // Token will be automatically added by the API service interceptor
    // No need to set it on the default axios instance
  }
}

export default new AuthService();
