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
      
      // Use the global initialization function
      if (window.initBidlyBlock) {
        console.log('🔄 Using global init function for list block');
        window.initBidlyBlock(blockId, shopDomain, appProxyUrl, null, 'list');
        return;
      }
      
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
      
      // Use the global initialization function
      if (window.initBidlyBlock) {
        console.log('🔄 Using global init function for single block');
        window.initBidlyBlock(blockId, shopDomain, appProxyUrl, auctionId, 'single');
        return;
      }
      
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
      
      console.log('✅ Single auction instance created:', blockId);
      console.log('📋 Current instances after init:', Object.keys(this.instances));
      
      this.initializeCustomerAuth(blockId);
      this.initializeSocket();
      
      this.loadSingleAuction(blockId, auctionId);
    },
    
    // Initialize featured auction widget
    initFeatured: function(blockId, shopDomain, appProxyUrl, auctionId) {
      console.log('🎯 Initializing Featured Auction Widget:', { blockId, shopDomain, appProxyUrl, auctionId });
      
      // Use the global initialization function
      if (window.initBidlyBlock) {
        console.log('🔄 Using global init function for featured block');
        window.initBidlyBlock(blockId, shopDomain, appProxyUrl, auctionId, 'featured');
        return;
      }
      
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
      
      console.log('✅ Featured auction instance created:', blockId);
      console.log('📋 Current instances after init:', Object.keys(this.instances));
      
      this.initializeCustomerAuth(blockId);
      this.initializeSocket();
      
      this.loadSingleAuction(blockId, auctionId);
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
          <div class="bidly-auction-time" data-end-time="${auction.endTime}">${timeLeft}</div>
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
          <div class="bidly-auction-time" data-end-time="${auction.endTime}">${timeLeft}</div>
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
            <div class="bidly-featured-time" data-end-time="${auction.endTime}">${timeLeft}</div>
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
    console.log('🎯 placeBid called:', { auctionId, blockId });
    console.log('📋 Available instances:', Object.keys(this.instances));
    console.log('📋 All instances:', this.instances);
    console.log('🔍 Looking for instance with blockId:', blockId);
    console.log('🔍 Instance exists?', !!this.instances[blockId]);
      
      const instance = this.instances[blockId];
      if (!instance) {
        console.error('❌ Instance not found for block:', blockId);
        console.log('🔍 Trying to find instance by partial match...');
        
        // Try to find instance by partial block ID match
        const matchingKey = Object.keys(this.instances).find(key => 
          key.includes(blockId) || blockId.includes(key)
        );
        
        if (matchingKey) {
          console.log('✅ Found matching instance:', matchingKey);
          const foundInstance = this.instances[matchingKey];
          return this.placeBid(auctionId, matchingKey);
        }
        
        return;
      }
      
      console.log('✅ Instance found:', instance);
      
      if (!this.customer) {
        console.log('❌ No customer logged in');
        this.showToast('Please login to place a bid', true);
        return;
      }
      
      console.log('✅ Customer logged in:', this.customer);
      
      // Find the specific bid input for this auction
      let bidInput;
      if (instance.type === 'list') {
        bidInput = document.querySelector(`#bidly-grid-${blockId} [data-auction-id="${auctionId}"] .bidly-bid-input`);
      } else if (instance.type === 'single') {
        // For single auction, use the full block ID
        bidInput = document.querySelector(`#bidly-single-auction-${blockId} .bidly-bid-input`);
      } else if (instance.type === 'featured') {
        // For featured auction, use the full block ID
        bidInput = document.querySelector(`#bidly-featured-auction-${blockId} .bidly-featured-bid-input`);
      }
      
      if (!bidInput) {
        console.error('❌ Bid input not found for auction:', auctionId, 'block:', blockId, 'type:', instance.type);
        console.log('Available elements:', {
          list: document.querySelector(`#bidly-grid-${blockId} [data-auction-id="${auctionId}"] .bidly-bid-input`),
          single: document.querySelector(`#bidly-single-auction-${blockId} .bidly-bid-input`),
          featured: document.querySelector(`#bidly-featured-auction-${blockId} .bidly-featured-bid-input`)
        });
        console.log('All available bid inputs:', document.querySelectorAll('.bidly-bid-input, .bidly-featured-bid-input'));
        console.log('Container elements:', {
          single: document.querySelector(`#bidly-single-auction-${blockId}`),
          featured: document.querySelector(`#bidly-featured-auction-${blockId}`)
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
        // For single auction, use the full block ID
        button = document.querySelector(`#bidly-single-auction-${blockId} .bidly-bid-button`);
      } else if (instance.type === 'featured') {
        // For featured auction, use the full block ID
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
          // Update all instances of this auction across all blocks
          this.updateAuctionInAllBlocks(auctionId, data.auction);
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
    
    // Update auction data in all blocks that display this auction
    updateAuctionInAllBlocks: function(auctionId, updatedAuction) {
      console.log('🔄 Updating auction in all blocks:', auctionId, updatedAuction);
      
      Object.keys(this.instances).forEach(blockId => {
        const instance = this.instances[blockId];
        
        if (instance.type === 'list') {
          // Update auction card in list view
          const auctionCard = document.querySelector(`#bidly-grid-${blockId} [data-auction-id="${auctionId}"]`);
          if (auctionCard && updatedAuction) {
            this.updateAuctionCard(auctionCard, updatedAuction);
          }
        } else if (instance.type === 'single' && instance.auctionId === auctionId) {
          // Update single auction view
          this.loadSingleAuction(blockId, auctionId);
        } else if (instance.type === 'featured' && instance.auctionId === auctionId) {
          // Update featured auction view
          this.loadSingleAuction(blockId, auctionId);
        }
      });
    },
    
    // Update individual auction card with new data
    updateAuctionCard: function(auctionCard, auction) {
      console.log('🔄 Updating auction card:', auctionCard, auction);
      
      // Update current bid
      const priceElement = auctionCard.querySelector('.bidly-price-amount');
      if (priceElement) {
        const currentBid = auction.currentBid || 0;
        const startingBid = auction.startingBid || 0;
        const displayPrice = currentBid > 0 ? currentBid : startingBid;
        priceElement.textContent = `$${displayPrice}`;
        console.log('✅ Updated price element:', displayPrice);
      }
      
      // Update price label
      const labelElement = auctionCard.querySelector('.bidly-price-label');
      if (labelElement) {
        const currentBid = auction.currentBid || 0;
        labelElement.textContent = currentBid > 0 ? 'Current Bid' : 'Starting Bid';
        console.log('✅ Updated label element:', labelElement.textContent);
      }
      
      // Update starting bid info
      const startingBidElement = auctionCard.querySelector('.bidly-starting-bid');
      if (startingBidElement && auction.currentBid > 0 && auction.startingBid > 0) {
        startingBidElement.textContent = `Starting: $${auction.startingBid}`;
        startingBidElement.style.display = 'block';
        console.log('✅ Updated starting bid element');
      }
      
      // Update minimum bid
      const minBidElement = auctionCard.querySelector('.bidly-min-bid');
      if (minBidElement) {
        const minBid = (auction.currentBid || 0) + 1;
        minBidElement.textContent = `Min: $${minBid}`;
        console.log('✅ Updated min bid element:', minBid);
      }
      
      // Update bidder info
      const bidderElement = auctionCard.querySelector('.bidly-current-bidder');
      if (bidderElement && auction.currentBidder) {
        bidderElement.textContent = `Current: ${auction.currentBidder}`;
        console.log('✅ Updated bidder element');
      }
      
      // Update bid input placeholder
      const bidInput = auctionCard.querySelector('.bidly-bid-input');
      if (bidInput) {
        const minBid = (auction.currentBid || 0) + 1;
        bidInput.placeholder = `Min: $${minBid}`;
        console.log('✅ Updated bid input placeholder');
      }
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
      
      // Simple solution: refresh the page to update all blocks
      console.log('🔄 Refreshing page to update all blocks...');
      window.location.reload();
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
      // Only initialize once globally
      if (this.customerInitialized) {
        return;
      }
      
      console.log('🔍 Initializing customer authentication...');
      
      // Check for Shopify customer first
      const shopifyCustomer = this.getShopifyCustomer();
      if (shopifyCustomer) {
        this.customer = shopifyCustomer;
        // Save to session storage for consistency
        sessionStorage.setItem('bidly-customer', JSON.stringify(shopifyCustomer));
        console.log('✅ Shopify customer authenticated:', shopifyCustomer);
        this.customerInitialized = true;
        return;
      }
      
      // Check for existing customer session
      const savedCustomer = sessionStorage.getItem('bidly-customer');
      if (savedCustomer) {
        try {
          this.customer = JSON.parse(savedCustomer);
          console.log('✅ Existing customer session found:', this.customer);
          this.customerInitialized = true;
        } catch (e) {
          console.error('❌ Failed to parse saved customer:', e);
          sessionStorage.removeItem('bidly-customer');
        }
      }
      
      this.customerInitialized = true;
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
      
      // Check for customer data in hidden div with data-serialized-id="customer-data"
      const customerDataDiv = document.querySelector('[data-serialized-id="customer-data"]');
      if (customerDataDiv && customerDataDiv.textContent) {
        try {
          const customerData = JSON.parse(customerDataDiv.textContent);
          console.log('✅ Found customer in serialized data div:', customerData);
          if (customerData.email) {
            return {
              name: customerData.firstName ? `${customerData.firstName} ${customerData.lastName || ''}`.trim() : 'Customer',
              email: customerData.email,
              id: customerData.id,
              isShopifyCustomer: true
            };
          }
        } catch (e) {
          console.log('❌ Failed to parse customer data from serialized div:', e);
        }
      }
      
      // If no customer found immediately, try multiple times with increasing delays
      // This helps with pages that load customer data asynchronously
      if (!this.customerRetryAttempted) {
        this.customerRetryAttempted = true;
        
        // Try multiple times with increasing delays
        const retryDelays = [500, 1000, 2000, 3000]; // 0.5s, 1s, 2s, 3s
        
        retryDelays.forEach((delay, index) => {
          setTimeout(() => {
            console.log(`🔄 Retrying customer detection (attempt ${index + 1}) after ${delay}ms...`);
            const retryCustomer = this.getShopifyCustomer();
            if (retryCustomer && !this.customer) {
              this.customer = retryCustomer;
              sessionStorage.setItem('bidly-customer', JSON.stringify(retryCustomer));
              console.log('✅ Customer detected on retry:', retryCustomer);
              // Refresh page to update all blocks
              window.location.reload();
            }
          }, delay);
        });
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
      
      // Start timer updates for all instances
      this.startTimerUpdates();
    },
    
    // Start timer updates for all auction instances
    startTimerUpdates: function() {
      // Update timers every second
      setInterval(() => {
        Object.keys(this.instances).forEach(blockId => {
          const instance = this.instances[blockId];
          
          if (instance.type === 'list') {
            // Update all auction cards in list view
            const auctionCards = document.querySelectorAll(`#bidly-grid-${blockId} [data-auction-id]`);
            auctionCards.forEach(card => {
              const auctionId = card.dataset.auctionId;
              const timeElement = card.querySelector('.bidly-auction-time');
              if (timeElement && timeElement.dataset.endTime) {
                const newTime = this.formatTimeLeft(timeElement.dataset.endTime);
                timeElement.textContent = newTime;
              }
            });
          } else if (instance.type === 'single') {
            // Update single auction timer
            const timeElement = document.querySelector(`#bidly-single-auction-${blockId} .bidly-auction-time`);
            if (timeElement && timeElement.dataset.endTime) {
              const newTime = this.formatTimeLeft(timeElement.dataset.endTime);
              timeElement.textContent = newTime;
            }
          } else if (instance.type === 'featured') {
            // Update featured auction timer
            const timeElement = document.querySelector(`#bidly-featured-auction-${blockId} .bidly-featured-time`);
            if (timeElement && timeElement.dataset.endTime) {
              const newTime = this.formatTimeLeft(timeElement.dataset.endTime);
              timeElement.textContent = newTime;
            }
          }
        });
      }, 1000); // Update every second
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

  // Global initialization function that can be called from Liquid blocks
  window.initBidlyBlock = function(blockId, shopDomain, appProxyUrl, auctionId, type) {
    console.log('🌍 Global Block Initialization CALLED:', { blockId, shopDomain, appProxyUrl, auctionId, type });
    
    if (!window.BidlyAuctionWidget) {
      console.error('❌ BidlyAuctionWidget not loaded yet');
      return;
    }
    
    window.BidlyAuctionWidget.ensureLoadedInstances();
    
    if (type === 'list') {
      window.BidlyAuctionWidget.instances[blockId] = {
        blockId: blockId,
        shopDomain: shopDomain,
        appProxyUrl: appProxyUrl,
        type: 'list'
      };
      window.BidlyAuctionWidget.initializeCustomerAuth(blockId);
      window.BidlyAuctionWidget.initializeSocket();
      window.BidlyAuctionWidget.loadAuctions(blockId);
    } else if (type === 'single') {
      if (!auctionId || auctionId === 'undefined' || auctionId === '') {
        console.error('❌ No auction ID provided for single auction widget');
        window.BidlyAuctionWidget.showError(blockId, 'No auction ID configured. Please set an Auction ID in the block settings.');
        return;
      }
      
      window.BidlyAuctionWidget.instances[blockId] = {
        blockId: blockId,
        shopDomain: shopDomain,
        appProxyUrl: appProxyUrl,
        auctionId: auctionId,
        type: 'single'
      };
      
      console.log('✅ Single auction instance created:', blockId);
      window.BidlyAuctionWidget.initializeCustomerAuth(blockId);
      window.BidlyAuctionWidget.initializeSocket();
      window.BidlyAuctionWidget.loadSingleAuction(blockId, auctionId);
    } else if (type === 'featured') {
      if (!auctionId || auctionId === 'undefined' || auctionId === '') {
        console.error('❌ No auction ID provided for featured auction widget');
        window.BidlyAuctionWidget.showError(blockId, 'No auction ID configured. Please set an Auction ID in the block settings.');
        return;
      }
      
      window.BidlyAuctionWidget.instances[blockId] = {
        blockId: blockId,
        shopDomain: shopDomain,
        appProxyUrl: appProxyUrl,
        auctionId: auctionId,
        type: 'featured'
      };
      
      console.log('✅ Featured auction instance created:', blockId);
      window.BidlyAuctionWidget.initializeCustomerAuth(blockId);
      window.BidlyAuctionWidget.initializeSocket();
      window.BidlyAuctionWidget.loadSingleAuction(blockId, auctionId);
    }
    
    console.log('📋 All instances after global init:', Object.keys(window.BidlyAuctionWidget.instances));
    
    // Add a check to see if the instance is still there after a delay
    setTimeout(() => {
      console.log('🔍 Checking instances after 1 second:', Object.keys(window.BidlyAuctionWidget.instances));
      if (window.BidlyAuctionWidget.instances[blockId]) {
        console.log('✅ Instance still exists:', blockId);
      } else {
        console.error('❌ Instance disappeared:', blockId);
      }
    }, 1000);
  };

})();
