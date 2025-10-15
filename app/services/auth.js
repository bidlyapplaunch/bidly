import axios from 'axios';

const API_BASE_URL = 'https://bidly-auction-backend.onrender.com/api';

class AuthService {
  constructor() {
    this.token = localStorage.getItem('authToken');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
  }

  async login(email, password) {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password
      }, {
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
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        username,
        email,
        password,
        role
      }, {
      });

      if (response.data.success) {
        // Auto-login after registration
        return this.login(email, password);
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
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
