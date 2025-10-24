/**
 * Bidly Auction Widget JavaScript
 * Handles auction display, bidding, and real-time updates
 */

(function() {
  'use strict';
  
  console.log('🚀 Bidly Widget v2000 - Loading with all fixes!');

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
        <img src="${productImage}" alt="${auction.productData?.title || 'Auction Item'}" class="bidly-auction-image" onclick="BidlyAuctionWidget.viewAuctionDetails('${auction._id || auction.id}', '${auction.shopifyProductId}')" onerror="this.src='/placeholder-image.jpg'">
        <div class="bidly-auction-content">
          <h3 class="bidly-auction-title" onclick="BidlyAuctionWidget.viewAuctionDetails('${auction._id || auction.id}', '${auction.shopifyProductId}')">${auction.productData?.title || 'Auction Item'}</h3>
          <div class="bidly-auction-price">
            <div class="bidly-price-label">${priceLabel}</div>
            <div class="bidly-price-amount">$${displayPrice}</div>
            ${currentBid > 0 && startingBid > 0 ? `<div class="bidly-starting-bid">Starting: $${startingBid}</div>` : ''}
          </div>
          <div class="bidly-auction-time" data-end-time="${auction.endTime}">${timeLeft}</div>
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
      
      // Calculate display values
      const currentBid = auction.currentBid || 0;
      const startingBid = auction.startingBid || 0;
      const displayPrice = currentBid > 0 ? currentBid : startingBid;
      const priceLabel = currentBid > 0 ? 'Current Bid' : 'Starting Bid';
      
      containerEl.innerHTML = `
        <div class="bidly-auction-image-container">
          <img src="${productImage}" alt="${auction.productData?.title || 'Auction Item'}" class="bidly-auction-image" onclick="BidlyAuctionWidget.viewAuctionDetails('${auction._id || auction.id}', '${auction.shopifyProductId}')" onerror="this.src='/placeholder-image.jpg'">
        </div>
        <div class="bidly-auction-info">
          <h1 class="bidly-auction-title" onclick="BidlyAuctionWidget.viewAuctionDetails('${auction._id || auction.id}', '${auction.shopifyProductId}')">${auction.productData?.title || 'Auction Item'}</h1>
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
            <img src="${productImage}" alt="${auction.productData?.title || 'Auction Item'}" class="bidly-featured-image" onclick="BidlyAuctionWidget.viewAuctionDetails('${auction._id || auction.id}', '${auction.shopifyProductId}')" onerror="this.src='/placeholder-image.jpg'">
          </div>
          <div class="bidly-featured-info">
            <h1 class="bidly-featured-title" onclick="BidlyAuctionWidget.viewAuctionDetails('${auction._id || auction.id}', '${auction.shopifyProductId}')">${auction.productData?.title || 'Auction Item'}</h1>
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
    
    // Render bidding section for dedicated page
    renderPageBiddingSection: function(auction, minBid) {
      const status = this.computeAuctionStatus(auction);
      const canBid = status === 'active';
      
      if (!canBid) {
        return `<div class="bidly-bid-section">
          <button class="bidly-bid-button" disabled>
            ${status === 'pending' ? 'Auction Not Started' : 'Auction Ended'}
          </button>
        </div>`;
      }
      
      return `
        <div class="bidly-bid-section">
          ${this.renderPageCustomerAuth()}
          <input type="number" class="bidly-bid-input" placeholder="Min: $${minBid}" min="${minBid}" step="1" id="page-bid-input">
          <button class="bidly-bid-button" onclick="BidlyAuctionWidget.placePageBid('${auction._id || auction.id}')">
            Place Bid
          </button>
          ${auction.buyNowPrice ? `
            <button class="bidly-buy-now-button" onclick="BidlyAuctionWidget.buyPageNow('${auction._id || auction.id}')">
              Buy Now - $${auction.buyNowPrice}
            </button>
          ` : ''}
        </div>
      `;
    },
    
    // Render customer authentication for page
    renderPageCustomerAuth: function() {
      // Check for Shopify customer first
      const shopifyCustomer = this.getShopifyCustomer();
      
      if (shopifyCustomer) {
        this.customer = shopifyCustomer;
        return `<div class="bidly-customer-auth" onclick="event.stopPropagation()">
          <p>Logged in as: <strong>${shopifyCustomer.name}</strong> (Shopify Customer)</p>
          <button class="bidly-auth-button" onclick="event.stopPropagation(); BidlyAuctionWidget.logout()">Logout</button>
        </div>`;
      }
      
      if (this.customer) {
        return `<div class="bidly-customer-auth" onclick="event.stopPropagation()">
          <p>Logged in as: <strong>${this.customer.name}</strong></p>
          <button class="bidly-auth-button" onclick="event.stopPropagation(); BidlyAuctionWidget.logout()">Logout</button>
        </div>`;
      }
      
      return `<div class="bidly-customer-auth" onclick="event.stopPropagation()">
        <input type="text" class="bidly-auth-input" placeholder="Your Name" id="page-customer-name">
        <input type="email" class="bidly-auth-input" placeholder="Your Email" id="page-customer-email">
        <button class="bidly-auth-button" onclick="BidlyAuctionWidget.loginPage()">Login to Bid</button>
      </div>`;
    },
    
    // Place bid from page
    placePageBid: function(auctionId) {
      console.log('🎯 placePageBid called:', auctionId);
      
      if (!this.customer) {
        console.log('❌ No customer logged in');
        this.showToast('Please login to place a bid', true);
        return;
      }
      
      const bidInput = document.getElementById('page-bid-input');
      if (!bidInput) {
        console.error('❌ Bid input not found');
        this.showToast('Bid input not found. Please refresh the page.', true);
        return;
      }
      
      const bidAmount = parseFloat(bidInput.value);
      if (!bidAmount || bidAmount <= 0) {
        this.showToast('Please enter a valid bid amount', true);
        return;
      }
      
      const button = document.querySelector('.bidly-bid-button');
      if (!button) {
        console.error('❌ Bid button not found');
        this.showToast('Bid button not found. Please refresh the page.', true);
        return;
      }
      
      button.disabled = true;
      button.textContent = 'Placing Bid...';
      
      // Get shop domain from current URL
      const shopDomain = window.location.hostname;
      
      fetch(`/apps/bidly/api/auctions/${auctionId}/bid?shop=${shopDomain}`, {
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
          // Reload the page to show updated auction data
          window.location.reload();
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
    
    // Buy now from page
    buyPageNow: function(auctionId) {
      console.log('🎯 buyPageNow called:', auctionId);
      
      if (!this.customer) {
        this.showToast('Please login to buy now', true);
        return;
      }
      
      const button = document.querySelector('.bidly-buy-now-button');
      if (!button) {
        console.error('❌ Buy now button not found');
        this.showToast('Buy now button not found. Please refresh the page.', true);
        return;
      }
      
      button.disabled = true;
      button.textContent = 'Processing...';
      
      // Get shop domain from current URL
      const shopDomain = window.location.hostname;
      
      fetch(`/apps/bidly/api/auctions/${auctionId}/buy-now?shop=${shopDomain}`, {
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
          // Reload the page to show updated auction data
          window.location.reload();
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
    
    // Login from page
    loginPage: function() {
      console.log('🔐 Login attempt from page');
      
      const nameInput = document.getElementById('bidly-page-name');
      const emailInput = document.getElementById('bidly-page-email');
      
      console.log('🔍 Found elements:', {
        nameInput: !!nameInput,
        emailInput: !!emailInput,
        nameValue: nameInput?.value,
        emailValue: emailInput?.value,
        nameInputId: nameInput?.id,
        emailInputId: emailInput?.id,
        allInputs: document.querySelectorAll('input').length,
        allBidlyInputs: document.querySelectorAll('[id*="bidly-page"]').length
      });
      
      if (!nameInput || !emailInput) {
        console.error('❌ Input elements not found');
        console.log('🔍 Available elements with bidly-page:', document.querySelectorAll('[id*="bidly-page"]'));
        this.showToast('Login form not found. Please refresh the page.', true);
        return;
      }
      
      let name = nameInput.value.trim();
      let email = emailInput.value.trim();
      
      // Fallback: try to get values from any input fields if the specific ones are empty
      if (!name || !email) {
        console.log('🔍 Trying fallback - checking all inputs on page');
        const allInputs = document.querySelectorAll('input[type="text"], input[type="email"]');
        console.log('🔍 All inputs found:', allInputs.length);
        
        allInputs.forEach((input, index) => {
          console.log(`🔍 Input ${index}:`, {
            id: input.id,
            type: input.type,
            value: input.value,
            placeholder: input.placeholder
          });
        });
        
        // Try to find inputs that actually have values
        const nameInputsWithValue = document.querySelectorAll('input[placeholder*="name" i]');
        const emailInputsWithValue = document.querySelectorAll('input[placeholder*="email" i]');
        
        // Find the input with a non-empty value
        for (let input of nameInputsWithValue) {
          if (input.value.trim()) {
            name = input.value.trim();
            console.log('🔍 Found name with value:', name);
            break;
          }
        }
        
        for (let input of emailInputsWithValue) {
          if (input.value.trim()) {
            email = input.value.trim();
            console.log('🔍 Found email with value:', email);
            break;
          }
        }
      }
      
      if (!name || !email) {
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
      this.customerInitialized = true;
      
      console.log('✅ Customer logged in:', this.customer);
      this.showToast(`Welcome, ${name}!`);
      
      // Refresh the page to update the UI properly
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    
    // Update page bidding section after login
    updatePageBiddingSection: function() {
      console.log('🔄 Updating page bidding section...');
      
      // Find the auction data from the page
      const auctionData = window.currentAuctionData;
      if (!auctionData) {
        console.error('❌ No auction data found on page');
        return;
      }
      
      // Find the bidding section container
      const biddingSection = document.querySelector('.bidly-bid-section');
      if (!biddingSection) {
        console.error('❌ Bidding section not found');
        return;
      }
      
      // Calculate minimum bid
      let minBid;
      if (auctionData.currentBid && auctionData.currentBid > 0) {
        minBid = auctionData.currentBid + 1;
      } else if (auctionData.startingBid && auctionData.startingBid > 0) {
        minBid = auctionData.startingBid;
      } else {
        minBid = 1;
      }
      
      // Update the bidding section
      biddingSection.innerHTML = this.renderPageBiddingSection(auctionData, minBid);
      
      console.log('✅ Page bidding section updated');
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
        <div class="bidly-bid-section" onclick="event.stopPropagation()">
          ${this.renderCustomerAuth(blockId)}
          <input type="number" class="bidly-bid-input" placeholder="Min: $${minBid}" min="${minBid}" step="1" onclick="event.stopPropagation()">
          <button class="bidly-bid-button" onclick="event.stopPropagation(); BidlyAuctionWidget.placeBid('${auction._id || auction.id}', '${blockId}')">
            Place Bid
          </button>
          ${auction.buyNowPrice ? `
            <button class="bidly-buy-now-button" onclick="event.stopPropagation(); BidlyAuctionWidget.buyNow('${auction._id || auction.id}', '${blockId}')">
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
        return `<div class="bidly-customer-auth" onclick="event.stopPropagation()">
          <p>Logged in as: <strong>${shopifyCustomer.name}</strong> (Shopify Customer)</p>
          <button class="bidly-auth-button" onclick="event.stopPropagation(); BidlyAuctionWidget.logout()">Logout</button>
        </div>`;
      }
      
      if (this.customer) {
        return `<div class="bidly-customer-auth" onclick="event.stopPropagation()">
          <p>Logged in as: <strong>${this.customer.name}</strong></p>
          <button class="bidly-auth-button" onclick="event.stopPropagation(); BidlyAuctionWidget.logout()">Logout</button>
        </div>`;
      }
      
      return `<div class="bidly-customer-auth" onclick="event.stopPropagation()">
        <input type="text" class="bidly-auth-input" placeholder="Your Name" id="bidly-name-${blockId}" onclick="event.stopPropagation()">
        <input type="email" class="bidly-auth-input" placeholder="Your Email" id="bidly-email-${blockId}" onclick="event.stopPropagation()">
        <button class="bidly-auth-button" onclick="event.stopPropagation(); BidlyAuctionWidget.login('${blockId}')">Login to Bid</button>
      </div>`;
    },
    
    // Render bid history
    renderBidHistory: function(auction) {
      if (!auction.bidHistory || auction.bidHistory.length === 0) {
        console.log('📋 No bid history found');
        return '';
      }
      
      console.log('📋 Rendering bid history:', auction.bidHistory);
      
      const historyHtml = auction.bidHistory
        .slice(-5) // Show last 5 bids
        .reverse()
        .map(bid => {
          console.log('📋 Processing bid:', bid);
          return `
            <div class="bidly-bid-item">
              <span class="bidly-bid-amount">$${bid.amount}</span>
              <span class="bidly-bid-bidder">${bid.bidder || 'Unknown'}</span>
              <span class="bidly-bid-time">${this.formatBidTime(bid.timestamp)}</span>
            </div>
          `;
        }).join('');
      
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
      
      // Refresh the page to update the UI properly
      setTimeout(() => {
        window.location.reload();
      }, 1000);
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
          return;
        } catch (e) {
          console.error('❌ Failed to parse saved customer:', e);
          sessionStorage.removeItem('bidly-customer');
        }
      }
      
      // No customer found, but mark as initialized so login can work
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
            
            // Try additional detection methods on retry
            const additionalCustomer = this.detectCustomerFromAdditionalSources();
            if (additionalCustomer) {
              this.customer = additionalCustomer;
              sessionStorage.setItem('bidly-customer', JSON.stringify(additionalCustomer));
              console.log('✅ Customer detected from additional sources:', additionalCustomer);
              // Refresh page to update all blocks
              window.location.reload();
              return;
            }
            
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
    
    // Additional customer detection methods
    detectCustomerFromAdditionalSources: function() {
      console.log('🔍 Checking additional customer sources...');
      
      // Check for customer data in script tags with JSON
      const scriptTags = document.querySelectorAll('script[type="application/json"]');
      for (const script of scriptTags) {
        try {
          const data = JSON.parse(script.textContent);
          if (data.customer && data.customer.email) {
            console.log('✅ Found customer in script tag:', data.customer);
            return {
              name: data.customer.first_name || data.customer.name || 'Customer',
              email: data.customer.email,
              id: data.customer.id,
              isShopifyCustomer: true
            };
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      // Check for customer data in localStorage
      const customerData = localStorage.getItem('customer');
      if (customerData) {
        try {
          const customer = JSON.parse(customerData);
          if (customer.email) {
            console.log('✅ Found customer in localStorage:', customer);
            return {
              name: customer.first_name || customer.name || 'Customer',
              email: customer.email,
              id: customer.id,
              isShopifyCustomer: true
            };
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      // Check for customer data in sessionStorage
      const sessionCustomerData = sessionStorage.getItem('customer');
      if (sessionCustomerData) {
        try {
          const customer = JSON.parse(sessionCustomerData);
          if (customer.email) {
            console.log('✅ Found customer in sessionStorage:', customer);
            return {
              name: customer.first_name || customer.name || 'Customer',
              email: customer.email,
              id: customer.id,
              isShopifyCustomer: true
            };
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      // Check for customer data in cookies
      const cookies = document.cookie.split(';');
      let customerEmail = null;
      let customerName = null;
      
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'customer_email') {
          customerEmail = decodeURIComponent(value);
        } else if (name === 'customer_name') {
          customerName = decodeURIComponent(value);
        }
      }
      
      if (customerEmail && customerName) {
        console.log('✅ Found customer in cookies:', { customerEmail, customerName });
        return {
          name: customerName,
          email: customerEmail,
          id: null,
          isShopifyCustomer: true
        };
      }
      
      return null;
    },
    
    // Show error message
    showError: function(blockId, message) {
      // If blockId is a string like 'Auction not found', treat it as a message for page
      if (typeof blockId === 'string' && !blockId.includes('bidly-')) {
        const containerEl = document.getElementById('bidly-auction-detail-page');
        if (containerEl) {
          containerEl.innerHTML = `
            <div class="bidly-error">
              <h3>Error</h3>
              <p>${blockId}</p>
            </div>
          `;
        }
        return;
      }
      
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
      console.log('🔗 viewAuctionDetails called with:', { auctionId, shopifyProductId });
      
      // Create a new page URL for the auction using the backend route
      const currentUrl = new URL(window.location);
      const shopDomain = currentUrl.hostname;
      const auctionUrl = new URL(`/apps/bidly/api/auctions/page/${auctionId}`, currentUrl.origin);
      auctionUrl.searchParams.set('shop', shopDomain);
      
      console.log('🔗 Opening URL:', auctionUrl.toString());
      
      // Open in new tab
      window.open(auctionUrl.toString(), '_blank');
    },
    
    // Load single auction for dedicated page
    loadSingleAuctionPage: function(auctionId, productId, shopDomain) {
      const containerEl = document.getElementById('bidly-auction-detail-page');
      if (!containerEl) return;
      
      console.log('🔍 Loading single auction page:', { auctionId, productId, shopDomain });
      
      // Show loading
      containerEl.innerHTML = `
        <div class="bidly-loading">
          <div class="bidly-spinner"></div>
          <p>Loading auction details...</p>
        </div>
      `;
      
      // Fetch auction data
      fetch(`/apps/bidly/api/auctions/${auctionId}?shop=${shopDomain}`)
        .then(response => response.json())
        .then(data => {
          console.log('📦 Auction data received:', data);
          if (data.success && data.data) {
            this.renderSingleAuctionPage(data.data, containerEl);
          } else {
            this.showError('Auction not found', containerEl);
          }
        })
        .catch(error => {
          console.error('Error loading auction:', error);
          this.showError('Error loading auction', containerEl);
        });
    },
    
    // Render single auction for dedicated page
    renderSingleAuctionPage: function(auction, containerEl) {
      console.log('🎨 Rendering single auction page:', auction);
      
      const status = this.computeAuctionStatus(auction);
      const timeLeft = this.formatTimeLeft(auction.endTime);
      const productImage = auction.productData?.images?.[0]?.src || '/placeholder-image.jpg';
      
      const currentBid = auction.currentBid || 0;
      const startingBid = auction.startingBid || 0;
      const displayPrice = currentBid > 0 ? currentBid : startingBid;
      const priceLabel = currentBid > 0 ? 'Current Bid' : 'Starting Bid';
      
      // Calculate minimum bid
      const minBid = currentBid > 0 ? currentBid + 1 : startingBid;
      
      containerEl.innerHTML = `
        <div class="auction-details-full">
          <div class="auction-details-image">
            <img src="${productImage}" alt="${auction.productData?.title || 'Auction Item'}" class="auction-main-image">
          </div>
          <div class="auction-details-info">
            <h1 class="auction-title">${auction.productData?.title || 'Auction Item'}</h1>
            ${auction.productData?.description ? `
              <div class="product-description">
                <h3>Product Description</h3>
                <p>${auction.productData.description}</p>
              </div>
            ` : ''}
            <div class="auction-price-section">
              <div class="auction-price">
                <span class="price-label">${priceLabel}</span>
                <span class="price-amount">$${displayPrice}</span>
                ${currentBid > 0 && startingBid > 0 ? `<span class="starting-price">Starting: $${startingBid}</span>` : ''}
              </div>
            </div>
            <div class="auction-timer" data-end-time="${auction.endTime}">${timeLeft}</div>
            <div class="auction-status status-${status}">${status}</div>
            <div class="auction-bidding-section">
              ${this.renderPageBiddingSection(auction, minBid)}
            </div>
            <div class="auction-bid-history">
              ${this.renderBidHistory(auction)}
            </div>
          </div>
        </div>
      `;
      
      // Initialize customer auth and socket for this page
      this.initializeCustomerAuth();
      this.initializeSocket();
      
      // Start timer updates
      this.startTimerUpdates();
    },
    
    // Initialize WebSocket connection
    initializeSocket: function() {
      if (this.socket) return;
      
      console.log('🔌 Initializing WebSocket connection...');
      
      // Try to connect to WebSocket
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/socket.io/`;
        
        // For now, use polling as WebSocket might not be available
        console.log('🔄 Using polling for real-time updates (WebSocket not available)');
        this.startPollingUpdates();
      } catch (error) {
        console.log('❌ WebSocket connection failed, using polling:', error);
        this.startPollingUpdates();
      }
      
      // Start timer updates for all instances
      this.startTimerUpdates();
    },
    
    // Start polling for updates every 10 seconds
    startPollingUpdates: function() {
      if (this.pollingInterval) return;
      
      console.log('🔄 Starting polling updates every 3 seconds...');
      this.pollingInterval = setInterval(() => {
        this.pollForUpdates();
      }, 3000);
    },
    
    // Poll for auction updates (smooth updates without reloading)
    pollForUpdates: function() {
      console.log('🔄 Polling for updates...');
      Object.keys(this.instances).forEach(blockId => {
        const instance = this.instances[blockId];
        console.log('🔄 Updating block:', blockId, 'type:', instance.type);
        
        if (instance.type === 'list') {
          // Smoothly update auction list without reloading
          this.updateAuctionListSmoothly(blockId);
        } else if (instance.type === 'single' || instance.type === 'featured') {
          // Smoothly update single auction without reloading
          this.updateSingleAuctionSmoothly(blockId, instance.auctionId);
        }
      });
    },
    
    // Smoothly update auction list without reloading the entire content
    updateAuctionListSmoothly: function(blockId) {
      const instance = this.instances[blockId];
      if (!instance) {
        console.log('❌ No instance found for block:', blockId);
        return;
      }
      
      console.log('🔄 Fetching auction list for block:', blockId);
      // Fetch updated auction data
      fetch(`${instance.appProxyUrl}/api/auctions?shop=${instance.shopDomain}`)
        .then(response => response.json())
        .then(data => {
          console.log('📊 Auction list data received:', data);
          if (data.success && data.data) {
            console.log('✅ Updating', data.data.length, 'auctions');
            // Update each auction card individually without reloading
            data.data.forEach(auction => {
              this.updateAuctionCardSmoothly(blockId, auction);
            });
          } else {
            console.log('❌ No auctions data or success false');
          }
        })
        .catch(error => {
          console.log('❌ Error updating auction list:', error);
        });
    },
    
    // Smoothly update single auction without reloading
    updateSingleAuctionSmoothly: function(blockId, auctionId) {
      const instance = this.instances[blockId];
      if (!instance) {
        console.log('❌ No instance found for single auction block:', blockId);
        return;
      }
      
      console.log('🔄 Fetching single auction for block:', blockId, 'auction:', auctionId);
      // Fetch updated auction data
      fetch(`${instance.appProxyUrl}/api/auctions/${auctionId}?shop=${instance.shopDomain}`)
        .then(response => response.json())
        .then(data => {
          console.log('📊 Single auction data received:', data);
          if (data.success && data.data) {
            console.log('✅ Updating single auction');
            // Update the auction display smoothly
            this.updateSingleAuctionDisplay(blockId, data.data);
          } else {
            console.log('❌ No single auction data or success false');
          }
        })
        .catch(error => {
          console.log('❌ Error updating single auction:', error);
        });
    },
    
    // Update individual auction card smoothly
    updateAuctionCardSmoothly: function(blockId, auction) {
      console.log('🔄 Updating auction card:', auction._id, 'for block:', blockId);
      const auctionCard = document.querySelector(`#bidly-grid-${blockId} [data-auction-id="${auction._id}"]`);
      if (!auctionCard) {
        console.log('❌ Auction card not found for:', auction._id);
        return;
      }
      console.log('✅ Found auction card, updating...');
      
      // Update current bid amount
      const priceElement = auctionCard.querySelector('.bidly-price-amount');
      if (priceElement) {
        const currentBid = auction.currentBid || 0;
        const newPrice = currentBid > 0 ? `$${currentBid}` : `$${auction.startingBid}`;
        console.log('💰 Price update - Current:', priceElement.textContent, 'New:', newPrice);
        if (priceElement.textContent !== newPrice) {
          console.log('✅ Price changed, updating with highlight');
          priceElement.style.transition = 'color 0.3s ease';
          priceElement.textContent = newPrice;
          priceElement.style.color = '#ff6b35'; // Highlight change
          setTimeout(() => {
            priceElement.style.color = '';
          }, 1000);
        } else {
          console.log('⏭️ Price unchanged, skipping');
        }
      } else {
        console.log('❌ Price element not found');
      }
      
      // Update minimum bid in input placeholder
      const bidInputs = auctionCard.querySelectorAll('.bidly-bid-input, .bidly-featured-bid-input');
      console.log('💵 Found bid inputs for auction card:', bidInputs.length);
      let minBidUpdated = false;
      
      bidInputs.forEach((bidInput, index) => {
        const minBid = (auction.currentBid || 0) + 1;
        const newPlaceholder = `Min: $${minBid}`;
        console.log(`💵 Min bid update ${index} - Current placeholder:`, bidInput.placeholder, 'New:', newPlaceholder);
        if (bidInput.placeholder !== newPlaceholder) {
          console.log('✅ Min bid changed, updating placeholder with highlight');
          bidInput.style.transition = 'border-color 0.3s ease';
          bidInput.placeholder = newPlaceholder;
          bidInput.min = minBid;
          bidInput.style.borderColor = '#ff6b35'; // Highlight change
          setTimeout(() => {
            bidInput.style.borderColor = '';
          }, 1000);
          minBidUpdated = true;
        } else {
          console.log('⏭️ Min bid unchanged, skipping');
        }
      });
      
      if (!minBidUpdated) {
        console.log('❌ No bid input elements found for min bid update');
      }
      
      // Update bidder info
      const bidderElement = auctionCard.querySelector('.bidly-bidder');
      if (bidderElement && auction.currentBidder) {
        const newBidder = `by ${auction.currentBidder}`;
        if (bidderElement.textContent !== newBidder) {
          bidderElement.style.transition = 'opacity 0.3s ease';
          bidderElement.textContent = newBidder;
          bidderElement.style.opacity = '0.7';
          setTimeout(() => {
            bidderElement.style.opacity = '1';
          }, 500);
        }
      }
      
      // Update bid input placeholder
      const bidInput = auctionCard.querySelector('.bidly-bid-input');
      if (bidInput) {
        const minBid = (auction.currentBid || 0) + 1;
        const newPlaceholder = `Min: $${minBid}`;
        if (bidInput.placeholder !== newPlaceholder) {
          bidInput.placeholder = newPlaceholder;
        }
      }
      
      // Update timer
      const timeElement = auctionCard.querySelector('.bidly-auction-time');
      if (timeElement && auction.endTime) {
        const newTime = this.formatTimeLeft(auction.endTime);
        if (timeElement.textContent !== newTime) {
          timeElement.textContent = newTime;
        }
      }
    },
    
    // Update single auction display smoothly
    updateSingleAuctionDisplay: function(blockId, auction) {
      console.log('🔄 Updating single auction display for block:', blockId, 'auction:', auction._id);
      
      // Try different selectors for single and featured blocks
      const singleContainer = document.querySelector(`#bidly-auction-detail-${blockId}`);
      const featuredContainer = document.querySelector(`#bidly-featured-container-${blockId}`);
      const container = singleContainer || featuredContainer;
      
      if (!container) {
        console.log('❌ No container found for block:', blockId);
        return;
      }
      
      console.log('✅ Found container:', container.id);
      
      // Update current bid
      const priceElement = container.querySelector('.bidly-price-amount');
      if (priceElement) {
        const currentBid = auction.currentBid || 0;
        const newPrice = currentBid > 0 ? `$${currentBid}` : `$${auction.startingBid}`;
        console.log('💰 Single auction price update - Current:', priceElement.textContent, 'New:', newPrice);
        if (priceElement.textContent !== newPrice) {
          console.log('✅ Single auction price changed, updating with highlight');
          priceElement.style.transition = 'color 0.3s ease';
          priceElement.textContent = newPrice;
          priceElement.style.color = '#ff6b35'; // Highlight change
          setTimeout(() => {
            priceElement.style.color = '';
          }, 1000);
        } else {
          console.log('⏭️ Single auction price unchanged, skipping');
        }
      } else {
        console.log('❌ Single auction price element not found');
      }
      
      // Update minimum bid in input placeholder
      const bidInputs = container.querySelectorAll('.bidly-bid-input, .bidly-featured-bid-input');
      console.log('💵 Found bid inputs for single auction:', bidInputs.length);
      let minBidUpdated = false;
      
      bidInputs.forEach((bidInput, index) => {
        const minBid = (auction.currentBid || 0) + 1;
        const newPlaceholder = `Min: $${minBid}`;
        console.log(`💵 Single auction min bid update ${index} - Current placeholder:`, bidInput.placeholder, 'New:', newPlaceholder);
        if (bidInput.placeholder !== newPlaceholder) {
          console.log('✅ Single auction min bid changed, updating placeholder with highlight');
          bidInput.style.transition = 'border-color 0.3s ease';
          bidInput.placeholder = newPlaceholder;
          bidInput.min = minBid;
          bidInput.style.borderColor = '#ff6b35'; // Highlight change
          setTimeout(() => {
            bidInput.style.borderColor = '';
          }, 1000);
          minBidUpdated = true;
        } else {
          console.log('⏭️ Single auction min bid unchanged, skipping');
        }
      });
      
      if (!minBidUpdated) {
        console.log('❌ No bid input elements found for single auction min bid update');
      }
      
      // Update bidder info
      const bidderElement = container.querySelector('.bidly-bidder');
      if (bidderElement && auction.currentBidder) {
        const newBidder = `by ${auction.currentBidder}`;
        console.log('👤 Single auction bidder update - Current:', bidderElement.textContent, 'New:', newBidder);
        if (bidderElement.textContent !== newBidder) {
          console.log('✅ Single auction bidder changed, updating with highlight');
          bidderElement.style.transition = 'opacity 0.3s ease';
          bidderElement.textContent = newBidder;
          bidderElement.style.opacity = '0.7';
          setTimeout(() => {
            bidderElement.style.opacity = '1';
          }, 500);
        } else {
          console.log('⏭️ Single auction bidder unchanged, skipping');
        }
      } else {
        console.log('❌ Single auction bidder element not found or no bidder');
      }
      
      // Update bid input placeholder
      const bidInput = container.querySelector('.bidly-bid-input');
      if (bidInput) {
        const minBid = (auction.currentBid || 0) + 1;
        const newPlaceholder = `Min: $${minBid}`;
        console.log('📝 Single auction bid input update - Current:', bidInput.placeholder, 'New:', newPlaceholder);
        if (bidInput.placeholder !== newPlaceholder) {
          bidInput.placeholder = newPlaceholder;
          console.log('✅ Single auction bid input updated');
        } else {
          console.log('⏭️ Single auction bid input unchanged, skipping');
        }
      } else {
        console.log('❌ Single auction bid input not found');
      }
      
      // Update timer
      const timeElement = container.querySelector('.bidly-auction-time');
      if (timeElement && auction.endTime) {
        const newTime = this.formatTimeLeft(auction.endTime);
        console.log('⏰ Single auction timer update - Current:', timeElement.textContent, 'New:', newTime);
        if (timeElement.textContent !== newTime) {
          timeElement.textContent = newTime;
          console.log('✅ Single auction timer updated');
        } else {
          console.log('⏭️ Single auction timer unchanged, skipping');
        }
      } else {
        console.log('❌ Single auction timer element not found or no end time');
      }
      
      // Check if there's a new bid and show notification
      if (auction.bidHistory && auction.bidHistory.length > 0) {
        const latestBid = auction.bidHistory[auction.bidHistory.length - 1];
        const now = new Date();
        const bidTime = new Date(latestBid.timestamp);
        const timeDiff = now - bidTime;
        
        console.log('🔔 Checking for new bids:', {
          bidHistoryLength: auction.bidHistory.length,
          latestBid: latestBid,
          timeDiff: timeDiff,
          shouldShowNotification: timeDiff < 15000
        });
        
        // If the bid was placed within the last 15 seconds, show notification
        if (timeDiff < 15000) {
          console.log('🔔 Showing notification for recent bid');
          this.showBidNotification(latestBid, auction);
        }
      }
    },
    
    // Show bid notification popup (with duplicate prevention)
    showBidNotification: function(bid, auction) {
      console.log('🔔 Showing bid notification:', bid);
      
      // Check if we already showed this bid to prevent duplicates
      const bidKey = `${auction._id}_${bid.amount}_${bid.timestamp}`;
      if (this.shownBidNotifications && this.shownBidNotifications.has(bidKey)) {
        console.log('🔔 Bid notification already shown, skipping duplicate');
        return;
      }
      
      // Initialize tracking if not exists
      if (!this.shownBidNotifications) {
        this.shownBidNotifications = new Set();
      }
      
      // Mark this bid as shown
      this.shownBidNotifications.add(bidKey);
      
      // Remove any existing notifications first
      const existingNotifications = document.querySelectorAll('.bidly-bid-notification');
      existingNotifications.forEach(notif => notif.remove());
      
      // Create notification element
      const notification = document.createElement('div');
      notification.className = 'bidly-bid-notification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        max-width: 300px;
        animation: slideInRight 0.3s ease-out;
      `;
      
      notification.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">💰 New Bid!</div>
        <div>${bid.bidder || 'Someone'} bid $${bid.amount} on ${auction.productData?.title || 'this auction'}</div>
        <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">Just now</div>
      `;
      
      // Add CSS animation
      if (!document.getElementById('bidly-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'bidly-notification-styles';
        style.textContent = `
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }
      
      // Add to page
      document.body.appendChild(notification);
      
      // Auto remove after 5 seconds
      setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }, 5000);
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
        
        // Also update page timers (for product pages)
        this.updatePageTimers();
      }, 1000); // Update every second
    },
    
    // Update timers on product pages
    updatePageTimers: function() {
      // Update all timer elements on the page
      const timeElements = document.querySelectorAll('.bidly-auction-time, .bidly-featured-time, .auction-timer');
      console.log('🕐 Updating page timers, found elements:', timeElements.length);
      timeElements.forEach(timeElement => {
        if (timeElement.dataset.endTime) {
          const newTime = this.formatTimeLeft(timeElement.dataset.endTime);
          console.log('🕐 Updating timer:', timeElement.dataset.endTime, '->', newTime);
          timeElement.textContent = newTime;
        }
      });
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
    
    // Check if this is a fresh widget instance (instances object is empty)
    const hasExistingInstances = window.BidlyAuctionWidget.instances && Object.keys(window.BidlyAuctionWidget.instances).length > 0;
    console.log('🔍 Has existing instances:', hasExistingInstances);
    console.log('🔍 Current instances object:', window.BidlyAuctionWidget.instances);
    
    // If this is a fresh widget, try to restore from global storage
    if (!hasExistingInstances && window.BidlyGlobalInstances) {
      console.log('🔄 Restoring instances from global storage:', Object.keys(window.BidlyGlobalInstances));
      window.BidlyAuctionWidget.instances = { ...window.BidlyGlobalInstances };
    }
    
    // Log instances BEFORE ensureLoadedInstances
    console.log('🔍 Instances BEFORE ensureLoadedInstances:', Object.keys(window.BidlyAuctionWidget.instances || {}));
    
    window.BidlyAuctionWidget.ensureLoadedInstances();
    
    // Log instances AFTER ensureLoadedInstances
    console.log('🔍 Instances AFTER ensureLoadedInstances:', Object.keys(window.BidlyAuctionWidget.instances || {}));
    
    // Preserve existing instances when adding new ones
    const existingInstances = { ...window.BidlyAuctionWidget.instances };
    console.log('🔍 Preserving existing instances:', Object.keys(existingInstances));
    
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
    
    // Merge back existing instances to prevent overwriting
    Object.keys(existingInstances).forEach(key => {
      if (!window.BidlyAuctionWidget.instances[key]) {
        window.BidlyAuctionWidget.instances[key] = existingInstances[key];
        console.log('🔄 Restored existing instance:', key);
      }
    });
    
    console.log('📋 All instances after global init:', Object.keys(window.BidlyAuctionWidget.instances));
    console.log('📋 Final instances object:', window.BidlyAuctionWidget.instances);
    
    // Store instances globally to prevent loss between block initializations
    window.BidlyGlobalInstances = { ...window.BidlyAuctionWidget.instances };
    console.log('💾 Stored instances globally:', Object.keys(window.BidlyGlobalInstances));
    
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
  
  // Initialize product page when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.BidlyAuctionWidget.initializeProductPage();
    });
  } else {
    window.BidlyAuctionWidget.initializeProductPage();
  }
  
  // Initialize product page
  window.BidlyAuctionWidget.initializeProductPage = function() {
    console.log('🚀 Initializing product page...');
    
    // Initialize customer auth
    this.initializeCustomerAuth();
    
    // Start timer updates
    this.startTimerUpdates();
    
    // Start real-time polling for product page
    this.startProductPagePolling();
    
    console.log('✅ Product page initialized');
  };
  
  // Start polling for product page updates
  window.BidlyAuctionWidget.startProductPagePolling = function() {
    console.log('🔄 Starting product page polling every 3 seconds...');
    
    // Clear any existing polling
    if (this.productPagePollingInterval) {
      clearInterval(this.productPagePollingInterval);
    }
    
    this.productPagePollingInterval = setInterval(() => {
      this.pollProductPageUpdates();
    }, 3000);
  };
  
  // Poll for product page updates
  window.BidlyAuctionWidget.pollProductPageUpdates = function() {
    console.log('🔄 Polling product page for updates...');
    
    // Get auction data from the page
    const auctionContainer = document.getElementById('bidly-auction-detail-page');
    if (!auctionContainer) {
      console.log('❌ No auction container found on product page');
      return;
    }
    
    const auctionId = auctionContainer.dataset.auctionId;
    const shopDomain = auctionContainer.dataset.shop;
    
    if (!auctionId || !shopDomain) {
      console.log('❌ Missing auction ID or shop domain on product page');
      return;
    }
    
    console.log('📡 Fetching product page auction data:', { auctionId, shopDomain });
    
    // Fetch updated auction data
    const appProxyUrl = `https://${shopDomain}/apps/bidly/api`;
    fetch(`${appProxyUrl}/auctions/${auctionId}?shop=${shopDomain}`)
      .then(response => response.json())
      .then(data => {
        console.log('📊 Product page auction data received:', data);
        if (data.success && data.data) {
          console.log('✅ Updating product page with new data');
          this.updateProductPageContent(data.data);
        } else {
          console.log('❌ No product page auction data or success false');
        }
      })
      .catch(error => {
        console.log('❌ Error updating product page auction:', error);
      });
  };
  
  // Update product page content with new auction data
  window.BidlyAuctionWidget.updateProductPageContent = function(auction) {
    console.log('🔄 Updating product page content:', auction._id);
    
    // Update current bid
    const currentBidElement = document.querySelector('.price-amount');
    if (currentBidElement) {
      const currentBid = auction.currentBid || 0;
      const startingBid = auction.startingBid || 0;
      const displayPrice = currentBid > 0 ? currentBid : startingBid;
      const newPrice = `$${displayPrice}`;
      console.log('💰 Product page price update - Current:', currentBidElement.textContent, 'New:', newPrice);
      if (currentBidElement.textContent !== newPrice) {
        console.log('✅ Product page price changed, updating with highlight');
        currentBidElement.style.transition = 'color 0.3s ease';
        currentBidElement.textContent = newPrice;
        currentBidElement.style.color = '#ff6b35';
        setTimeout(() => {
          currentBidElement.style.color = '';
        }, 1000);
      }
    }
    
    // Update minimum bid in input placeholder
    const bidInputs = document.querySelectorAll('.bidly-bid-input, .bidly-featured-bid-input');
    console.log('💵 Found bid inputs for product page:', bidInputs.length);
    let minBidUpdated = false;
    
    bidInputs.forEach((bidInput, index) => {
      const minBid = (auction.currentBid || 0) + 1;
      const newPlaceholder = `Min: $${minBid}`;
      console.log(`💵 Product page min bid update ${index} - Current placeholder:`, bidInput.placeholder, 'New:', newPlaceholder);
      if (bidInput.placeholder !== newPlaceholder) {
        console.log('✅ Product page min bid changed, updating placeholder with highlight');
        bidInput.style.transition = 'border-color 0.3s ease';
        bidInput.placeholder = newPlaceholder;
        bidInput.min = minBid;
        bidInput.style.borderColor = '#ff6b35';
        setTimeout(() => {
          bidInput.style.borderColor = '';
        }, 1000);
        minBidUpdated = true;
      } else {
        console.log('⏭️ Product page min bid unchanged, skipping');
      }
    });
    
    if (!minBidUpdated) {
      console.log('❌ No bid input elements found for product page min bid update');
    }
    
    // Update bid history
    const bidHistoryElement = document.querySelector('.auction-bid-history');
    if (bidHistoryElement) {
      bidHistoryElement.innerHTML = this.renderBidHistory(auction);
    }
    
    // Check if there's a new bid and show notification
    if (auction.bidHistory && auction.bidHistory.length > 0) {
      const latestBid = auction.bidHistory[auction.bidHistory.length - 1];
      const now = new Date();
      const bidTime = new Date(latestBid.timestamp);
      const timeDiff = now - bidTime;
      
      console.log('🔔 Product page checking for new bids:', {
        bidHistoryLength: auction.bidHistory.length,
        latestBid: latestBid,
        timeDiff: timeDiff,
        shouldShowNotification: timeDiff < 15000
      });
      
      // If the bid was placed within the last 15 seconds, show notification
      if (timeDiff < 15000) {
        console.log('🔔 Showing notification for recent bid on product page');
        this.showBidNotification(latestBid, auction);
      }
    }
    
    console.log('✅ Product page content updated');
  };
  
  // Load single auction page (called from product page)
  window.BidlyAuctionWidget.loadSingleAuctionPage = function(auctionId, productId, shopDomain) {
    console.log('🎯 Loading single auction page:', { auctionId, productId, shopDomain });
    
    // Initialize customer auth
    this.initializeCustomerAuth();
    
    // Start timer updates
    this.startTimerUpdates();
    
    // Load the auction data
    this.loadAuctionForPage(auctionId, productId, shopDomain);
  };
  
  // Debug function to check if widget is loaded
  window.BidlyAuctionWidget.debug = function() {
    console.log('🔍 Widget debug info:', {
      widgetLoaded: !!window.BidlyAuctionWidget,
      functions: {
        loadSingleAuctionPage: !!window.BidlyAuctionWidget.loadSingleAuctionPage,
        loadAuctionForPage: !!window.BidlyAuctionWidget.loadAuctionForPage,
        renderAuctionOnPage: !!window.BidlyAuctionWidget.renderAuctionOnPage,
        initializeCustomerAuth: !!window.BidlyAuctionWidget.initializeCustomerAuth,
        startTimerUpdates: !!window.BidlyAuctionWidget.startTimerUpdates
      }
    });
  };
  
  // Load auction data for product page
  window.BidlyAuctionWidget.loadAuctionForPage = function(auctionId, productId, shopDomain) {
    console.log('📡 Loading auction data for page...');
    
    const appProxyUrl = `https://${shopDomain}/apps/bidly/api`;
    
    fetch(`${appProxyUrl}/auctions/${auctionId}?shop=${shopDomain}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          console.log('✅ Auction data loaded:', data.data);
          
          // Store auction data globally for the page
          window.currentAuctionData = data.data;
          
          // Render the auction on the page
          this.renderAuctionOnPage(data.data);
          
          // Start real-time updates for product page
          this.startPageRealTimeUpdates(auctionId, shopDomain);
        } else {
          console.error('❌ Failed to load auction:', data.message);
          this.showPageError('Failed to load auction data');
        }
      })
      .catch(error => {
        console.error('❌ Error loading auction:', error);
        this.showPageError('Error loading auction data');
      });
  };
  
  // Start real-time updates for product page
  window.BidlyAuctionWidget.startPageRealTimeUpdates = function(auctionId, shopDomain) {
    console.log('🔄 Starting real-time updates for product page...');
    
    // Update every 5 seconds
    setInterval(() => {
      this.updatePageAuctionData(auctionId, shopDomain);
    }, 5000);
  };
  
  // Update auction data on product page
  window.BidlyAuctionWidget.updatePageAuctionData = function(auctionId, shopDomain) {
    const appProxyUrl = `https://${shopDomain}/apps/bidly/api`;
    
    fetch(`${appProxyUrl}/auctions/${auctionId}?shop=${shopDomain}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Update global auction data
          window.currentAuctionData = data.data;
          
          // Update the page content
          this.updatePageContent(data.data);
        }
      })
      .catch(error => {
        console.error('❌ Error updating auction data:', error);
      });
  };
  
  // Update page content with new auction data
  window.BidlyAuctionWidget.updatePageContent = function(auction) {
    // Update current bid
    const currentBidElement = document.querySelector('.price-amount');
    if (currentBidElement) {
      const currentBid = auction.currentBid || 0;
      const startingBid = auction.startingBid || 0;
      const displayPrice = currentBid > 0 ? currentBid : startingBid;
      currentBidElement.textContent = `$${displayPrice}`;
    }
    
    // Update bid history
    const bidHistoryElement = document.querySelector('.auction-bid-history');
    if (bidHistoryElement) {
      bidHistoryElement.innerHTML = this.renderBidHistory(auction);
    }
    
    // Update minimum bid in bidding section
    const minBidElement = document.querySelector('.bidly-min-bid');
    if (minBidElement) {
      const currentBid = auction.currentBid || 0;
      const startingBid = auction.startingBid || 0;
      const minBid = currentBid > 0 ? currentBid + 1 : startingBid;
      minBidElement.textContent = `Minimum bid: $${minBid}`;
    }
    
    console.log('✅ Page content updated with new auction data');
  };
  
  // Render auction on product page
  window.BidlyAuctionWidget.renderAuctionOnPage = function(auction) {
    console.log('🎨 Rendering auction on page:', auction);
    
    const container = document.getElementById('bidly-auction-detail-page');
    if (!container) {
      console.error('❌ Container not found');
      return;
    }
    
    const status = this.computeAuctionStatus(auction);
    const timeLeft = this.formatTimeLeft(auction.endTime);
    const productImage = auction.productData?.images?.[0]?.src || '/placeholder-image.jpg';
    
    // Calculate display values
    const currentBid = auction.currentBid || 0;
    const startingBid = auction.startingBid || 0;
    const displayPrice = currentBid > 0 ? currentBid : startingBid;
    const priceLabel = currentBid > 0 ? 'Current Bid' : 'Starting Bid';
    
    // Calculate minimum bid
    let minBid;
    if (currentBid > 0) {
      minBid = currentBid + 1;
    } else if (startingBid > 0) {
      minBid = startingBid;
    } else {
      minBid = 1;
    }
    
    container.innerHTML = `
      ${this.renderPageCustomerAuth()}
      <div class="auction-details-full">
        <div class="auction-details-image">
          <img src="${productImage}" alt="${auction.productData?.title || 'Auction Item'}" class="auction-main-image" onerror="this.src='/placeholder-image.jpg'">
        </div>
        <div class="auction-details-info">
          <h1 class="auction-title">${auction.productData?.title || 'Auction Item'}</h1>
          <div class="auction-price-section">
            <div class="auction-price">
              <div class="price-label">${priceLabel}</div>
              <div class="price-amount">$${displayPrice}</div>
              ${currentBid > 0 && startingBid > 0 ? `<div class="starting-price">Starting: $${startingBid}</div>` : ''}
            </div>
          </div>
          <div class="auction-timer" data-end-time="${auction.endTime}">${timeLeft}</div>
          <div class="auction-status status-${status}">${status}</div>
          <div class="auction-bidding-section">
            ${this.renderPageBiddingSection(auction, minBid)}
          </div>
          <div class="auction-bid-history">
            ${this.renderBidHistory(auction)}
          </div>
        </div>
      </div>
    `;
    
    console.log('✅ Auction rendered on page');
  };
  
  // Render customer auth for product page (with top-right positioning)
  window.BidlyAuctionWidget.renderPageCustomerAuth = function() {
    if (this.customerInitialized && this.customer) {
      return `
        <div class="bidly-page-customer-auth" style="position: fixed; top: 20px; right: 20px; z-index: 1000; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div class="bidly-customer-info">
            <span class="bidly-customer-name">Welcome, ${this.customer.name}!</span>
            <button class="bidly-logout-btn" onclick="BidlyAuctionWidget.logout()">Logout</button>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="bidly-page-customer-auth" style="position: fixed; top: 20px; right: 20px; z-index: 1000; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div class="bidly-auth-form">
          <input type="text" placeholder="Your name" class="bidly-auth-input" id="bidly-page-name">
          <input type="email" placeholder="Your email" class="bidly-auth-input" id="bidly-page-email">
          <button class="bidly-login-btn" onclick="BidlyAuctionWidget.loginPage()">Login</button>
        </div>
      </div>
    `;
  };
  
  // Show error on product page
  window.BidlyAuctionWidget.showPageError = function(message) {
    const container = document.getElementById('bidly-auction-detail-page');
    if (container) {
      container.innerHTML = `
        <div class="error" style="text-align: center; padding: 2rem; color: #dc3545;">
          <h3>Error</h3>
          <p>${message}</p>
        </div>
      `;
    }
  };

})();
