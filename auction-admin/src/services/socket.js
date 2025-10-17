import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect() {
    if (!this.socket) {
      this.socket = io('https://unsynchronous-theresia-indefinite.ngrok-free.dev', {
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('🔌 Admin WebSocket connected');
        this.isConnected = true;
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 Admin WebSocket disconnected');
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