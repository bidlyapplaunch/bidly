/**
 * Auction Product Widget JavaScript
 * Handles real-time updates, bidding, and modal interactions
 */

class AuctionProductWidget {
  constructor(auctionId, endTime) {
    this.auctionId = auctionId;
    this.endTime = endTime;
    this.socket = null;
    this.timerInterval = null;
    this.isInitialized = false;
    
    this.init();
  }

  init() {
    if (this.isInitialized) return;
    
    console.log('🎯 Initializing Auction Product Widget for auction:', this.auctionId);
    
    // Initialize countdown timer
    if (this.endTime) {
      this.startCountdown();
    }
    
    // Connect to WebSocket for real-time updates
    this.connectWebSocket();
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.isInitialized = true;
  }

  startCountdown() {
    const timerElement = document.querySelector(`#bidly-auction-widget-${this.auctionId} .bidly-countdown-timer`);
    if (!timerElement) return;

    this.timerInterval = setInterval(() => {
      const now = new Date().getTime();
      const endTime = new Date(this.endTime).getTime();
      const timeLeft = endTime - now;

      if (timeLeft <= 0) {
        this.handleAuctionEnd();
        return;
      }

      const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

      timerElement.querySelector('.bidly-timer-days').textContent = days;
      timerElement.querySelector('.bidly-timer-hours').textContent = hours;
      timerElement.querySelector('.bidly-timer-minutes').textContent = minutes;
      timerElement.querySelector('.bidly-timer-seconds').textContent = seconds;
    }, 1000);
  }

  connectWebSocket() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/socket.io/`;
      
      // Use Socket.IO for WebSocket connection
      if (typeof io !== 'undefined') {
        this.socket = io(wsUrl);
        
        this.socket.on('connect', () => {
          console.log('🔌 Connected to auction WebSocket');
          this.socket.emit('join-auction', this.auctionId);
        });
        
        this.socket.on('bid-updated', (data) => {
          if (data.auctionId === this.auctionId) {
            this.updateBidInfo(data);
          }
        });
        
        this.socket.on('auction-ended', (data) => {
          if (data.auctionId === this.auctionId) {
            this.handleAuctionEnd();
          }
        });
        
        this.socket.on('disconnect', () => {
          console.log('🔌 Disconnected from auction WebSocket');
        });
      }
    } catch (error) {
      console.warn('⚠️ WebSocket connection failed:', error);
    }
  }

  updateBidInfo(data) {
    console.log('📈 Updating bid info:', data);
    
    // Update current bid
    const currentBidElement = document.querySelector(`#bidly-auction-widget-${this.auctionId} .bidly-amount[data-current-bid]`);
    if (currentBidElement) {
      currentBidElement.textContent = `$${data.currentBid.toFixed(2)}`;
      currentBidElement.classList.add('bidly-amount-updated');
      setTimeout(() => {
        currentBidElement.classList.remove('bidly-amount-updated');
      }, 500);
    }
    
    // Update bid count
    const bidCountElement = document.querySelector(`#bidly-auction-widget-${this.auctionId} .bidly-count[data-bid-count]`);
    if (bidCountElement) {
      bidCountElement.textContent = data.bidCount;
    }
    
