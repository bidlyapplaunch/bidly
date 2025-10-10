import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect() {
    if (!this.socket) {
      this.socket = io('http://localhost:5002', {
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('🔌 Connected to WebSocket server');
        this.isConnected = true;
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 Disconnected from WebSocket server');
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
      console.log(`👥 Joined auction room: ${auctionId}`);
    }
  }

  leaveAuction(auctionId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-auction', auctionId);
      console.log(`👋 Left auction room: ${auctionId}`);
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
