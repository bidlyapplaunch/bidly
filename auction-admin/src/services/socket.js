import { io } from 'socket.io-client';
import { getBackendUrl } from '../config/backendConfig.js';

// Helper function to get shop from URL parameters
const getShopFromURL = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('shop');
};

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentBackendUrl = null;
  }

  connect() {
    // Get shop domain and determine backend URL
    const shopDomain = getShopFromURL();
    const backendUrl = getBackendUrl(shopDomain);
    
    // If already connected to the same backend, return existing socket
    if (this.socket && this.currentBackendUrl === backendUrl && this.isConnected) {
      return this.socket;
    }
    
    // If connected to a different backend, disconnect first
    if (this.socket && this.currentBackendUrl !== backendUrl) {
      this.disconnect();
    }
    
    // Create new connection if needed
    if (!this.socket) {
      this.currentBackendUrl = backendUrl;
      
      this.socket = io(backendUrl, {
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Admin WebSocket connection error:', error);
        this.isConnected = false;
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentBackendUrl = null;
    }
  }

  onStatusUpdate(callback) {
    if (this.socket) {
      this.socket.on('auction-status-update', callback);
    }
  }

  offStatusUpdate(callback) {
    if (this.socket) {
      this.socket.off('auction-status-update', callback);
    }
  }

  onBidUpdate(callback) {
    if (this.socket) {
      this.socket.on('bid-update', callback);
    }
  }

  offBidUpdate(callback) {
    if (this.socket) {
      this.socket.off('bid-update', callback);
    }
  }

  getSocket() {
    return this.socket;
  }

  isSocketConnected() {
    return this.isConnected;
  }
}

// Create a singleton instance
const socketService = new SocketService();

export default socketService;