    // Show notification
    this.showNotification(`New bid: $${data.currentBid.toFixed(2)}`);
  }

  handleAuctionEnd() {
    console.log('🏁 Auction ended:', this.auctionId);
    
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    // Update status
    const statusElement = document.querySelector(`#bidly-auction-widget-${this.auctionId} .bidly-status-badge`);
    if (statusElement) {
      statusElement.textContent = 'Auction Ended';
      statusElement.className = 'bidly-status-badge bidly-status-ended';
    }
    
    // Hide action buttons
    const actionsElement = document.querySelector(`#bidly-auction-widget-${this.auctionId} .bidly-auction-actions`);
    if (actionsElement) {
      actionsElement.innerHTML = '<div class="bidly-ended-message"><p>Auction has ended. Check back for results!</p></div>';
    }
  }

  setupEventListeners() {
    // Set up form submission handlers
    const bidForm = document.querySelector(`#bidly-bid-form-${this.auctionId}`);
    if (bidForm) {
      bidForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitBid(e);
      });
    }
  }

  async submitBid(event) {
    const form = event.target;
    const formData = new FormData(form);
    const bidData = {
      amount: parseFloat(formData.get('amount')),
      bidderName: formData.get('bidderName'),
      bidderEmail: formData.get('bidderEmail')
    };

    try {
      console.log('💰 Submitting bid:', bidData);
      
      const response = await fetch(`/apps/bidly/api/auctions/${this.auctionId}/bid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bidData)
      });

      const result = await response.json();

      if (result.success) {
        this.showNotification('Bid placed successfully!');
        this.closeBidModal();
        form.reset();
        
        // Update UI immediately
        this.updateBidInfo({
          currentBid: bidData.amount,
          bidCount: parseInt(document.querySelector(`#bidly-auction-widget-${this.auctionId} .bidly-count`).textContent) + 1
        });
      } else {
        this.showNotification(result.message || 'Failed to place bid', 'error');
      }
    } catch (error) {
      console.error('❌ Error placing bid:', error);
      this.showNotification('Error placing bid. Please try again.', 'error');
    }
  }

  async confirmBuyNow(auctionId, buyNowPrice) {
    try {
      const bidderName = document.querySelector(`#bidly-bidder-name-${auctionId}`)?.value || 'Anonymous';
      const bidderEmail = document.querySelector(`#bidly-bidder-email-${auctionId}`)?.value || 'no-email@example.com';
      
      const response = await fetch(`/apps/bidly/api/auctions/${auctionId}/buy-now`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bidderName,
          bidderEmail,
          buyNowPrice
        })
      });

      const result = await response.json();

      if (result.success) {
        this.showNotification('Congratulations! You won the auction!');
        this.closeBuyNowModal();
        this.handleAuctionEnd();
      } else {
        this.showNotification(result.message || 'Failed to buy now', 'error');
      }
    } catch (error) {
      console.error('❌ Error with buy now:', error);
      this.showNotification('Error with buy now. Please try again.', 'error');
    }
  }

  showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `bidly-notification bidly-notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '1rem 1.5rem',
      borderRadius: '6px',
      color: 'white',
      fontWeight: '500',
      zIndex: '10000',
      maxWidth: '300px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      transform: 'translateX(100%)',
      transition: 'transform 0.3s ease'
    });
    
    if (type === 'success') {
      notification.style.backgroundColor = '#28a745';
    } else if (type === 'error') {
      notification.style.backgroundColor = '#dc3545';
    } else {
      notification.style.backgroundColor = '#007bff';
    }
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }

  closeBidModal() {
    const modal = document.querySelector(`#bidly-bid-modal-${this.auctionId}`);
    if (modal) {
      modal.style.display = 'none';
    }
  }

  closeBuyNowModal() {
    const modal = document.querySelector(`#bidly-buy-now-modal-${this.auctionId}`);
    if (modal) {
      modal.style.display = 'none';
    }
  }

  destroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    if (this.socket) {
      this.socket.disconnect();
    }
    this.isInitialized = false;
  }
}

// Global functions for modal interactions
window.openBidModal = function(auctionId) {
  const modal = document.querySelector(`#bidly-bid-modal-${auctionId}`);
  if (modal) {
    modal.style.display = 'flex';
  }
};

window.closeBidModal = function(auctionId) {
  const modal = document.querySelector(`#bidly-bid-modal-${auctionId}`);
  if (modal) {
    modal.style.display = 'none';
  }
};

window.openBuyNowModal = function(auctionId, buyNowPrice) {
  const modal = document.querySelector(`#bidly-buy-now-modal-${auctionId}`);
  if (modal) {
    modal.style.display = 'flex';
  }
};

window.closeBuyNowModal = function(auctionId) {
  const modal = document.querySelector(`#bidly-buy-now-modal-${auctionId}`);
  if (modal) {
    modal.style.display = 'none';
  }
};

window.submitBid = function(event, auctionId) {
  const widget = window.auctionWidgets?.[auctionId];
  if (widget) {
    widget.submitBid(event);
  }
};

window.confirmBuyNow = function(auctionId, buyNowPrice) {
  const widget = window.auctionWidgets?.[auctionId];
  if (widget) {
    widget.confirmBuyNow(auctionId, buyNowPrice);
  }
};

window.openBidHistory = function(auctionId) {
  // Open bid history in a new window or modal
  window.open(`/apps/bidly/api/auctions/${auctionId}/bids`, '_blank');
};

// Initialize auction widget
window.initializeAuctionWidget = function(auctionId, endTime) {
  if (!window.auctionWidgets) {
    window.auctionWidgets = {};
  }
  
  if (!window.auctionWidgets[auctionId]) {
    window.auctionWidgets[auctionId] = new AuctionProductWidget(auctionId, endTime);
  }
};

// Clean up on page unload
window.addEventListener('beforeunload', function() {
  if (window.auctionWidgets) {
    Object.values(window.auctionWidgets).forEach(widget => {
      widget.destroy();
    });
  }
});
