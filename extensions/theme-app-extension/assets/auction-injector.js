/**
 * Auction Widget Injector
 * Automatically injects the auction widget script into product pages
 */

(function() {
    'use strict';

    // Only run on product pages
    if (!window.location.pathname.includes('/products/')) {
        return;
    }

    // Configuration
    const CONFIG = {
        backendUrl: 'https://bidly-auction-backend.onrender.com',
        shopDomain: window.Shopify?.shop || window.location.hostname,
        widgetScript: '/apps/bidly/auction-auto-widget.js',
        widgetCSS: '/apps/bidly/auction-auto-widget.css'
    };

    // Inject CSS
    function injectCSS() {
        const existingCSS = document.querySelector('link[href*="auction-auto-widget.css"]');
        if (existingCSS) return;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = CONFIG.widgetCSS;
        link.type = 'text/css';
        document.head.appendChild(link);
    }

    // Inject JavaScript
    function injectScript() {
        const existingScript = document.querySelector('script[src*="auction-auto-widget.js"]');
        if (existingScript) return;

        const script = document.createElement('script');
        script.src = CONFIG.widgetScript;
        script.type = 'text/javascript';
        script.async = true;
        document.head.appendChild(script);
    }

    // Check if product has auction data via metafields
    async function checkProductMetafields() {
        try {
            // Try to get product data from Shopify's global objects
            if (window.Shopify?.analytics?.meta?.product) {
                const product = window.Shopify.analytics.meta.product;
                
                // Check if product has auction metafields
                if (product.metafields && product.metafields.auction) {
                    const auctionData = product.metafields.auction;
                    if (auctionData.is_auction && auctionData.auction_id) {
                        return {
                            hasAuction: true,
                            auctionId: auctionData.auction_id,
                            status: auctionData.status || 'pending',
                            currentBid: parseFloat(auctionData.current_bid) || 0,
                            startingBid: parseFloat(auctionData.starting_bid) || 0,
                            reservePrice: parseFloat(auctionData.reserve_price) || 0,
                            endTime: auctionData.end_time,
                            bidCount: parseInt(auctionData.bid_count) || 0,
                            buyNowPrice: parseFloat(auctionData.buy_now_price) || 0
                        };
                    }
                }
            }

            // Fallback: try to get from product JSON script tag
            const productJson = document.querySelector('script[type="application/json"][data-product-json]');
            if (productJson) {
                try {
                    const product = JSON.parse(productJson.textContent);
                    if (product.metafields && product.metafields.auction) {
                        const auctionData = product.metafields.auction;
                        if (auctionData.is_auction && auctionData.auction_id) {
                            return {
                                hasAuction: true,
                                auctionId: auctionData.auction_id,
                                status: auctionData.status || 'pending',
                                currentBid: parseFloat(auctionData.current_bid) || 0,
                                startingBid: parseFloat(auctionData.starting_bid) || 0,
                                reservePrice: parseFloat(auctionData.reserve_price) || 0,
                                endTime: auctionData.end_time,
                                bidCount: parseInt(auctionData.bid_count) || 0,
                                buyNowPrice: parseFloat(auctionData.buy_now_price) || 0
                            };
                        }
                    }
                } catch (e) {
                    console.warn('Bidly: Error parsing product JSON:', e);
                }
            }

            return { hasAuction: false };
        } catch (error) {
            console.warn('Bidly: Error checking product metafields:', error);
            return { hasAuction: false };
        }
    }

    // Main initialization
    async function init() {
        console.log('Bidly: Checking for auction data...');
        
        // Check if product has auction data
        const auctionCheck = await checkProductMetafields();
        
        if (auctionCheck.hasAuction) {
            console.log('Bidly: Product has auction data, injecting widget...', auctionCheck);
            
            // Inject CSS and JavaScript
            injectCSS();
            injectScript();
            
            // Store auction data for the widget to use
            window.bidlyAuctionData = auctionCheck;
        } else {
            console.log('Bidly: No auction data found for this product');
        }
    }

    // Wait for page to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
