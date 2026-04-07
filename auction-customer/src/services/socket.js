import { io } from 'socket.io-client';

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

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect() {
    if (!this.socket) {
      const backendUrl = getBackendUrl();

      // Read auth token from sessionStorage or localStorage
      const token = (() => {
        try {
          const auth = JSON.parse(sessionStorage.getItem('customerAuth') || '{}');
          if (auth.token) return auth.token;
        } catch { /* ignore */ }
        return null;
      })();

      this.socket = io(backendUrl, {
        transports: ['websocket', 'polling'],
        auth: { token }
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
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
    }
  }

  joinAuction(auctionId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-auction', auctionId);
    }
  }

  leaveAuction(auctionId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-auction', auctionId);
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

  onTimeExtension(callback) {
    if (this.socket) {
      this.socket.on('auction-time-extended', callback);
    }
  }

  offTimeExtension(callback) {
    if (this.socket) {
      this.socket.off('auction-time-extended', callback);
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
