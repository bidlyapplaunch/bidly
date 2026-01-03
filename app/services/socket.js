/**
 * @deprecated THIS FILE IS DISABLED
 * 
 * WebSocket connections are disabled. All backend calls must go through
 * authenticated Remix routes under /api/* using authenticatedFetch from App Bridge.
 * 
 * This is required to pass Shopify's embedded app session token check.
 * Use polling instead for real-time updates.
 * 
 * DO NOT USE THIS FILE - Use authenticatedFetch('/api/...') with polling instead.
 */

// Removed socket.io-client import - WebSockets disabled

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect() {
    // WebSocket connections disabled - all backend calls must go through authenticated /api/* routes
    // This is required to pass Shopify's embedded app session token check
    console.warn('WebSocket connections are disabled. Use authenticated /api/* routes instead.');
    return null;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
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