/**
 * Bidly Auction Widget JavaScript
 * Handles auction display, bidding, and real-time updates
 */

(function() {
  'use strict';

  // Global widget object
  window.BidlyAuctionWidget = {
    loaded: false,
    instances: {},
    socket: null,
    customer: null,
    
    // Initialize the widget
    init: function(blockId, shopDomain, appProxyUrl) {
      console.log('🎯 Initializing Bidly Auction Widget:', { blockId, shopDomain, appProxyUrl });
      
      this.instances[blockId] = {
        blockId: blockId,
        shopDomain: shopDomain,
        appProxyUrl: appProxyUrl,
        type: 'list'
      };
      
      this.loadAuctions(blockId);
      this.initializeCustomerAuth(blockId);
      this.initializeSocket();
    },
    
    // Initialize single auction widget
    initSingle: function(blockId, shopDomain, appProxyUrl, auctionId) {
      console.log('🎯 Initializing Single Auction Widget:', { blockId, shopDomain, appProxyUrl, auctionId });
      
      this.instances[blockId] = {
        blockId: blockId,
        shopDomain: shopDomain,
        appProxyUrl: appProxyUrl,
        auctionId: auctionId,
        type: 'single'
      };
      
      this.loadSingleAuction(blockId, auctionId);
      this.initializeCustomerAuth(blockId);
      this.initializeSocket();
    },
    
    // Initialize featured auction widget
    initFeatured: function(blockId, shopDomain, appProxyUrl, auctionId) {
      console.log('🎯 Initializing Featured Auction Widget:', { blockId, shopDomain, appProxyUrl, auctionId });
      
      this.instances[blockId] = {
        blockId: blockId,
        shopDomain: shopDomain,
        appProxyUrl: appProxyUrl,
        auctionId: auctionId,
        type: 'featured'
      };
      
      this.loadSingleAuction(blockId, auctionId);
      this.initializeCustomerAuth(blockId);
      this.initializeSocket();
    },
    
    // Load auctions for list view
    loadAuctions: function(blockId) {
      const instance = this.instances[blockId];
      if (!instance) return;
      
      const loadingEl = document.getElementById(`bidly-loading-${blockId}`);
      const errorEl = document.getElementById(`bidly-error-${blockId}`);
      const containerEl = document.getElementById(`bidly-auctions-${blockId}`);
      const gridEl = document.getElementById(`bidly-grid-${blockId}`);
      
      // Show loading
      if (loadingEl) loadingEl.style.display = 'block';
      if (errorEl) errorEl.style.display = 'none';
      if (containerEl) containerEl.style.display = 'none';
      
      // Fetch auctions via app proxy
      console.log('🔍 Fetching auctions from:', `${instance.appProxyUrl}/api/auctions?shop=${instance.shopDomain}`);
      
      fetch(`${instance.appProxyUrl}/api/auctions?shop=${instance.shopDomain}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
        .then(response => {
          console.log('📡 Response status:', response.status);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        })
        .then(data => {
          console.log('📦 Received data:', data);
          if (data.success && data.data) {
            this.renderAuctions(blockId, data.data);
            if (loadingEl) loadingEl.style.display = 'none';
            if (containerEl) containerEl.style.display = 'block';
          } else {
            throw new Error(data.message || 'Failed to load auctions');
          }
        })
        .catch(error => {
          console.error('❌ Error loading auctions:', error);
          if (loadingEl) loadingEl.style.display = 'none';
          if (errorEl) {
            errorEl.style.display = 'block';
            // Show more detailed error message
            const errorText = errorEl.querySelector('p');
            if (errorText) {
              errorText.textContent = `Error: ${error.message}`;
            }
          }
        });
    },
    
    // Load single auction
    loadSingleAuction: function(blockId, auctionId) {
      const instance = this.instances[blockId];
      if (!instance) return;
      
      const loadingEl = document.getElementById(`bidly-loading-${blockId}`);
      const errorEl = document.getElementById(`bidly-error-${blockId}`);
      const containerEl = document.getElementById(`bidly-auction-detail-${blockId}`) || 
                         document.getElementById(`bidly-featured-container-${blockId}`);
      
      // Show loading
      if (loadingEl) loadingEl.style.display = 'block';
      if (errorEl) errorEl.style.display = 'none';
      if (containerEl) containerEl.style.display = 'none';
      
      // Fetch auction via app proxy
      console.log('🔍 Fetching auction from:', `${instance.appProxyUrl}/api/auctions/${auctionId}?shop=${instance.shopDomain}`);
      
      fetch(`${instance.appProxyUrl}/api/auctions/${auctionId}?shop=${instance.shopDomain}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      })
        .then(response => {
          console.log('📡 Response status:', response.status);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        })
        .then(data => {
          console.log('📦 Received auction data:', data);
          if (data.success && data.data) {
            if (instance.type === 'featured') {
              this.renderFeaturedAuction(blockId, data.data);
            } else {
              this.renderSingleAuction(blockId, data.data);
            }
            if (loadingEl) loadingEl.style.display = 'none';
            if (containerEl) containerEl.style.display = 'block';
          } else {
            throw new Error(data.message || 'Failed to load auction');
          }
        })
        .catch(error => {
          console.error('❌ Error loading auction:', error);
          if (loadingEl) loadingEl.style.display = 'none';
          if (errorEl) {
            errorEl.style.display = 'block';
            const errorText = errorEl.querySelector('p');
            if (errorText) {
              errorText.textContent = `Error: ${error.message}`;
            }
          }
        });
    },
    
    // Render auctions list
    renderAuctions: function(blockId, auctions) {
      const gridEl = document.getElementById(`bidly-grid-${blockId}`);
      if (!gridEl) return;
      
      gridEl.innerHTML = '';
      
      if (!auctions || auctions.length === 0) {
        gridEl.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #666;">
            <h3>No auctions available</h3>
            <p>Check back later for new auctions!</p>
          </div>
        `;
        return;
      }
      
      auctions.forEach(auction => {
        const auctionCard = this.createAuctionCard(auction, blockId);
        gridEl.appendChild(auctionCard);
      });
    },
    
    // Create auction card element
    createAuctionCard: function(auction, blockId) {
      const card = document.createElement('div');
      card.className = 'bidly-auction-card';
      card.dataset.auctionId = auction._id || auction.id;
      
      const status = this.computeAuctionStatus(auction);
      const timeLeft = this.formatTimeLeft(auction.endTime);
      const productImage = auction.productData?.images?.[0]?.src || '/placeholder-image.jpg';
      
      card.innerHTML = `
        <img src="${productImage}" alt="${auction.productData?.title || 'Auction Item'}" class="bidly-auction-image" onerror="this.src='/placeholder-image.jpg'">
        <div class="bidly-auction-content">
          <h3 class="bidly-auction-title">${auction.productData?.title || 'Auction Item'}</h3>
          <div class="bidly-auction-price">$${auction.currentBid || 0}</div>
          <div class="bidly-auction-time">${timeLeft}</div>
          <div class="bidly-auction-status bidly-status-${status}">${status}</div>
          ${this.renderBiddingSection(auction, blockId)}
        </div>
      `;
      
      return card;
    },
    
    // Render single auction detail
    renderSingleAuction: function(blockId, auction) {
      const containerEl = document.getElementById(`bidly-auction-detail-${blockId}`);
      if (!containerEl) return;
      
      const status = this.computeAuctionStatus(auction);
      const timeLeft = this.formatTimeLeft(auction.endTime);
      const productImage = auction.productData?.images?.[0]?.src || '/placeholder-image.jpg';
      
      containerEl.innerHTML = `
        <div class="bidly-auction-image-container">
          <img src="${productImage}" alt="${auction.productData?.title || 'Auction Item'}" class="bidly-auction-image" onerror="this.src='/placeholder-image.jpg'">
        </div>
        <div class="bidly-auction-info">
          <h1 class="bidly-auction-title">${auction.productData?.title || 'Auction Item'}</h1>
          <div class="bidly-auction-price">$${auction.currentBid || 0}</div>
          <div class="bidly-auction-time">${timeLeft}</div>
          <div class="bidly-auction-status bidly-status-${status}">${status}</div>
          ${this.renderBiddingSection(auction, blockId, true)}
          ${this.renderBidHistory(auction)}
        </div>
      `;
    },
    
    // Render featured auction
    renderFeaturedAuction: function(blockId, auction) {
      const containerEl = document.getElementById(`bidly-featured-container-${blockId}`);
      if (!containerEl) return;
      
      const status = this.computeAuctionStatus(auction);
      const timeLeft = this.formatTimeLeft(auction.endTime);
      const productImage = auction.productData?.images?.[0]?.src || '/placeholder-image.jpg';
      
      containerEl.innerHTML = `
        <div class="bidly-featured-content">
          <div class="bidly-featured-image-container">
            <img src="${productImage}" alt="${auction.productData?.title || 'Auction Item'}" class="bidly-featured-image" onerror="this.src='/placeholder-image.jpg'">
          </div>
          <div class="bidly-featured-info">
            <h1 class="bidly-featured-title">${auction.productData?.title || 'Auction Item'}</h1>
            <div class="bidly-featured-price">$${auction.currentBid || 0}</div>
            <div class="bidly-featured-time">${timeLeft}</div>
            <div class="bidly-featured-status">${status}</div>
            ${this.renderFeaturedBidding(auction, blockId)}
          </div>
        </div>
      `;
    },
    
    // Render bidding section
    renderBiddingSection: function(auction, blockId, isDetailed = false) {
      const status = this.computeAuctionStatus(auction);
      const canBid = status === 'active';
      const minBid = (auction.currentBid || 0) + 1;
      
      if (!canBid) {
        return `<div class="bidly-bid-section">
          <button class="bidly-bid-button" disabled>
            ${status === 'pending' ? 'Auction Not Started' : 'Auction Ended'}
          </button>
        </div>`;
      }
      
      return `
        <div class="bidly-bid-section">
          ${this.renderCustomerAuth(blockId)}
          <input type="number" class="bidly-bid-input" placeholder="Min: $${minBid}" min="${minBid}" step="1">
          <button class="bidly-bid-button" onclick="BidlyAuctionWidget.placeBid('${auction._id || auction.id}', '${blockId}')">
            Place Bid
          </button>
          ${auction.buyNowPrice ? `
            <button class="bidly-buy-now-button" onclick="BidlyAuctionWidget.buyNow('${auction._id || auction.id}', '${blockId}')">
              Buy Now - $${auction.buyNowPrice}
            </button>
          ` : ''}
        </div>
      `;
    },
    
    // Render featured bidding section
    renderFeaturedBidding: function(auction, blockId) {
      const status = this.computeAuctionStatus(auction);
      const canBid = status === 'active';
      const minBid = (auction.currentBid || 0) + 1;
      
      if (!canBid) {
        return `<div class="bidly-featured-bidding">
          <button class="bidly-featured-bid-button" disabled>
            ${status === 'pending' ? 'Auction Not Started' : 'Auction Ended'}
          </button>
        </div>`;
      }
      
      return `
        <div class="bidly-featured-bidding">
          <input type="number" class="bidly-featured-bid-input" placeholder="Min: $${minBid}" min="${minBid}" step="1">
          <button class="bidly-featured-bid-button" onclick="BidlyAuctionWidget.placeBid('${auction._id || auction.id}', '${blockId}')">
            Place Bid
          </button>
        </div>
        ${auction.buyNowPrice ? `
          <div class="bidly-featured-buy-now">
            <button class="bidly-featured-buy-now-button" onclick="BidlyAuctionWidget.buyNow('${auction._id || auction.id}', '${blockId}')">
              Buy Now - $${auction.buyNowPrice}
            </button>
          </div>
        ` : ''}
      `;
    },
    
    // Render customer authentication section
    renderCustomerAuth: function(blockId) {
      if (this.customer) {
        return `<div class="bidly-customer-auth">
          <p>Logged in as: <strong>${this.customer.name}</strong></p>
          <button class="bidly-auth-button" onclick="BidlyAuctionWidget.logout()">Logout</button>
        </div>`;
      }
      
      return `<div class="bidly-customer-auth">
        <input type="text" class="bidly-auth-input" placeholder="Your Name" id="bidly-name-${blockId}">
        <input type="email" class="bidly-auth-input" placeholder="Your Email" id="bidly-email-${blockId}">
        <button class="bidly-auth-button" onclick="BidlyAuctionWidget.login('${blockId}')">Login to Bid</button>
      </div>`;
    },
    
    // Render bid history
    renderBidHistory: function(auction) {
      if (!auction.bidHistory || auction.bidHistory.length === 0) {
        return '';
      }
      
      const historyHtml = auction.bidHistory
        .slice(-5) // Show last 5 bids
        .reverse()
        .map(bid => `
          <div class="bidly-bid-item">
            <span class="bidly-bid-amount">$${bid.amount}</span>
            <span class="bidly-bid-time">${this.formatBidTime(bid.timestamp)}</span>
          </div>
        `).join('');
      
      return `
        <div class="bidly-bid-history">
          <h4>Recent Bids</h4>
          ${historyHtml}
        </div>
      `;
    },
    
    // Place bid
    placeBid: function(auctionId, blockId) {
      const instance = this.instances[blockId];
      if (!instance) return;
      
      if (!this.customer) {
        this.showToast('Please login to place a bid', true);
        return;
      }
      
      const bidInput = document.querySelector(`#bidly-auction-list-${blockId} input[type="number"], #bidly-single-auction-${blockId} input[type="number"], #bidly-featured-auction-${blockId} input[type="number"]`);
      const bidAmount = parseFloat(bidInput.value);
      
      if (!bidAmount || bidAmount <= 0) {
        this.showToast('Please enter a valid bid amount', true);
        return;
      }
      
      const button = document.querySelector(`#bidly-auction-list-${blockId} .bidly-bid-button, #bidly-single-auction-${blockId} .bidly-bid-button, #bidly-featured-auction-${blockId} .bidly-featured-bid-button`);
      button.disabled = true;
      button.textContent = 'Placing Bid...';
      
      fetch(`${instance.appProxyUrl}/api/auctions/${auctionId}/bid?shop=${instance.shopDomain}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: bidAmount,
          bidder: this.customer.name,
          customerEmail: this.customer.email
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          this.showToast(data.message);
          bidInput.value = '';
          // Refresh the auction data
          if (instance.type === 'list') {
            this.loadAuctions(blockId);
          } else {
            this.loadSingleAuction(blockId, auctionId);
          }
        } else {
          throw new Error(data.message || 'Failed to place bid');
        }
      })
      .catch(error => {
        console.error('Error placing bid:', error);
        this.showToast(error.message, true);
      })
      .finally(() => {
        button.disabled = false;
        button.textContent = 'Place Bid';
      });
    },
    
    // Buy now
    buyNow: function(auctionId, blockId) {
      const instance = this.instances[blockId];
      if (!instance) return;
      
      if (!this.customer) {
        this.showToast('Please login to buy now', true);
        return;
      }
      
      const button = document.querySelector(`#bidly-auction-list-${blockId} .bidly-buy-now-button, #bidly-single-auction-${blockId} .bidly-buy-now-button, #bidly-featured-auction-${blockId} .bidly-featured-buy-now-button`);
      button.disabled = true;
      button.textContent = 'Processing...';
      
      fetch(`${instance.appProxyUrl}/api/auctions/${auctionId}/buy-now?shop=${instance.shopDomain}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bidder: this.customer.name,
          customerEmail: this.customer.email
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          this.showToast(data.message);
          // Refresh the auction data
          if (instance.type === 'list') {
            this.loadAuctions(blockId);
          } else {
            this.loadSingleAuction(blockId, auctionId);
          }
        } else {
          throw new Error(data.message || 'Failed to buy now');
        }
      })
      .catch(error => {
        console.error('Error buying now:', error);
        this.showToast(error.message, true);
      })
      .finally(() => {
        button.disabled = false;
        button.textContent = 'Buy Now';
      });
    },
    
    // Customer login
    login: function(blockId) {
      const nameInput = document.getElementById(`bidly-name-${blockId}`);
      const emailInput = document.getElementById(`bidly-email-${blockId}`);
      
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      
      if (!name || !email) {
        this.showToast('Please enter both name and email', true);
        return;
      }
      
      this.customer = { name, email };
      this.showToast(`Welcome, ${name}!`);
      
      // Re-render the bidding sections
      Object.keys(this.instances).forEach(id => {
        if (this.instances[id].type === 'list') {
          this.loadAuctions(id);
        } else {
          this.loadSingleAuction(id, this.instances[id].auctionId);
        }
      });
    },
    
    // Customer logout
    logout: function() {
      this.customer = null;
      this.showToast('Logged out successfully');
      
      // Re-render all instances
      Object.keys(this.instances).forEach(id => {
        if (this.instances[id].type === 'list') {
          this.loadAuctions(id);
        } else {
          this.loadSingleAuction(id, this.instances[id].auctionId);
        }
      });
    },
    
    // Initialize customer authentication
    initializeCustomerAuth: function(blockId) {
      // Check for existing customer session
      const savedCustomer = sessionStorage.getItem('bidly-customer');
      if (savedCustomer) {
        this.customer = JSON.parse(savedCustomer);
      }
    },
    
    // Initialize WebSocket connection
    initializeSocket: function() {
      if (this.socket) return;
      
      // Note: WebSocket connection would need to be configured for your backend
      // This is a placeholder for real-time updates
      console.log('🔌 WebSocket connection would be initialized here');
    },
    
    // Utility functions
    computeAuctionStatus: function(auction) {
      const now = new Date();
      const startTime = new Date(auction.startTime);
      const endTime = new Date(auction.endTime);
      
      if (auction.status === 'closed') return 'closed';
      if (now < startTime) return 'pending';
      if (now > endTime) return 'ended';
      return 'active';
    },
    
    formatTimeLeft: function(endTime) {
      const now = new Date();
      const end = new Date(endTime);
      const diff = end - now;
      
      if (diff <= 0) return 'Auction Ended';
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) return `${days}d ${hours}h ${minutes}m left`;
      if (hours > 0) return `${hours}h ${minutes}m left`;
      return `${minutes}m left`;
    },
    
    formatBidTime: function(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleString();
    },
    
    showToast: function(message, isError = false) {
      // Remove existing toast
      const existingToast = document.querySelector('.bidly-toast');
      if (existingToast) {
        existingToast.remove();
      }
      
      // Create new toast
      const toast = document.createElement('div');
      toast.className = `bidly-toast ${isError ? 'error' : ''}`;
      toast.textContent = message;
      
      document.body.appendChild(toast);
      
      // Show toast
      setTimeout(() => toast.classList.add('show'), 100);
      
      // Hide toast after 3 seconds
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  };

})();
