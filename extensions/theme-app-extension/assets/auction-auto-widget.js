/**
 * Automatic Auction Widget
 * Automatically detects products with auctions and overlays widget on pricing section
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        backendUrl: 'https://bidly-auction-backend.onrender.com',
        shopDomain: window.Shopify?.shop || window.location.hostname,
        checkInterval: 5000, // Check for updates every 5 seconds
        widgetClass: 'bidly-auto-auction-widget',
        pricingSelectors: [
            '.product-form__price',
            '.price',
            '.product-price',
            '.product__price',
            '[data-price]',
            '.money',
            '.product-single__price',
            '.product__pricing'
        ]
    };

    // Widget HTML template
    function createWidgetHTML(auctionData) {
        const { auction_id, status, current_bid, starting_bid, reserve_price, end_time, bid_count, buy_now_price } = auctionData;
        
        return `
            <div id="bidly-auto-widget-${auction_id}" class="${CONFIG.widgetClass}" data-auction-id="${auction_id}">
                <div class="bidly-widget-overlay">
                    <div class="bidly-widget-header">
                        <h3 class="bidly-widget-title">Live Auction</h3>
                        <div class="bidly-widget-status">
                            ${status === 'active' ? '<span class="bidly-status-active">● LIVE</span>' : 
                              status === 'pending' ? '<span class="bidly-status-pending">● STARTING SOON</span>' : 
                              '<span class="bidly-status-ended">● ENDED</span>'}
                        </div>
                    </div>

                    ${status === 'active' && end_time ? `
                        <div class="bidly-widget-timer">
                            <div class="bidly-timer-label">Ends In:</div>
                            <div class="bidly-countdown" data-end-time="${end_time}">
                                <span class="bidly-timer-days">0</span>d 
                                <span class="bidly-timer-hours">0</span>h 
                                <span class="bidly-timer-minutes">0</span>m 
                                <span class="bidly-timer-seconds">0</span>s
                            </div>
                        </div>
                    ` : ''}

                    <div class="bidly-widget-pricing">
                        <div class="bidly-current-bid">
                            <span class="bidly-label">Current Bid:</span>
                            <span class="bidly-amount" data-current-bid="${current_bid}">$${current_bid.toFixed(2)}</span>
                        </div>
                        ${reserve_price > 0 ? `
                            <div class="bidly-reserve-price">
                                <span class="bidly-label">Reserve:</span>
                                <span class="bidly-amount">$${reserve_price.toFixed(2)}</span>
                            </div>
                        ` : ''}
                        <div class="bidly-bid-count">
                            <span class="bidly-label">Bids:</span>
                            <span class="bidly-count" data-bid-count="${bid_count}">${bid_count}</span>
                        </div>
                    </div>

                    ${status === 'active' ? `
                        <div class="bidly-widget-actions">
                            <button class="bidly-bid-btn" onclick="openBidModal('${auction_id}')">
                                Place a Bid
                            </button>
                            ${buy_now_price > 0 ? `
                                <button class="bidly-buy-now-btn" onclick="openBuyNowModal('${auction_id}', ${buy_now_price})">
                                    Buy Now ($${buy_now_price.toFixed(2)})
                                </button>
                            ` : ''}
                        </div>
                    ` : status === 'pending' ? `
                        <div class="bidly-pending-message">
                            Auction will start soon. Check back later!
                        </div>
                    ` : `
                        <div class="bidly-ended-message">
                            Auction has ended. Final bid: $${current_bid.toFixed(2)}
                        </div>
                    `}

                    <div class="bidly-widget-footer">
                        <a href="#" onclick="openBidHistory('${auction_id}')" class="bidly-history-link">
                            View Bid History
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    // Check if product has auction data
    async function checkProductForAuction() {
        try {
            // First check if auction data was already loaded by the injector
            if (window.bidlyAuctionData && window.bidlyAuctionData.hasAuction) {
                return window.bidlyAuctionData;
            }

            // Fallback: try to get from backend API
            const productId = getProductId();
            if (!productId) return null;

            const response = await fetch(`${CONFIG.backendUrl}/api/auctions/product/${productId}?shop=${CONFIG.shopDomain}`);
            if (!response.ok) return null;

            const data = await response.json();
            return data.success ? data.auction : null;
        } catch (error) {
            console.warn('Bidly: Error checking for auction:', error);
            return null;
        }
    }

    // Get product ID from various sources
    function getProductId() {
        // Try to get from Shopify global object
        if (window.Shopify?.analytics?.meta?.product?.id) {
            return window.Shopify.analytics.meta.product.id;
        }

        // Try to get from product JSON script tag
        const productJson = document.querySelector('script[type="application/json"][data-product-json]');
        if (productJson) {
            try {
                const product = JSON.parse(productJson.textContent);
                return product.id;
            } catch (e) {
                console.warn('Bidly: Error parsing product JSON');
            }
        }

        // Try to get from URL
        const urlMatch = window.location.pathname.match(/\/products\/([^\/\?]+)/);
        if (urlMatch) {
            // This would need to be resolved to actual product ID via API
            return null;
        }

        return null;
    }

    // Find pricing section to overlay widget
    function findPricingSection() {
        for (const selector of CONFIG.pricingSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element;
            }
        }
        return null;
    }

    // Inject widget into pricing section
    function injectWidget(auctionData) {
        const pricingSection = findPricingSection();
        if (!pricingSection) {
            console.warn('Bidly: Could not find pricing section to overlay widget');
            return;
        }

        // Remove existing widget if any
        const existingWidget = document.querySelector(`.${CONFIG.widgetClass}`);
        if (existingWidget) {
            existingWidget.remove();
        }

        // Create overlay container
        const overlayContainer = document.createElement('div');
        overlayContainer.className = CONFIG.widgetClass;
        overlayContainer.innerHTML = createWidgetHTML(auctionData);

        // Position the widget as an overlay
        const pricingRect = pricingSection.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        overlayContainer.style.position = 'absolute';
        overlayContainer.style.top = (pricingRect.bottom + scrollTop + 20) + 'px';
        overlayContainer.style.left = pricingRect.left + 'px';
        overlayContainer.style.width = pricingRect.width + 'px';
        overlayContainer.style.zIndex = '1000';
        overlayContainer.style.maxWidth = '100%';

        // Insert the widget
        document.body.appendChild(overlayContainer);

        // Initialize countdown timer if active
        if (auctionData.status === 'active' && auctionData.end_time) {
            initializeCountdown(auctionData.auction_id, auctionData.end_time);
        }

        // Initialize real-time updates
        initializeRealTimeUpdates(auctionData.auction_id);

        // Adjust position on scroll
        window.addEventListener('scroll', () => {
            const newPricingRect = pricingSection.getBoundingClientRect();
            const newScrollTop = window.pageYOffset || document.documentElement.scrollTop;
            overlayContainer.style.top = (newPricingRect.bottom + newScrollTop + 20) + 'px';
            overlayContainer.style.left = newPricingRect.left + 'px';
            overlayContainer.style.width = newPricingRect.width + 'px';
        });

        // Adjust position on resize
        window.addEventListener('resize', () => {
            const newPricingRect = pricingSection.getBoundingClientRect();
            const newScrollTop = window.pageYOffset || document.documentElement.scrollTop;
            overlayContainer.style.top = (newPricingRect.bottom + newScrollTop + 20) + 'px';
            overlayContainer.style.left = newPricingRect.left + 'px';
            overlayContainer.style.width = newPricingRect.width + 'px';
        });
    }

    // Initialize countdown timer
    function initializeCountdown(auctionId, endTime) {
        const countdownElement = document.querySelector(`#bidly-auto-widget-${auctionId} .bidly-countdown`);
        if (!countdownElement) return;

        const endTimestamp = new Date(endTime).getTime();
        
        function updateCountdown() {
            const now = new Date().getTime();
            const distance = endTimestamp - now;

            if (distance < 0) {
                countdownElement.innerHTML = 'Auction Ended';
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            countdownElement.querySelector('.bidly-timer-days').textContent = days;
            countdownElement.querySelector('.bidly-timer-hours').textContent = hours;
            countdownElement.querySelector('.bidly-timer-minutes').textContent = minutes;
            countdownElement.querySelector('.bidly-timer-seconds').textContent = seconds;
        }

        updateCountdown();
        setInterval(updateCountdown, 1000);
    }

    // Initialize real-time updates via polling
    function initializeRealTimeUpdates(auctionId) {
        setInterval(async () => {
            try {
                const response = await fetch(`${CONFIG.backendUrl}/api/auctions/${auctionId}?shop=${CONFIG.shopDomain}`);
                if (!response.ok) return;

                const data = await response.json();
                if (data.success && data.auction) {
                    updateWidgetData(auctionId, data.auction);
                }
            } catch (error) {
                console.warn('Bidly: Error updating auction data:', error);
            }
        }, CONFIG.checkInterval);
    }

    // Update widget data in real-time
    function updateWidgetData(auctionId, auctionData) {
        const widget = document.querySelector(`#bidly-auto-widget-${auctionId}`);
        if (!widget) return;

        // Update current bid
        const currentBidElement = widget.querySelector('[data-current-bid]');
        if (currentBidElement) {
            currentBidElement.textContent = `$${auctionData.current_bid.toFixed(2)}`;
            currentBidElement.setAttribute('data-current-bid', auctionData.current_bid);
        }

        // Update bid count
        const bidCountElement = widget.querySelector('[data-bid-count]');
        if (bidCountElement) {
            bidCountElement.textContent = auctionData.bid_count;
            bidCountElement.setAttribute('data-bid-count', auctionData.bid_count);
        }

        // Update status if changed
        if (auctionData.status !== 'active') {
            const statusElement = widget.querySelector('.bidly-widget-status');
            if (statusElement) {
                statusElement.innerHTML = auctionData.status === 'ended' ? 
                    '<span class="bidly-status-ended">● ENDED</span>' : 
                    '<span class="bidly-status-pending">● PENDING</span>';
            }
        }
    }

    // Global functions for modals
    window.openBidModal = function(auctionId) {
        const modal = createBidModal(auctionId);
        document.body.appendChild(modal);
        modal.style.display = 'flex';
    };

    window.openBuyNowModal = function(auctionId, price) {
        const modal = createBuyNowModal(auctionId, price);
        document.body.appendChild(modal);
        modal.style.display = 'flex';
    };

    window.openBidHistory = function(auctionId) {
        // Open bid history in a new window or modal
        window.open(`${CONFIG.backendUrl}/api/auctions/${auctionId}/bids?shop=${CONFIG.shopDomain}`, '_blank');
    };

    // Create bid modal
    function createBidModal(auctionId) {
        const modal = document.createElement('div');
        modal.className = 'bidly-modal-overlay';
        modal.innerHTML = `
            <div class="bidly-modal-content">
                <div class="bidly-modal-header">
                    <h3>Place Your Bid</h3>
                    <button class="bidly-modal-close" onclick="closeBidModal('${auctionId}')">&times;</button>
                </div>
                <div class="bidly-modal-body">
                    <form id="bidly-bid-form-${auctionId}" onsubmit="submitBid(event, '${auctionId}')">
                        <div class="bidly-form-group">
                            <label for="bidly-bid-amount-${auctionId}">Bid Amount</label>
                            <input type="number" id="bidly-bid-amount-${auctionId}" name="amount" step="0.01" required>
                            <small>Enter your bid amount</small>
                        </div>
                        <div class="bidly-form-group">
                            <label for="bidly-bidder-name-${auctionId}">Your Name</label>
                            <input type="text" id="bidly-bidder-name-${auctionId}" name="bidderName" required>
                        </div>
                        <div class="bidly-form-group">
                            <label for="bidly-bidder-email-${auctionId}">Your Email</label>
                            <input type="email" id="bidly-bidder-email-${auctionId}" name="bidderEmail" required>
                        </div>
                        <div class="bidly-form-actions">
                            <button type="submit" class="bidly-submit-bid">Place Bid</button>
                            <button type="button" onclick="closeBidModal('${auctionId}')">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        return modal;
    }

    // Create buy now modal
    function createBuyNowModal(auctionId, price) {
        const modal = document.createElement('div');
        modal.className = 'bidly-modal-overlay';
        modal.innerHTML = `
            <div class="bidly-modal-content">
                <div class="bidly-modal-header">
                    <h3>Buy Now</h3>
                    <button class="bidly-modal-close" onclick="closeBuyNowModal('${auctionId}')">&times;</button>
                </div>
                <div class="bidly-modal-body">
                    <p>Are you sure you want to buy this item for <strong>$${price.toFixed(2)}</strong>?</p>
                    <p>This will end the auction immediately and you will be the winner.</p>
                    <div class="bidly-form-actions">
                        <button onclick="confirmBuyNow('${auctionId}', ${price})" class="bidly-confirm-buy">Yes, Buy Now</button>
                        <button onclick="closeBuyNowModal('${auctionId}')">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        return modal;
    }

    // Close bid modal
    window.closeBidModal = function(auctionId) {
        const modal = document.querySelector(`#bidly-bid-form-${auctionId}`).closest('.bidly-modal-overlay');
        if (modal) {
            modal.remove();
        }
    };

    // Close buy now modal
    window.closeBuyNowModal = function(auctionId) {
        const modal = document.querySelector(`[onclick*="confirmBuyNow('${auctionId}'"]`).closest('.bidly-modal-overlay');
        if (modal) {
            modal.remove();
        }
    };

    // Submit bid
    window.submitBid = async function(event, auctionId) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        
        const bidData = {
            amount: parseFloat(formData.get('amount')),
            bidderName: formData.get('bidderName'),
            bidderEmail: formData.get('bidderEmail')
        };

        try {
            const response = await fetch(`${CONFIG.backendUrl}/api/auctions/${auctionId}/bid?shop=${CONFIG.shopDomain}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bidData)
            });

            const result = await response.json();
            if (result.success) {
                alert('Bid placed successfully!');
                closeBidModal(auctionId);
                // Refresh auction data
                location.reload();
            } else {
                alert('Error placing bid: ' + result.message);
            }
        } catch (error) {
            console.error('Error placing bid:', error);
            alert('Error placing bid. Please try again.');
        }
    };

    // Confirm buy now
    window.confirmBuyNow = async function(auctionId, price) {
        try {
            const response = await fetch(`${CONFIG.backendUrl}/api/auctions/${auctionId}/buy-now?shop=${CONFIG.shopDomain}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ price })
            });

            const result = await response.json();
            if (result.success) {
                alert('Congratulations! You won the auction!');
                closeBuyNowModal(auctionId);
                location.reload();
            } else {
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error('Error buying now:', error);
            alert('Error completing purchase. Please try again.');
        }
    };

    // Main initialization
    async function init() {
        // Wait for page to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // Only run on product pages
        if (!window.location.pathname.includes('/products/')) {
            return;
        }

        console.log('Bidly: Initializing automatic auction widget...');

        // Check for auction data
        const auctionData = await checkProductForAuction();
        if (auctionData) {
            console.log('Bidly: Found auction data, injecting widget:', auctionData);
            injectWidget(auctionData);
        } else {
            console.log('Bidly: No auction data found for this product');
        }
    }

    // Start the widget
    init();

})();
