/**
 * Bidly Auction Widget JavaScript
 * Handles auction display, bidding, and real-time updates
 */

(function() {
  'use strict';

  // Global widget object
  window.BidlyAuctionWidget = {
    instances: {},
    socket: null,
    customer: null,
    loadedInstances: new Set(), // Track loaded instances instead of global flag
    
    // Ensure loadedInstances is always available
    ensureLoadedInstances: function() {
      if (!this.loadedInstances) {
        this.loadedInstances = new Set();
      }
    },
    
    // Initialize the widget
    init: function(blockId, shopDomain, appProxyUrl) {
      console.log('🎯 Initializing Bidly Auction Widget:', { blockId, shopDomain, appProxyUrl });
      
      this.ensureLoadedInstances();
      
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
      
      this.ensureLoadedInstances();
      
      // Check if auction ID is provided
      if (!auctionId || auctionId === 'undefined' || auctionId === '') {
        console.error('❌ No auction ID provided for single auction widget');
        this.showError(blockId, 'No auction ID configured. Please set an Auction ID in the block settings.');
        return;
      }
      
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
      
      this.ensureLoadedInstances();
      
      // Check if auction ID is provided
      if (!auctionId || auctionId === 'undefined' || auctionId === '') {
        console.error('❌ No auction ID provided for featured auction widget');
        this.showError(blockId, 'No auction ID configured. Please set an Auction ID in the block settings.');
        return;
      }
      
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
      console.log('🔍 Instance details:', instance);
      
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
          console.log('📡 Response headers:', response.headers);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        })
        .then(data => {
          console.log('📦 Received auction data:', data);
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
      
      // Calculate display values
      const currentBid = auction.currentBid || 0;
      const startingBid = auction.startingBid || 0;
      const displayPrice = currentBid > 0 ? currentBid : startingBid;
      const priceLabel = currentBid > 0 ? 'Current Bid' : 'Starting Bid';
      
      card.innerHTML = `
        <img src="${productImage}" alt="${auction.productData?.title || 'Auction Item'}" class="bidly-auction-image" onerror="this.src='/placeholder-image.jpg'">
        <div class="bidly-auction-content">
          <h3 class="bidly-auction-title">${auction.productData?.title || 'Auction Item'}</h3>
          <div class="bidly-auction-price">
            <div class="bidly-price-label">${priceLabel}</div>
            <div class="bidly-price-amount">$${displayPrice}</div>
            ${currentBid > 0 && startingBid > 0 ? `<div class="bidly-starting-bid">Starting: $${startingBid}</div>` : ''}
          </div>
          <div class="bidly-auction-time">${timeLeft}</div>
          <div class="bidly-auction-status bidly-status-${status}">${status}</div>
          ${this.renderBiddingSection(auction, blockId)}
          <div class="bidly-auction-actions">
            <button class="bidly-view-details-button" onclick="BidlyAuctionWidget.viewAuctionDetails('${auction._id || auction.id}', '${auction.shopifyProductId}')">
              View Details
            </button>
          </div>
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
      
      // Calculate display values
      const currentBid = auction.currentBid || 0;
      const startingBid = auction.startingBid || 0;
      const displayPrice = currentBid > 0 ? currentBid : startingBid;
      const priceLabel = currentBid > 0 ? 'Current Bid' : 'Starting Bid';
      
      containerEl.innerHTML = `
        <div class="bidly-auction-image-container">
          <img src="${productImage}" alt="${auction.productData?.title || 'Auction Item'}" class="bidly-auction-image" onerror="this.src='/placeholder-image.jpg'">
        </div>
        <div class="bidly-auction-info">
          <h1 class="bidly-auction-title">${auction.productData?.title || 'Auction Item'}</h1>
          <div class="bidly-auction-price">
            <div class="bidly-price-label">${priceLabel}</div>
            <div class="bidly-price-amount">$${displayPrice}</div>
            ${currentBid > 0 && startingBid > 0 ? `<div class="bidly-starting-bid">Starting: $${startingBid}</div>` : ''}
          </div>
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
      
      // Calculate display values
      const currentBid = auction.currentBid || 0;
      const startingBid = auction.startingBid || 0;
      const displayPrice = currentBid > 0 ? currentBid : startingBid;
      const priceLabel = currentBid > 0 ? 'Current Bid' : 'Starting Bid';
      
      containerEl.innerHTML = `
        <div class="bidly-featured-content">
          <div class="bidly-featured-image-container">
            <img src="${productImage}" alt="${auction.productData?.title || 'Auction Item'}" class="bidly-featured-image" onerror="this.src='/placeholder-image.jpg'">
          </div>
          <div class="bidly-featured-info">
            <h1 class="bidly-featured-title">${auction.productData?.title || 'Auction Item'}</h1>
            <div class="bidly-featured-price">
              <div class="bidly-price-label">${priceLabel}</div>
              <div class="bidly-price-amount">$${displayPrice}</div>
              ${currentBid > 0 && startingBid > 0 ? `<div class="bidly-starting-bid">Starting: $${startingBid}</div>` : ''}
            </div>
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
      
      // Calculate minimum bid - use startingBid if currentBid is 0 or undefined
      let minBid;
      if (auction.currentBid && auction.currentBid > 0) {
        minBid = auction.currentBid + 1;
      } else if (auction.startingBid && auction.startingBid > 0) {
        minBid = auction.startingBid;
      } else {
        minBid = 1; // Fallback
      }
      
      console.log('💰 Bid calculation:', {
        currentBid: auction.currentBid,
        startingBid: auction.startingBid,
        calculatedMinBid: minBid,
        auction: auction
      });
      
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
      
      // Calculate minimum bid - use startingBid if currentBid is 0 or undefined
      let minBid;
      if (auction.currentBid && auction.currentBid > 0) {
        minBid = auction.currentBid + 1;
      } else if (auction.startingBid && auction.startingBid > 0) {
        minBid = auction.startingBid;
      } else {
        minBid = 1; // Fallback
      }
      
      if (!canBid) {
        return `<div class="bidly-featured-bidding">
          <button class="bidly-featured-bid-button" disabled>
            ${status === 'pending' ? 'Auction Not Started' : 'Auction Ended'}
          </button>
        </div>`;
      }
      
      return `
        <div class="bidly-featured-bidding">
          ${this.renderCustomerAuth(blockId)}
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
      // Check for Shopify customer first
      const shopifyCustomer = this.getShopifyCustomer();
      
      if (shopifyCustomer) {
        this.customer = shopifyCustomer;
        return `<div class="bidly-customer-auth">
          <p>Logged in as: <strong>${shopifyCustomer.name}</strong> (Shopify Customer)</p>
          <button class="bidly-auth-button" onclick="BidlyAuctionWidget.logout()">Logout</button>
        </div>`;
      }
      
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
      
      // Find the specific bid input for this auction
      let bidInput;
      if (instance.type === 'list') {
        bidInput = document.querySelector(`#bidly-grid-${blockId} [data-auction-id="${auctionId}"] .bidly-bid-input`);
      } else if (instance.type === 'single') {
        bidInput = document.querySelector(`#bidly-single-auction-${blockId} .bidly-bid-input`);
      } else if (instance.type === 'featured') {
        bidInput = document.querySelector(`#bidly-featured-auction-${blockId} .bidly-featured-bid-input`);
      }
      
      if (!bidInput) {
        console.error('❌ Bid input not found for auction:', auctionId, 'block:', blockId, 'type:', instance.type);
        console.log('Available elements:', {
          list: document.querySelector(`#bidly-grid-${blockId} [data-auction-id="${auctionId}"] .bidly-bid-input`),
          single: document.querySelector(`#bidly-single-auction-${blockId} .bidly-bid-input`),
          featured: document.querySelector(`#bidly-featured-auction-${blockId} .bidly-featured-bid-input`)
        });
        this.showToast('Bid input not found. Please refresh the page.', true);
        return;
      }
      
      const bidAmount = parseFloat(bidInput.value);
      
      if (!bidAmount || bidAmount <= 0) {
        this.showToast('Please enter a valid bid amount', true);
        return;
      }
      
      // Find the specific button for this auction
      let button;
      if (instance.type === 'list') {
        button = document.querySelector(`#bidly-grid-${blockId} [data-auction-id="${auctionId}"] .bidly-bid-button`);
      } else if (instance.type === 'single') {
        button = document.querySelector(`#bidly-single-auction-${blockId} .bidly-bid-button`);
      } else if (instance.type === 'featured') {
        button = document.querySelector(`#bidly-featured-auction-${blockId} .bidly-featured-bid-button`);
      }
      
      if (!button) {
        console.error('❌ Bid button not found for auction:', auctionId, 'block:', blockId, 'type:', instance.type);
        this.showToast('Bid button not found. Please refresh the page.', true);
        return;
      }
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
      console.log('🔐 Login attempt for block:', blockId);
      
      const nameInput = document.getElementById(`bidly-name-${blockId}`);
      const emailInput = document.getElementById(`bidly-email-${blockId}`);
      
      console.log('Input elements:', { nameInput, emailInput });
      
      if (!nameInput || !emailInput) {
        console.error('❌ Input elements not found');
        this.showToast('Login form not found. Please refresh the page.', true);
        return;
      }
      
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      
      console.log('Input values:', { name, email });
      
      if (!name || !email) {
        console.log('❌ Missing name or email');
        this.showToast('Please enter both name and email', true);
        return;
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        this.showToast('Please enter a valid email address', true);
        return;
      }
      
      this.customer = { name, email };
      sessionStorage.setItem('bidly-customer', JSON.stringify(this.customer));
      
      console.log('✅ Customer logged in:', this.customer);
      this.showToast(`Welcome, ${name}!`);
      
      // Re-render ALL instances to update login status
      Object.keys(this.instances).forEach(id => {
        console.log('🔄 Re-rendering instance:', id, this.instances[id].type);
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
      sessionStorage.removeItem('bidly-customer');
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
      // Check for Shopify customer first
      const shopifyCustomer = this.getShopifyCustomer();
      if (shopifyCustomer) {
        this.customer = shopifyCustomer;
        // Save to session storage for consistency
        sessionStorage.setItem('bidly-customer', JSON.stringify(shopifyCustomer));
        console.log('✅ Shopify customer authenticated:', shopifyCustomer);
        return;
      }
      
      // Check for existing customer session
      const savedCustomer = sessionStorage.getItem('bidly-customer');
      if (savedCustomer) {
        this.customer = JSON.parse(savedCustomer);
        console.log('✅ Existing customer session found:', this.customer);
      }
    },
    
    // Get Shopify customer data if available
    getShopifyCustomer: function() {
      console.log('🔍 Checking for Shopify customer data...');
      
      // Check for Shopify customer object in global scope
      if (window.Shopify && window.Shopify.customer) {
        console.log('✅ Found Shopify customer in window.Shopify.customer:', window.Shopify.customer);
        return {
          name: (window.Shopify.customer.first_name || '') + ' ' + (window.Shopify.customer.last_name || ''),
          email: window.Shopify.customer.email,
          id: window.Shopify.customer.id,
          isShopifyCustomer: true
        };
      }
      
      // Check for customer data in meta tags (common Shopify pattern)
      const customerName = document.querySelector('meta[name="customer-name"]')?.content;
      const customerEmail = document.querySelector('meta[name="customer-email"]')?.content;
      const customerId = document.querySelector('meta[name="customer-id"]')?.content;
      
      if (customerName && customerEmail) {
        console.log('✅ Found customer in meta tags:', { customerName, customerEmail });
        return {
          name: customerName,
          email: customerEmail,
          id: customerId,
          isShopifyCustomer: true
        };
      }
      
      // Check for customer data in window object (some themes use this)
      if (window.customer && window.customer.email) {
        console.log('✅ Found customer in window.customer:', window.customer);
        return {
          name: (window.customer.first_name || '') + ' ' + (window.customer.last_name || ''),
          email: window.customer.email,
          id: window.customer.id,
          isShopifyCustomer: true
        };
      }
      
      // Check for customer data in theme-specific objects
      if (window.theme && window.theme.customer) {
        console.log('✅ Found customer in window.theme.customer:', window.theme.customer);
        return {
          name: (window.theme.customer.first_name || '') + ' ' + (window.theme.customer.last_name || ''),
          email: window.theme.customer.email,
          id: window.theme.customer.id,
          isShopifyCustomer: true
        };
      }
      
      // Check for customer data in liquid variables (if available)
      if (window.customerData) {
        console.log('✅ Found customer in window.customerData:', window.customerData);
        return {
          name: (window.customerData.first_name || '') + ' ' + (window.customerData.last_name || ''),
          email: window.customerData.email,
          id: window.customerData.id,
          isShopifyCustomer: true
        };
      }
      
      // Check for customer data in Shopify.routes (some themes use this)
      if (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) {
        console.log('🔍 Checking Shopify routes for customer data...');
        // This is a common pattern in some themes
      }
      
      // Check for customer data in theme settings or other common locations
      if (window.theme && window.theme.settings && window.theme.settings.customer) {
        console.log('✅ Found customer in window.theme.settings.customer:', window.theme.settings.customer);
        return {
          name: (window.theme.settings.customer.first_name || '') + ' ' + (window.theme.settings.customer.last_name || ''),
          email: window.theme.settings.customer.email,
          id: window.theme.settings.customer.id,
          isShopifyCustomer: true
        };
      }
      
      // Check for customer data in global variables (some themes expose this)
      if (window.customer_email && window.customer_name) {
        console.log('✅ Found customer in global variables:', { customer_email: window.customer_email, customer_name: window.customer_name });
        return {
          name: window.customer_name,
          email: window.customer_email,
          id: window.customer_id || null,
          isShopifyCustomer: true
        };
      }
      
      // Check for customer data in data attributes on body or html
      const bodyCustomerEmail = document.body.getAttribute('data-customer-email');
      const bodyCustomerName = document.body.getAttribute('data-customer-name');
      if (bodyCustomerEmail && bodyCustomerName) {
        console.log('✅ Found customer in body data attributes:', { bodyCustomerEmail, bodyCustomerName });
        return {
          name: bodyCustomerName,
          email: bodyCustomerEmail,
          id: document.body.getAttribute('data-customer-id') || null,
          isShopifyCustomer: true
        };
      }
      
      console.log('❌ No Shopify customer data found');
      console.log('Available objects:', {
        'window.Shopify': !!window.Shopify,
        'window.customer': !!window.customer,
        'window.theme': !!window.theme,
        'window.customerData': !!window.customerData,
        'window.customer_email': !!window.customer_email,
        'window.customer_name': !!window.customer_name,
        'meta tags': {
          customerName: !!customerName,
          customerEmail: !!customerEmail
        },
        'body attributes': {
          customerEmail: !!bodyCustomerEmail,
          customerName: !!bodyCustomerName
        }
      });
      
      return null;
    },
    
    // Show error message
    showError: function(blockId, message) {
      const loadingEl = document.getElementById(`bidly-loading-${blockId}`);
      const errorEl = document.getElementById(`bidly-error-${blockId}`);
      
      if (loadingEl) loadingEl.style.display = 'none';
      if (errorEl) {
        errorEl.style.display = 'block';
        const errorText = errorEl.querySelector('p');
        if (errorText) {
          errorText.textContent = message;
        }
      }
    },
    
    // View auction details in a new page/modal
    viewAuctionDetails: function(auctionId, shopifyProductId) {
      // Create a new page URL for the auction
      const currentUrl = new URL(window.location);
      const auctionUrl = new URL('/auction', currentUrl.origin);
      auctionUrl.searchParams.set('id', auctionId);
      auctionUrl.searchParams.set('product_id', shopifyProductId);
      
      // Open in new tab
      window.open(auctionUrl.toString(), '_blank');
    },
    
    // Initialize WebSocket connection
    initializeSocket: function() {
      if (this.socket) return;
      
      // Note: WebSocket connection would need to be configured for your backend
      // This is a placeholder for real-time updates
      console.log('🔌 WebSocket connection would be initialized here');
    },
    
    // Handle real-time bid updates
    handleBidUpdate: function(data) {
      console.log('📡 Handling bid update:', data);
      
      // Update all instances that might contain this auction
      Object.keys(this.instances).forEach(blockId => {
        const instance = this.instances[blockId];
        
        if (instance.type === 'list') {
          // Update auction in list view
          const auctionCard = document.querySelector(`#bidly-grid-${blockId} [data-auction-id="${data.auctionId}"]`);
          if (auctionCard) {
            this.updateAuctionCardPrice(auctionCard, data);
          }
        } else if (instance.type === 'single' && instance.auctionId === data.auctionId) {
          // Update single auction view
          this.loadSingleAuction(blockId, data.auctionId);
        } else if (instance.type === 'featured' && instance.auctionId === data.auctionId) {
          // Update featured auction view
          this.loadSingleAuction(blockId, data.auctionId);
        }
      });
    },
    
    // Update auction card price display
    updateAuctionCardPrice: function(auctionCard, data) {
      const priceContainer = auctionCard.querySelector('.bidly-auction-price');
      if (!priceContainer) return;
      
      const currentBid = data.currentBid || 0;
      const startingBid = data.startingBid || 0;
      const displayPrice = currentBid > 0 ? currentBid : startingBid;
      const priceLabel = currentBid > 0 ? 'Current Bid' : 'Starting Bid';
      
      priceContainer.innerHTML = `
        <div class="bidly-price-label">${priceLabel}</div>
        <div class="bidly-price-amount">$${displayPrice}</div>
        ${currentBid > 0 && startingBid > 0 ? `<div class="bidly-starting-bid">Starting: $${startingBid}</div>` : ''}
      `;
    },
    
    // Handle auction status updates
    handleAuctionStatusUpdate: function(data) {
      console.log('📡 Handling auction status update:', data);
      
      // Update all instances that might contain this auction
      Object.keys(this.instances).forEach(blockId => {
        const instance = this.instances[blockId];
        
        if (instance.type === 'list') {
          // Update auction in list view
          const auctionCard = document.querySelector(`#bidly-grid-${blockId} [data-auction-id="${data.auctionId}"]`);
          if (auctionCard) {
            const statusElement = auctionCard.querySelector('.bidly-auction-status');
            if (statusElement) {
              statusElement.textContent = data.newStatus;
              statusElement.className = `bidly-auction-status bidly-status-${data.newStatus}`;
            }
          }
        } else if (instance.type === 'single' && instance.auctionId === data.auctionId) {
          // Update single auction view
          this.loadSingleAuction(blockId, data.auctionId);
        } else if (instance.type === 'featured' && instance.auctionId === data.auctionId) {
          // Update featured auction view
          this.loadSingleAuction(blockId, data.auctionId);
        }
      });
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
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s left`;
      if (hours > 0) return `${hours}h ${minutes}m ${seconds}s left`;
      if (minutes > 0) return `${minutes}m ${seconds}s left`;
      return `${seconds}s left`;
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
