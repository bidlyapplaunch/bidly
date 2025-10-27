/**
 * Auction App Embed JavaScript
 * Handles widget injection and hybrid login functionality
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
        shopDomain: window.Shopify?.shop?.permanent_domain || window.location.hostname,
        widgetClass: 'bidly-auction-app-embed',
        pricingSelectors: [
            '.product-form__price',
            '.price',
            '.product-price',
            '.product__price',
            '[data-price]',
            '.money',
            '.product-single__price',
            '.product__pricing',
            '.price-wrapper',
            '.product-price-wrapper'
        ]
    };

    // Use simplified login system
    function getCurrentCustomer() {
        return window.BidlySimpleLogin?.getCurrentCustomer() || null;
    }

    function isUserLoggedIn() {
        return window.BidlySimpleLogin?.isUserLoggedIn() || false;
    }

    // Widget HTML template
    function createWidgetHTML(auctionData, settings) {
        const { auctionId, status, currentBid, startingBid, reservePrice, endTime, bidCount, buyNowPrice } = auctionData;
        const { show_timer, show_bid_history, widget_position } = settings;
        
        // If not logged in, show login prompt
        if (!isUserLoggedIn()) {
            return `
                <div id="bidly-auction-widget-${auctionId}" class="${CONFIG.widgetClass}" data-auction-id="${auctionId}">
                    <div class="bidly-widget-container">
                        <div class="bidly-widget-header">
                            <h3 class="bidly-widget-title">Live Auction</h3>
                            <div class="bidly-widget-status">
                                ${status === 'active' ? '<span class="bidly-status-active">● LIVE</span>' : 
                                  status === 'pending' ? '<span class="bidly-status-pending">● STARTING SOON</span>' : 
                                  '<span class="bidly-status-ended">● ENDED</span>'}
                            </div>
                        </div>
                        
                        <div class="bidly-login-required">
                            <div class="bidly-login-message">
                                <h4>Login Required to Bid</h4>
                                <p>Please log in to participate in this auction</p>
                            </div>
                            
                            <div class="bidly-login-options">
                                <button class="bidly-btn bidly-btn-primary bidly-shopify-login" onclick="window.location.href='/account/login'">
                                    <span class="bidly-btn-icon">🛍️</span>
                                    Log in with Shopify
                                </button>
                                
                                <button class="bidly-btn bidly-btn-secondary bidly-guest-login" onclick="window.BidlySimpleLogin?.showTempLoginPopup()">
                                    <span class="bidly-btn-icon">👤</span>
                                    Continue as Guest
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        return `
            <div id="bidly-auction-widget-${auctionId}" class="${CONFIG.widgetClass}" data-auction-id="${auctionId}">
                <div class="bidly-widget-container">
                    <div class="bidly-widget-header">
                        <h3 class="bidly-widget-title">Live Auction</h3>
                        <div class="bidly-widget-status">
                            ${status === 'active' ? '<span class="bidly-status-active">● LIVE</span>' : 
                              status === 'pending' ? '<span class="bidly-status-pending">● STARTING SOON</span>' : 
                              '<span class="bidly-status-ended">● ENDED</span>'}
                        </div>
                        <div class="bidly-customer-info">
                            <span class="bidly-customer-name">👤 ${getCurrentCustomer()?.fullName || 'Guest User'}</span>
                            <button class="bidly-logout-btn" onclick="window.location.reload()" title="Logout">×</button>
                        </div>
                    </div>

                    ${show_timer && status === 'active' && endTime ? `
                        <div class="bidly-widget-timer">
                            <div class="bidly-timer-label">Ends In:</div>
                            <div class="bidly-countdown" data-end-time="${endTime}">
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
                            <span class="bidly-amount" data-current-bid="${currentBid}">$${currentBid.toFixed(2)}</span>
                        </div>
                        ${reservePrice > 0 ? `
                            <div class="bidly-reserve-price">
                                <span class="bidly-label">Reserve:</span>
                                <span class="bidly-amount">$${reservePrice.toFixed(2)}</span>
                            </div>
                        ` : ''}
                        <div class="bidly-bid-count">
                            <span class="bidly-label">Bids:</span>
                            <span class="bidly-count" data-bid-count="${bidCount}">${bidCount}</span>
                        </div>
                    </div>

                    ${status === 'active' ? `
                        <div class="bidly-widget-actions">
                            <div class="bidly-inline-bid-form" id="bidly-bid-form-${auctionId}">
                                <div class="bidly-bid-info">
                                    <div class="bidly-minimum-bid">
                                        <span class="bidly-label">Minimum Bid:</span>
                                        <span class="bidly-amount" data-min-bid="${Math.max(currentBid + 1, startingBid)}">$${Math.max(currentBid + 1, startingBid).toFixed(2)}</span>
                                    </div>
                                </div>
                                <form onsubmit="window.BidlyAuctionWidget.submitInlineBid(event, '${auctionId}')">
                                    <div class="bidly-bid-input-group">
                                        <input type="number" 
                                               id="bidly-bid-amount-${auctionId}" 
                                               name="amount" 
                                               step="0.01" 
                                               min="${Math.max(currentBid + 1, startingBid)}" 
                                               placeholder="Min: $${Math.max(currentBid + 1, startingBid).toFixed(2)}"
                                               required>
                                        <button type="submit" class="bidly-submit-bid">Place Bid</button>
                                        ${buyNowPrice > 0 ? `
                                            <button type="button" class="bidly-buy-now-btn" onclick="window.BidlyAuctionWidget.openBuyNowModal('${auctionId}', ${buyNowPrice})">
                                                Buy Now ($${buyNowPrice.toFixed(2)})
                                            </button>
                                        ` : ''}
                                    </div>
                                </form>
                        </div>
                    ` : status === 'pending' ? `
                        <div class="bidly-pending-message">
                            Auction will start soon. Check back later!
                        </div>
                    ` : `
                        <div class="bidly-ended-message">
                            Auction has ended. Final bid: $${currentBid.toFixed(2)}
                        </div>
                    `}

                    ${show_bid_history ? `
                        <div class="bidly-widget-footer">
                            <a href="#" onclick="window.BidlyAuctionWidget.openBidHistory('${auctionId}')" class="bidly-history-link">
                                View Bid History
                            </a>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Get product ID from page
    async function getProductIdFromPage() {
        console.log('Bidly: Debugging product ID detection...');
        console.log('Bidly: window.Shopify:', window.Shopify);
        console.log('Bidly: window.Shopify?.analytics:', window.Shopify?.analytics);
        console.log('Bidly: window.Shopify?.analytics?.meta:', window.Shopify?.analytics?.meta);
        console.log('Bidly: window.Shopify?.analytics?.meta?.product:', window.Shopify?.analytics?.meta?.product);

        // Try to get from Shopify global objects first (most reliable)
        if (window.Shopify?.analytics?.meta?.product?.id) {
            console.log('Bidly: Found product ID from analytics:', window.Shopify.analytics.meta.product.id);
            return window.Shopify.analytics.meta.product.id.toString();
        }

        // Try to get from product JSON script tag
        const productJson = document.querySelector('script[type="application/json"][data-product-json]');
        if (productJson) {
            try {
                const product = JSON.parse(productJson.textContent);
                console.log('Bidly: Found product from JSON script:', product);
                if (product.id) {
                    console.log('Bidly: Found product ID from JSON script:', product.id);
                    return product.id.toString();
                }
            } catch (e) {
                console.warn('Bidly: Error parsing product JSON for ID:', e);
            }
        }

        // Try to get from window.Shopify global object
        if (window.Shopify?.product?.id) {
            console.log('Bidly: Found product ID from window.Shopify.product:', window.Shopify.product.id);
            return window.Shopify.product.id.toString();
        }

        // Try to get from meta tags
        const productIdMeta = document.querySelector('meta[name="product-id"]');
        if (productIdMeta) {
            console.log('Bidly: Found product ID from meta tag:', productIdMeta.getAttribute('content'));
            return productIdMeta.getAttribute('content');
        }

        // Try to get from all script tags that might contain product data
        const allScripts = document.querySelectorAll('script[type="application/json"]');
        console.log('Bidly: Found', allScripts.length, 'JSON script tags');
        for (let i = 0; i < allScripts.length; i++) {
            const script = allScripts[i];
            try {
                const data = JSON.parse(script.textContent);
                console.log(`Bidly: Script ${i} data:`, data);
                if (data.product && data.product.id) {
                    console.log('Bidly: Found product ID from script tag:', data.product.id);
                    return data.product.id.toString();
                }
                // Also check for other possible structures
                if (data.id && typeof data.id === 'number') {
                    console.log('Bidly: Found numeric ID from script tag:', data.id);
                    return data.id.toString();
                }
            } catch (e) {
                console.log(`Bidly: Error parsing script ${i}:`, e.message);
            }
        }

        // Try to get from window.Shopify.routes
        if (window.Shopify?.routes?.root) {
            console.log('Bidly: window.Shopify.routes:', window.Shopify.routes);
        }

        // Last resort: try to get from URL (but this gives us the handle, not ID)
        const urlMatch = window.location.pathname.match(/\/products\/([^\/\?]+)/);
        if (urlMatch) {
            console.warn('Bidly: Got product handle from URL, not numeric ID:', urlMatch[1]);
            // Try to fetch product ID from Shopify API using the handle
            try {
                const handle = urlMatch[1];
                console.log('Bidly: Attempting to fetch product ID for handle:', handle);
                const response = await fetch(`https://${CONFIG.shopDomain}/products/${handle}.json`);
                if (response.ok) {
                    const productData = await response.json();
                    if (productData.product && productData.product.id) {
                        console.log('Bidly: Found product ID via API:', productData.product.id);
                        return productData.product.id.toString();
                    }
                }
            } catch (e) {
                console.warn('Bidly: Error fetching product ID via API:', e);
            }
            return null; // Don't use handle, we need numeric ID
        }

        console.log('Bidly: Could not find product ID from any source');
        return null;
    }

    // Check if product has auction data by fetching from backend API
    async function checkProductForAuction() {
        try {
            const productId = await getProductIdFromPage();
            if (!productId) {
                console.log('Bidly: Could not determine product ID');
                return { hasAuction: false };
            }

            console.log('Bidly: Checking for auction data for product ID:', productId);

            // Try to fetch auction data directly from backend API
            try {
                const apiUrl = `${CONFIG.backendUrl}/api/auctions/by-product/${productId}?shop=${CONFIG.shopDomain}`;
                console.log('Bidly: Fetching auction data from:', apiUrl);
                
                const response = await fetch(apiUrl);
                console.log('Bidly: API response status:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('Bidly: API response data:', data);
                    
                    if (data.success && data.auction) {
                        const auction = data.auction;
                        console.log('Bidly: Found auction data:', auction);
                        return {
                            hasAuction: true,
                            auctionId: auction._id,
                            status: auction.status || 'pending',
                            currentBid: parseFloat(auction.currentBid) || 0,
                            startingBid: parseFloat(auction.startingBid) || 0,
                            reservePrice: parseFloat(auction.reservePrice) || 0,
                            endTime: auction.endTime,
                            bidCount: auction.bidHistory?.length || 0,
                            buyNowPrice: parseFloat(auction.buyNowPrice) || 0
                        };
                    } else {
                        console.log('Bidly: API returned success but no auction data:', data);
                    }
                } else {
                    const errorText = await response.text();
                    console.log('Bidly: API error response:', response.status, errorText);
                }
            } catch (apiError) {
                console.warn('Bidly: Error fetching from API:', apiError);
            }

            return { hasAuction: false };
        } catch (error) {
            console.warn('Bidly: Error checking product for auction:', error);
            return { hasAuction: false };
        }
    }

    // Find pricing section to overlay widget - specifically the MAIN product price
    // VERSION: FIXED - Original styling restored, only smart pricing detection
    function findPricingSection() {
        console.log('Bidly: VERSION FIXED - Looking for MAIN product pricing section...');
        
        // Strategy 1: Look for the ENTIRE pricing section container (price + quantity + buttons)
        const pricingSectionSelectors = [
            '.product-form',
            '.product-form__price',
            '.product__form',
            '.product-single__form',
            '.product-form__buttons',
            '.product-form__actions',
            '.product-actions',
            '.product-buy',
            '.product-purchase',
            '.product-details',
            '.product-info',
            '.product-main',
            '.product-single',
            '.product-page'
        ];
        
        for (const selector of pricingSectionSelectors) {
            const elements = document.querySelectorAll(selector);
            console.log(`Bidly: Checking pricing section selector "${selector}": Found ${elements.length} elements`);
            
            for (const element of elements) {
                // Skip elements that are in "You may also like" or similar sections
                const isInRecommendationSection = element.closest('[class*="recommend"], [class*="related"], [class*="similar"], [class*="also"], [class*="suggest"], [class*="like"]');
                if (isInRecommendationSection) {
                    console.log(`Bidly: Skipping element in recommendation section: ${selector}`);
                    continue;
                }
                
                const rect = element.getBoundingClientRect();
                const computedStyle = window.getComputedStyle(element);
                
                // Skip hidden elements
                if (computedStyle.display === 'none' || 
                    computedStyle.visibility === 'hidden' || 
                    computedStyle.opacity === '0' ||
                    element.style.display === 'none') {
                    continue;
                }
                
                // Look for elements that contain price, quantity, and buttons (the ENTIRE pricing section)
                const hasPrice = element.querySelector('.price, [class*="price"], [class*="cost"], [class*="amount"]');
                const hasQuantity = element.querySelector('input[type="number"], .quantity, [class*="quantity"]');
                const hasButtons = element.querySelector('button, .btn, [class*="button"], [class*="add-to-cart"], [class*="buy"]');
                
                if (hasPrice && (hasQuantity || hasButtons) && rect.width > 200 && rect.height > 50) {
                    console.log('Bidly: Found ENTIRE pricing section container:', element, rect);
                    return element;
                }
            }
        }
        
        // Strategy 2: Look for product form containers (but exclude "You may also like" sections)
        const productFormSelectors = [
            '.product-form',
            '.product-form__price',
            '.product__form',
            '.product-single__form',
            '.product-form__buttons',
            '.product-form__actions',
            '.product-actions',
            '.product-buy',
            '.product-purchase'
        ];
        
        for (const selector of productFormSelectors) {
            const elements = document.querySelectorAll(selector);
            console.log(`Bidly: Checking product form selector "${selector}":`, elements);
            
            for (const element of elements) {
                // Skip elements that are in "You may also like" or similar sections
                const isInRecommendationSection = element.closest('[class*="recommend"], [class*="related"], [class*="similar"], [class*="also"], [class*="suggest"], [class*="like"]');
                if (isInRecommendationSection) {
                    console.log(`Bidly: Skipping element in recommendation section: ${selector}`);
                    continue;
                }
                
                const text = element.textContent || element.innerText || '';
                const rect = element.getBoundingClientRect();
                const computedStyle = window.getComputedStyle(element);
                
                // Skip hidden elements
                if (computedStyle.display === 'none' || 
                    computedStyle.visibility === 'hidden' || 
                    computedStyle.opacity === '0' ||
                    element.style.display === 'none') {
                    continue;
                }
                
                // Look for elements with actual price values and visible dimensions
                if (text.includes('$') && !text.includes('$0.00') && rect.width > 0 && rect.height > 0 && rect.top > 0 && rect.left >= 0) {
                    console.log('Bidly: Found valid main product pricing element:', element);
                    return element;
                }
            }
        }
        
        // Strategy 3: Look for price elements but exclude those in bottom sections
        console.log('Bidly: Looking for price elements, excluding bottom sections...');
        const allPriceElements = document.querySelectorAll('.price, [class*="price"], [class*="cost"], [class*="amount"]');
        
        for (const element of allPriceElements) {
            const text = element.textContent || element.innerText || '';
            const rect = element.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(element);
            
            // Skip hidden elements
            if (computedStyle.display === 'none' || 
                computedStyle.visibility === 'hidden' || 
                computedStyle.opacity === '0' ||
                element.style.display === 'none') {
                continue;
            }
            
            // Skip elements in recommendation/related sections
            const isInRecommendationSection = element.closest('[class*="recommend"], [class*="related"], [class*="similar"], [class*="also"], [class*="suggest"], [class*="like"]');
            if (isInRecommendationSection) {
                console.log(`Bidly: Skipping price in recommendation section: "${text}"`);
                continue;
            }
            
            // Skip elements that are too far down the page (likely in "You may also like")
            const viewportHeight = window.innerHeight;
            if (rect.top > viewportHeight * 0.7) { // Skip if in bottom 30% of viewport
                console.log(`Bidly: Skipping price too far down: "${text}" at ${rect.top}px`);
                continue;
            }
            
            // Look for elements with actual price values and visible dimensions
            if (text.includes('$') && !text.includes('$0.00') && rect.width > 0 && rect.height > 0 && rect.top > 0 && rect.left >= 0) {
                console.log('Bidly: Found main product price element:', element, rect);
                return element;
            }
        }
        
        console.warn('Bidly: No main product pricing section found');
        return null;
    }

    // Inject widget into pricing section
    function injectWidget(auctionData, settings) {
        // Check if we have valid auction data
        if (!auctionData || !auctionData.hasAuction) {
            console.log('Bidly: No auction data available, not injecting widget');
            return;
        }
        
        const pricingSection = findPricingSection();
        
        // Remove existing widget if any
        const existingWidget = document.querySelector(`.${CONFIG.widgetClass}`);
        if (existingWidget) {
            existingWidget.remove();
        }

        // Create widget container
        const widgetContainer = document.createElement('div');
        widgetContainer.className = CONFIG.widgetClass;
        widgetContainer.innerHTML = createWidgetHTML(auctionData, settings);
        
        // Add transparent overlay styling - no white background
        widgetContainer.style.cssText = `
            background: transparent !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            z-index: 99999 !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
        `;
        
        // Create the actual auction widget content
        widgetContainer.innerHTML = createWidgetHTML(auctionData, settings);
        
        // Set initial positioning properties (will be overridden by dynamic positioning)
        widgetContainer.style.position = 'absolute';
        widgetContainer.style.width = 'auto';
        widgetContainer.style.height = 'auto';
        widgetContainer.style.minHeight = 'auto';
        
        console.log('Bidly: Widget container created and styled:', widgetContainer);

        // Position widget to overlay on the pricing section
        console.log('Bidly: Positioning widget to overlay on pricing section');
        console.log('Bidly: Pricing section found:', pricingSection);
        
        if (pricingSection) {
            // Calculate position relative to pricing section for overlay
            const pricingRect = pricingSection.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            
            console.log('Bidly: Pricing section rect:', pricingRect);
            console.log('Bidly: Scroll position:', { scrollTop, scrollLeft });
            
            // Log detailed rect information
            console.log('Bidly: Detailed rect info:', {
                top: pricingRect.top,
                left: pricingRect.left,
                right: pricingRect.right,
                bottom: pricingRect.bottom,
                width: pricingRect.width,
                height: pricingRect.height,
                x: pricingRect.x,
                y: pricingRect.y
            });
            
            // Check if the pricing element has valid coordinates
            let finalTop, finalLeft, finalWidth, finalHeight;
            
            if (pricingRect.top === 0 && pricingRect.left === 0 && pricingRect.width === 0) {
                console.log('Bidly: Pricing element has zero coordinates, trying parent container...');
                
                // Try to find the parent container that has valid coordinates
                let parentElement = pricingSection.parentElement;
                let attempts = 0;
                const maxAttempts = 5;
                
                while (parentElement && attempts < maxAttempts) {
                    const parentRect = parentElement.getBoundingClientRect();
                    console.log(`Bidly: Parent ${attempts + 1} rect:`, parentRect);
                    
                    if (parentRect.width > 0 && parentRect.height > 0 && (parentRect.top > 0 || parentRect.left > 0)) {
                        console.log(`Bidly: Found valid parent container at attempt ${attempts + 1}`);
                        finalTop = parentRect.top + scrollTop;
                        finalLeft = parentRect.left + scrollLeft;
                        finalWidth = parentRect.width;
                        finalHeight = parentRect.height;
                        break;
                    }
                    
                    parentElement = parentElement.parentElement;
                    attempts++;
                }
                
                // If no valid parent found, use fallback positioning
                if (attempts >= maxAttempts || !parentElement) {
                    console.log('Bidly: No valid parent found, using fallback positioning');
                    finalTop = 200 + scrollTop; // Position below header, accounting for scroll
                    finalLeft = 20 + scrollLeft; // Position from left edge, accounting for scroll
                    finalWidth = 400; // Reasonable fallback width
                    finalHeight = 200; // Reasonable fallback height
                }
            } else {
                // Use the pricing element's coordinates - EXACT replacement
                finalTop = pricingRect.top + scrollTop;
                finalLeft = pricingRect.left + scrollLeft;
                finalWidth = pricingRect.width;
                finalHeight = pricingRect.height;
            }
            
            console.log('Bidly: Calculated positions:', {
                finalTop,
                finalLeft,
                finalWidth,
                pricingRectTop: pricingRect.top,
                pricingRectLeft: pricingRect.left,
                scrollTop,
                scrollLeft
            });
            
        // Position widget to replace the pricing section (STABLE POSITIONING)
        // Add some offset to move widget down and avoid covering the title
        const titleOffset = 40; // Add 40px offset to move widget below title
        
        console.log('Bidly: Using STABLE positioning - widget will stay in place');
        
        // Use absolute positioning relative to the document to prevent scrolling issues
        widgetContainer.style.position = 'absolute';
        widgetContainer.style.top = (pricingRect.top + scrollTop + titleOffset) + 'px';
        widgetContainer.style.left = (pricingRect.left + scrollLeft) + 'px';
        widgetContainer.style.width = Math.max(400, pricingRect.width) + 'px'; // Minimum 400px width
        widgetContainer.style.height = Math.max(300, pricingRect.height) + 'px'; // Minimum 300px height
        widgetContainer.style.minHeight = 'auto';
        widgetContainer.style.zIndex = '9999';
            
            // Hide only specific pricing elements, not the entire container
            // This prevents hiding the product title
            const elementsToHide = pricingSection.querySelectorAll(
                '.price, .product-price, .money, button, .btn, [class*="button"], [class*="add-to-cart"], [class*="buy"], [class*="quantity"], [class*="price-current"], [class*="price-regular"]'
            );
            
            elementsToHide.forEach(element => {
                element.style.display = 'none';
            });
            
            // Only hide the pricing section if it's ONLY a price element (not a container)
            // Check if it's a direct price element, not a container with other content
            const isDirectPriceElement = pricingSection.classList.contains('price') && 
                                       !pricingSection.querySelector('h1, h2, h3, h4, h5, h6, .product-title, .product-name, [class*="title"], [class*="name"]');
            
            if (isDirectPriceElement) {
                pricingSection.style.display = 'none';
            }
            
            console.log('Bidly: Original pricing section and related elements hidden');
            
            console.log('Bidly: Widget positioned to overlay on pricing section');
            console.log('Bidly: Applied styles:', {
                position: widgetContainer.style.position,
                top: widgetContainer.style.top,
                left: widgetContainer.style.left,
                width: widgetContainer.style.width
            });
        } else {
            // Fallback positioning if pricing section not found
            widgetContainer.style.position = 'fixed';
            widgetContainer.style.top = '200px'; // Position below header
            widgetContainer.style.left = '50%';
            widgetContainer.style.transform = 'translateX(-50%)'; // Center horizontally
            widgetContainer.style.width = '400px'; // Reasonable fallback width
            widgetContainer.style.height = '300px'; // Reasonable fallback height
            widgetContainer.style.minHeight = 'auto'; // Remove minHeight
            widgetContainer.style.zIndex = '9999';
            console.log('Bidly: Pricing section not found, using centered fallback positioning');
        }
        
        // Ensure body has relative positioning for absolute children
        if (document.body.style.position !== 'relative') {
            document.body.style.position = 'relative';
        }
        
        document.body.appendChild(widgetContainer);
        console.log('Bidly: Widget appended to document.body');
        
        console.log('Bidly: Widget injection complete. Widget element:', widgetContainer);
        
        // More detailed visibility checks
        const widgetElement = document.querySelector(`.${CONFIG.widgetClass}`);
        if (widgetElement) {
            const computedStyle = window.getComputedStyle(widgetElement);
            console.log('Bidly: Widget computed style - display:', computedStyle.display);
            console.log('Bidly: Widget computed style - visibility:', computedStyle.visibility);
            console.log('Bidly: Widget computed style - opacity:', computedStyle.opacity);
            console.log('Bidly: Widget computed style - width:', computedStyle.width);
            console.log('Bidly: Widget computed style - height:', computedStyle.height);
            console.log('Bidly: Widget offsetParent:', widgetElement.offsetParent);
            console.log('Bidly: Widget offsetWidth:', widgetElement.offsetWidth);
            console.log('Bidly: Widget offsetHeight:', widgetElement.offsetHeight);

            let parent = widgetElement.parentElement;
            let depth = 0;
            while (parent && depth < 5) { // Check up to 5 parent levels
                const parentComputedStyle = window.getComputedStyle(parent);
                console.log(`Bidly: Parent ${depth} (${parent.tagName}) computed style - display:`, parentComputedStyle.display);
                console.log(`Bidly: Parent ${depth} (${parent.tagName}) computed style - visibility:`, parentComputedStyle.visibility);
                console.log(`Bidly: Parent ${depth} (${parent.tagName}) computed style - opacity:`, parentComputedStyle.opacity);
                if (parentComputedStyle.display === 'none' || parentComputedStyle.visibility === 'hidden' || parentComputedStyle.opacity === '0') {
                    console.warn(`Bidly: Parent ${depth} (${parent.tagName}) is hiding the widget!`);
                    break;
                }
                parent = parent.parentElement;
                depth++;
            }
        }
        
        console.log('Bidly: Widget is visible:', widgetContainer.offsetParent !== null);

        // Initialize countdown timer if active
        if (auctionData.status === 'active' && auctionData.endTime && settings.show_timer) {
            initializeCountdown(auctionData.auctionId, auctionData.endTime);
        }

        // Initialize real-time updates
        initializeRealTimeUpdates(auctionData.auctionId);
    }

    // Initialize countdown timer
    function initializeCountdown(auctionId, endTime) {
        const countdownElement = document.querySelector(`#bidly-auction-widget-${auctionId} .bidly-countdown`);
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

    // Initialize real-time updates via WebSocket
    let socket = null;
    let pollingInterval = null;
    
    function initializeRealTimeUpdates(auctionId) {
        console.log('Bidly: Initializing real-time updates for auction:', auctionId);
        
        // Connect to WebSocket if not already connected
        if (!socket && window.io) {
            console.log('Bidly: Connecting to WebSocket for real-time updates...');
            socket = io(CONFIG.backendUrl, {
                transports: ['websocket', 'polling'],
                timeout: 20000,
                forceNew: true
            });
            
            socket.on('connect', () => {
                console.log('Bidly: WebSocket connected');
                // Join auction room for real-time updates
                socket.emit('join-auction', auctionId);
            });
            
            socket.on('disconnect', () => {
                console.log('Bidly: WebSocket disconnected');
            });
            
            socket.on('bid-placed', (data) => {
                console.log('Bidly: Real-time bid update received:', data);
                if (data.auctionId === auctionId) {
                    updateWidgetData(auctionId, data.auction);
                    
                    // Get bidder information and product title for notification
                    let latestBidder = null;
                    let productTitle = 'this item';
                    
                    if (data.auction.bidHistory && data.auction.bidHistory.length > 0) {
                        const latestBid = data.auction.bidHistory[data.auction.bidHistory.length - 1];
                        latestBidder = latestBid.bidder;
                    }
                    
                    const productTitleElement = document.querySelector('h1.product-title, h1.product__title, .product-single__title, h1');
                    if (productTitleElement) {
                        productTitle = productTitleElement.textContent.trim();
                    }
                    
                    // Show notification for new bids
                    showBidNotification(data.auction.currentBid, data.auction.bidHistory?.length || 0, latestBidder, productTitle);
                }
            });
            
            socket.on('auction-updated', (data) => {
                console.log('Bidly: Real-time auction update received:', data);
                if (data.auctionId === auctionId) {
                    updateWidgetData(auctionId, data.auction);
                }
            });
            
            socket.on('error', (error) => {
                console.error('Bidly: WebSocket error:', error);
            });
            
            socket.on('connect_error', (error) => {
                console.warn('Bidly: WebSocket connection error:', error);
            });
        } else if (!window.io) {
            console.warn('Bidly: Socket.IO not available, using polling only');
        }
        
        // Always use polling as fallback/primary method
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }
        
        // Store previous auction data to detect changes
        let previousAuctionData = null;
        
        pollingInterval = setInterval(async () => {
            try {
                console.log('Bidly: Polling for auction updates...', auctionId);
                const response = await fetch(`${CONFIG.backendUrl}/api/auctions/${auctionId}?shop=${CONFIG.shopDomain}`);
                console.log('Bidly: Polling response status:', response.status);
                
                if (!response.ok) {
                    console.warn('Bidly: Polling response not ok:', response.status);
                    return;
                }

                const data = await response.json();
                console.log('Bidly: Polling response data:', data);
                
                let auctionData = null;
                if (data.success && data.auction) {
                    auctionData = data.auction;
                    console.log('Bidly: Polling update received:', auctionData);
                } else if (data.success && data.data) {
                    // Handle different response format
                    auctionData = data.data;
                    console.log('Bidly: Polling update received (data format):', auctionData);
                } else {
                    console.warn('Bidly: Polling response format unexpected:', data);
                    return;
                }
                
                // Check for bid changes and show notification
                if (previousAuctionData && auctionData) {
                    const previousBidCount = previousAuctionData.bidHistory?.length || previousAuctionData.bidCount || 0;
                    const currentBidCount = auctionData.bidHistory?.length || auctionData.bidCount || 0;
                    const previousCurrentBid = previousAuctionData.currentBid || previousAuctionData.startingBid || 0;
                    const currentCurrentBid = auctionData.currentBid || auctionData.startingBid || 0;
                    
                    // Show notification if bid count increased or current bid increased significantly
                    if (currentBidCount > previousBidCount || currentCurrentBid > previousCurrentBid) {
                        console.log('Bidly: New bid detected! Showing notification...');
                        
                        // Get the latest bidder information
                        let latestBidder = null;
                        let productTitle = 'this item';
                        
                        if (auctionData.bidHistory && auctionData.bidHistory.length > 0) {
                            const latestBid = auctionData.bidHistory[auctionData.bidHistory.length - 1];
                            latestBidder = latestBid.bidder;
                        }
                        
                        // Try to get product title from the page
                        const productTitleElement = document.querySelector('h1.product-title, h1.product__title, .product-single__title, h1');
                        if (productTitleElement) {
                            productTitle = productTitleElement.textContent.trim();
                        }
                        
                        showBidNotification(currentCurrentBid, currentBidCount, latestBidder, productTitle);
                    }
                }
                
                // Update widget with new data
                updateWidgetData(auctionId, auctionData);
                
                // Store current data for next comparison
                previousAuctionData = auctionData;
                
            } catch (error) {
                console.warn('Bidly: Error updating auction data:', error);
            }
        }, 2000); // Even more frequent polling for testing
        
        // Clean up polling when widget is removed
        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
            if (socket) {
                socket.disconnect();
                socket = null;
            }
        };
    }

    // Update widget data in real-time
    function updateWidgetData(auctionId, auctionData) {
        console.log('Bidly: Updating widget data for auction:', auctionId, auctionData);
        
        const widget = document.querySelector(`#bidly-auction-widget-${auctionId}`);
        if (!widget) {
            console.warn('Bidly: Widget not found for auction:', auctionId);
            return;
        }

        console.log('Bidly: Found widget element:', widget);

        // Update current bid - try multiple selectors
        let currentBidElement = widget.querySelector('[data-current-bid]');
        if (!currentBidElement) {
            currentBidElement = widget.querySelector('.bidly-amount');
        }
        
        if (currentBidElement) {
            const newBid = auctionData.currentBid || auctionData.startingBid || 0;
            currentBidElement.textContent = `$${newBid.toFixed(2)}`;
            currentBidElement.setAttribute('data-current-bid', newBid);
            console.log('Bidly: Updated current bid to:', newBid, 'Element:', currentBidElement);
        } else {
            console.warn('Bidly: Current bid element not found');
        }

        // Update minimum bid - try multiple selectors
        let minBidElement = widget.querySelector('[data-min-bid]');
        if (!minBidElement) {
            minBidElement = widget.querySelector('.bidly-minimum-bid .bidly-amount');
        }
        
        if (minBidElement) {
            // Calculate minimum bid as current bid + $1 minimum increment
            const currentBid = auctionData.currentBid || auctionData.startingBid || 0;
            const startingBid = auctionData.startingBid || 0;
            const minBid = Math.max(currentBid + 1, startingBid);
            minBidElement.textContent = `$${minBid.toFixed(2)}`;
            minBidElement.setAttribute('data-min-bid', minBid);
            console.log('Bidly: Updated minimum bid to:', minBid, 'Element:', minBidElement);
        } else {
            console.warn('Bidly: Minimum bid element not found');
        }

        // Update bid count - try multiple selectors
        let bidCountElement = widget.querySelector('[data-bid-count]');
        if (!bidCountElement) {
            bidCountElement = widget.querySelector('.bidly-count');
        }
        
        if (bidCountElement) {
            const bidCount = auctionData.bidHistory?.length || auctionData.bidCount || 0;
            bidCountElement.textContent = bidCount;
            bidCountElement.setAttribute('data-bid-count', bidCount);
            console.log('Bidly: Updated bid count to:', bidCount, 'Element:', bidCountElement);
        } else {
            console.warn('Bidly: Bid count element not found');
        }

        // Update status if changed
        if (auctionData.status !== 'active') {
            const statusElement = widget.querySelector('.bidly-widget-status');
            if (statusElement) {
                statusElement.innerHTML = auctionData.status === 'ended' ? 
                    '<span class="bidly-status-ended">● ENDED</span>' : 
                    '<span class="bidly-status-pending">● PENDING</span>';
                console.log('Bidly: Updated status to:', auctionData.status);
            }
            
            // Disable bidding if auction ended
            const bidButton = widget.querySelector('.bidly-bid-btn');
            if (bidButton && auctionData.status === 'ended') {
                bidButton.disabled = true;
                bidButton.textContent = 'Auction Ended';
                bidButton.style.opacity = '0.5';
            }
            
            // Update inline bid form if it exists
            const bidForm = widget.querySelector('.bidly-inline-bid-form');
            if (bidForm) {
                const bidInput = bidForm.querySelector('input[type="number"]');
                const submitButton = bidForm.querySelector('.bidly-submit-bid');
                
                if (bidInput) {
                    // Update minimum value for the input - use current bid + $1 minimum increment
                    const currentBid = auctionData.currentBid || auctionData.startingBid || 0;
                    const startingBid = auctionData.startingBid || 0;
                    const newMinBid = Math.max(currentBid + 1, startingBid);
                    bidInput.min = newMinBid;
                    bidInput.placeholder = `Min: $${newMinBid.toFixed(2)}`;
                }
                
                // Disable form if auction ended
                if (auctionData.status === 'ended') {
                    if (bidInput) {
                        bidInput.disabled = true;
                        bidInput.placeholder = 'Auction Ended';
                    }
                    if (submitButton) {
                        submitButton.disabled = true;
                        submitButton.textContent = 'Auction Ended';
                        submitButton.style.opacity = '0.5';
                    }
                } else {
                    if (bidInput) {
                        bidInput.disabled = false;
                    }
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'Place Bid';
                        submitButton.style.opacity = '1';
                    }
                }
            }
        }

        // Update timer if auction is active
        if (auctionData.status === 'active' && auctionData.endTime) {
            const countdownElement = widget.querySelector('.bidly-countdown');
            if (countdownElement) {
                const endTimestamp = new Date(auctionData.endTime).getTime();
                const now = new Date().getTime();
                const distance = endTimestamp - now;

                if (distance > 0) {
                    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                    countdownElement.innerHTML = `
                        <span class="bidly-time-unit">${days}d</span>
                        <span class="bidly-time-unit">${hours}h</span>
                        <span class="bidly-time-unit">${minutes}m</span>
                        <span class="bidly-time-unit">${seconds}s</span>
                    `;
                } else {
                    countdownElement.innerHTML = '<span class="bidly-time-unit">Auction Ended</span>';
                }
            }
        }

        console.log('Bidly: Widget data update complete');
    }

    // Show bid notification
    function showBidNotification(currentBid, bidCount, bidderName = null, productTitle = null) {
        // Remove existing notification
        const existingNotification = document.querySelector('.bidly-bid-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification
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
            z-index: 100000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;
        
        // Handle different message types
        let messageContent = '';
        if (typeof bidCount === 'string') {
            // Custom message (like "New bid placed!")
            messageContent = `
                <div style="font-weight: bold; margin-bottom: 5px;">${bidCount}</div>
                <div>Current Bid: $${currentBid.toFixed(2)}</div>
            `;
        } else if (bidderName && productTitle) {
            // Enhanced notification with bidder name and product
            const firstName = bidderName.split(' ')[0]; // Get first name only
            messageContent = `
                <div style="font-weight: bold; margin-bottom: 5px;">${firstName} bid $${currentBid.toFixed(2)} on ${productTitle}</div>
                <div style="font-size: 12px; opacity: 0.9;">Total Bids: ${bidCount}</div>
            `;
        } else {
            // Standard bid notification
            messageContent = `
                <div style="font-weight: bold; margin-bottom: 5px;">New Bid Placed!</div>
                <div>Current Bid: $${currentBid.toFixed(2)}</div>
                <div>Total Bids: ${bidCount}</div>
            `;
        }
        
        notification.innerHTML = messageContent;

        // Add animation CSS
        if (!document.querySelector('#bidly-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'bidly-notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideIn 0.3s ease-out reverse';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }


    // Create bid modal
    function createBidModal(auctionId) {
        // Check if user is logged in
        if (!isUserLoggedIn() || !getCurrentCustomer()) {
            alert('Please log in to place a bid');
            return;
        }
        
        const customer = getCurrentCustomer();
        const modal = document.createElement('div');
        modal.className = 'bidly-modal-overlay';
        modal.innerHTML = `
            <div class="bidly-modal-content">
                <div class="bidly-modal-header">
                    <h3>Place Your Bid</h3>
                    <button class="bidly-modal-close" onclick="window.BidlyAuctionWidget.closeBidModal('${auctionId}')">&times;</button>
                </div>
                <div class="bidly-modal-body">
                    <div class="bidly-bidder-info">
                        <p><strong>Bidding as:</strong> ${customer.fullName}</p>
                        <p><strong>Email:</strong> ${customer.email}</p>
                    </div>
                    <form id="bidly-bid-form-${auctionId}" onsubmit="window.BidlyAuctionWidget.submitBid(event, '${auctionId}')">
                        <div class="bidly-form-group">
                            <label for="bidly-bid-amount-${auctionId}">Bid Amount</label>
                            <input type="number" id="bidly-bid-amount-${auctionId}" name="amount" step="0.01" required>
                            <small>Enter your bid amount</small>
                        </div>
                        <div class="bidly-form-actions">
                            <button type="submit" class="bidly-submit-bid">Place Bid</button>
                            <button type="button" onclick="window.BidlyAuctionWidget.closeBidModal('${auctionId}')">Cancel</button>
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
                    <button class="bidly-modal-close" onclick="window.BidlyAuctionWidget.closeBuyNowModal('${auctionId}')">&times;</button>
                </div>
                <div class="bidly-modal-body">
                    <p>Are you sure you want to buy this item for <strong>$${price.toFixed(2)}</strong>?</p>
                    <p>This will end the auction immediately and you will be the winner.</p>
                    <div class="bidly-form-actions">
                        <button onclick="window.BidlyAuctionWidget.confirmBuyNow('${auctionId}', ${price})" class="bidly-confirm-buy">Yes, Buy Now</button>
                        <button onclick="window.BidlyAuctionWidget.closeBuyNowModal('${auctionId}')">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        return modal;
    }

    // Global widget object
    window.BidlyAuctionWidget = {
        inject: injectWidget,
        
        openBidModal: function(auctionId) {
            const modal = createBidModal(auctionId);
            document.body.appendChild(modal);
            modal.style.display = 'flex';
        },

        openBuyNowModal: function(auctionId, price) {
            const modal = createBuyNowModal(auctionId, price);
            document.body.appendChild(modal);
            modal.style.display = 'flex';
        },

        openBidHistory: async function(auctionId) {
            try {
                // Fetch bid history from backend
                const response = await fetch(`${CONFIG.backendUrl}/api/auctions/${auctionId}?shop=${CONFIG.shopDomain}`);
                if (!response.ok) {
                    alert('Failed to load bid history');
                    return;
                }
                
                const data = await response.json();
                if (!data.success || !data.data) {
                    alert('No bid history available');
                    return;
                }
                
                const auction = data.data;
                const bidHistory = auction.bidHistory || [];
                
                // Create modal HTML
                const modalHtml = `
                    <div class="bidly-modal-overlay">
                        <div class="bidly-modal-content bidly-history-modal">
                            <div class="bidly-modal-header">
                                <h3>Bid History</h3>
                                <span class="bidly-modal-close">&times;</span>
                            </div>
                            <div class="bidly-modal-body">
                                <div class="bidly-bid-history">
                                    ${bidHistory.length === 0 ? 
                                        '<p class="bidly-no-bids">No bids placed yet</p>' :
                                        bidHistory.map((bid, index) => `
                                            <div class="bidly-bid-item ${index === bidHistory.length - 1 ? 'bidly-current-bid' : ''}">
                                                <div class="bidly-bid-info">
                                                    <span class="bidly-bidder">${bid.bidder}</span>
                                                    <span class="bidly-bid-time">${new Date(bid.timestamp).toLocaleString()}</span>
                                                </div>
                                                <div class="bidly-bid-amount">$${bid.amount.toFixed(2)}</div>
                                            </div>
                                        `).join('')
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Add modal to page
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                
                // Add close functionality
                const modal = document.querySelector('.bidly-modal-overlay');
                modal.querySelector('.bidly-modal-close').addEventListener('click', () => modal.remove());
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) modal.remove();
                });
                
            } catch (error) {
                console.error('Error loading bid history:', error);
                alert('Failed to load bid history');
            }
        },

        closeBidModal: function(auctionId) {
            const modal = document.querySelector(`#bidly-bid-form-${auctionId}`).closest('.bidly-modal-overlay');
            if (modal) {
                modal.remove();
            }
        },

        closeBuyNowModal: function(auctionId) {
            const modal = document.querySelector(`[onclick*="confirmBuyNow('${auctionId}'"]`).closest('.bidly-modal-overlay');
            if (modal) {
                modal.remove();
            }
        },

        submitBid: async function(event, auctionId) {
            event.preventDefault();
            
            // Check if user is logged in
            if (!isUserLoggedIn() || !getCurrentCustomer()) {
                alert('Please log in to place a bid');
                return;
            }
            
            const customer = getCurrentCustomer();
            const form = event.target;
            const formData = new FormData(form);
            
            const bidData = {
                amount: parseFloat(formData.get('amount')),
                bidder: customer.fullName,
                bidderEmail: customer.email
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
                    // Update customer bid history
                    await fetch(`${CONFIG.backendUrl}/api/customers/${customer.id}/bid?shop=${CONFIG.shopDomain}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            auctionId,
                            amount: bidData.amount,
                            isWinning: result.isWinning || false
                        })
                    });
                    
                    alert('Bid placed successfully!');
                    this.closeBidModal(auctionId);
                    
                    // Show immediate notification for the bid just placed
                    console.log('Bidly: Showing notification for bid just placed');
                    
                    // Get product title for the notification
                    let productTitle = 'this item';
                    const productTitleElement = document.querySelector('h1.product-title, h1.product__title, .product-single__title, h1');
                    if (productTitleElement) {
                        productTitle = productTitleElement.textContent.trim();
                    }
                    
                    showBidNotification(bidData.amount, 'New bid placed!', customer.fullName, productTitle);
                    
                    // Trigger immediate real-time update
                    console.log('Bidly: Triggering immediate update after bid placement');
                    
                    // Refresh widget content instead of reloading page
                    const existingWidget = document.querySelector('.bidly-auction-app-embed');
                    if (existingWidget && window.currentAuctionCheck) {
                        const settings = {
                            show_timer: true,
                            show_bid_history: true,
                            widget_position: 'below_price'
                        };
                        refreshWidgetContent(existingWidget, window.currentAuctionCheck, settings);
                    }
                    
                    // Also trigger a manual update via polling
                    setTimeout(async () => {
                        try {
                            const response = await fetch(`${CONFIG.backendUrl}/api/auctions/${auctionId}?shop=${CONFIG.shopDomain}`);
                            if (response.ok) {
                                const data = await response.json();
                                if (data.success && data.auction) {
                                    updateWidgetData(auctionId, data.auction);
                                }
                            }
                        } catch (error) {
                            console.warn('Bidly: Error in manual update after bid:', error);
                        }
                    }, 1000);
                } else {
                    alert('Error placing bid: ' + result.message);
                }
            } catch (error) {
                console.error('Error placing bid:', error);
                alert('Error placing bid. Please try again.');
            }
        },

        submitInlineBid: async function(event, auctionId) {
            event.preventDefault();
            
            // Check if user is logged in
            if (!isUserLoggedIn() || !getCurrentCustomer()) {
                alert('Please log in to place a bid');
                return;
            }
            
            const customer = getCurrentCustomer();
            const form = event.target;
            const formData = new FormData(form);
            const bidAmount = parseFloat(formData.get('amount'));
            
            if (isNaN(bidAmount) || bidAmount <= 0) {
                alert('Please enter a valid bid amount.');
                return;
            }

            const bidData = {
                amount: bidAmount,
                bidder: customer.fullName,
                bidderEmail: customer.email,
                customerId: customer.id,
                shopDomain: CONFIG.shopDomain
            };

            try {
                const response = await fetch(`${CONFIG.backendUrl}/api/auctions/${auctionId}/bid`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(bidData)
                });

                const result = await response.json();

                if (result.success) {
                    // Update customer's bid history in your DB
                    await fetch(`${CONFIG.backendUrl}/api/customers/${customer.id}/bid?shop=${CONFIG.shopDomain}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            auctionId: auctionId,
                            amount: bidData.amount,
                            isWinning: result.isWinning || false
                        })
                    });
                    
                    // Clear the input field
                    const inputField = document.getElementById(`bidly-bid-amount-${auctionId}`);
                    if (inputField) {
                        inputField.value = '';
                    }
                    
                    // Show immediate notification for the bid just placed
                    console.log('Bidly: Showing notification for bid just placed');
                    
                    // Get product title for the notification
                    let productTitle = 'this item';
                    const productTitleElement = document.querySelector('h1.product-title, h1.product__title, .product-single__title, h1');
                    if (productTitleElement) {
                        productTitle = productTitleElement.textContent.trim();
                    }
                    
                    showBidNotification(bidData.amount, 'New bid placed!', customer.fullName, productTitle);
                    
                    // Trigger immediate real-time update
                    console.log('Bidly: Triggering immediate update after bid placement');
                    
                    // Refresh widget content instead of reloading page
                    const existingWidget = document.querySelector('.bidly-auction-app-embed');
                    if (existingWidget && window.currentAuctionCheck) {
                        const settings = {
                            show_timer: true,
                            show_bid_history: true,
                            widget_position: 'below_price'
                        };
                        refreshWidgetContent(existingWidget, window.currentAuctionCheck, settings);
                    }
                    
                    // Also trigger a manual update via polling
                    setTimeout(async () => {
                        try {
                            const response = await fetch(`${CONFIG.backendUrl}/api/auctions/${auctionId}?shop=${CONFIG.shopDomain}`);
                            if (response.ok) {
                                const data = await response.json();
                                if (data.success && data.auction) {
                                    updateWidgetData(auctionId, data.auction);
                                }
                            }
                        } catch (error) {
                            console.warn('Bidly: Error in manual update after bid:', error);
                        }
                    }, 1000);
                } else {
                    alert('Error placing bid: ' + result.message);
                }
            } catch (error) {
                console.error('Error placing bid:', error);
                alert('Error placing bid. Please try again.');
            }
        },

        confirmBuyNow: async function(auctionId, price) {
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
                    this.closeBuyNowModal(auctionId);
                    location.reload();
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (error) {
                console.error('Error buying now:', error);
                alert('Error completing purchase. Please try again.');
            }
        },

        // Test function for debugging real-time updates
        testRealTimeUpdate: function(auctionId) {
            console.log('Bidly: Testing real-time update for auction:', auctionId);
            
            // Simulate auction data update
            const testAuctionData = {
                auctionId: auctionId,
                currentBid: Math.random() * 1000 + 100, // Random bid between 100-1100
                bidCount: Math.floor(Math.random() * 10) + 1, // Random bid count 1-10
                status: 'active',
                endTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
                startingBid: 100,
                minimumBid: 100
            };
            
            console.log('Bidly: Test auction data:', testAuctionData);
            updateWidgetData(auctionId, testAuctionData);
            
            // Also show notification with test bidder name
            const testBidderNames = ['John', 'Sarah', 'Mike', 'Emma', 'Alex', 'Lisa', 'David', 'Anna'];
            const randomBidder = testBidderNames[Math.floor(Math.random() * testBidderNames.length)];
            
            let productTitle = 'this item';
            const productTitleElement = document.querySelector('h1.product-title, h1.product__title, .product-single__title, h1');
            if (productTitleElement) {
                productTitle = productTitleElement.textContent.trim();
            }
            
            showBidNotification(testAuctionData.currentBid, testAuctionData.bidCount, randomBidder, productTitle);
        },

        // Manual update function for testing
        updateWidgetData: updateWidgetData
    };

    // Wait for pricing section to become visible
    async function waitForPricingSection() {
        console.log('Bidly: Waiting for pricing section to become visible...');
        
        let attempts = 0;
        const maxAttempts = 20; // Try for up to 10 seconds
        
        while (attempts < maxAttempts) {
            const pricingSection = findPricingSection();
            if (pricingSection) {
                const rect = pricingSection.getBoundingClientRect();
                const computedStyle = window.getComputedStyle(pricingSection);
                
                // Check if element is visible and has dimensions
                if (rect.width > 0 && rect.height > 0 && 
                    computedStyle.display !== 'none' && 
                    computedStyle.visibility !== 'hidden' && 
                    computedStyle.opacity !== '0') {
                    console.log('Bidly: Pricing section is now visible!', pricingSection, rect);
                    return pricingSection;
                }
            }
            
            attempts++;
            console.log(`Bidly: Pricing section not visible yet, attempt ${attempts}/${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.warn('Bidly: Pricing section did not become visible after waiting');
        return null;
    }

    // Refresh widget content without changing position
    function refreshWidgetContent(widgetElement, auctionCheck, settings) {
        console.log('Bidly: Refreshing widget content for auction:', auctionCheck);
        
        // Find the inner widget content element by ID
        const auctionId = auctionCheck.auctionId;
        let innerWidget = widgetElement.querySelector(`#bidly-auction-widget-${auctionId}`);
        if (!innerWidget) {
            console.log('Bidly: Inner widget not found, trying alternative selector...');
            // Try alternative selector
            innerWidget = widgetElement.querySelector(`.${CONFIG.widgetClass}`);
            if (!innerWidget) {
                console.log('Bidly: Inner widget not found, skipping refresh');
                return;
            }
            console.log('Bidly: Found widget using alternative selector');
        }
        
        // Generate new widget content
        const newContent = createWidgetHTML(auctionCheck, settings);
        
        // Replace the inner content without affecting positioning
        innerWidget.innerHTML = newContent;
        
        // Event listeners are handled through HTML form submissions and event delegation
        // No need to manually re-attach them
        
        // Re-initialize timer after content refresh
        if (auctionCheck.status === 'active' && auctionCheck.endTime && settings.show_timer) {
            console.log('Bidly: Re-initializing timer after content refresh');
            initializeCountdown(auctionCheck.auctionId, auctionCheck.endTime);
        }
        
        // Re-initialize real-time updates
        initializeRealTimeUpdates(auctionCheck.auctionId);
        
        console.log('Bidly: Widget content refreshed successfully');
    }

    // Main initialization function
    async function init() {
        console.log('Bidly: Initializing auction app embed...');
        
        // Check if widget already exists to prevent reloading
        const existingWidget = document.querySelector('.bidly-auction-app-embed');
        if (existingWidget) {
            console.log('Bidly: Widget already exists, skipping initialization to prevent reload');
            return;
        }
        
        // Wait for shared login system to initialize (but don't wait too long)
        let attempts = 0;
        const maxAttempts = 5; // Reduced attempts to prevent long waits
        
        while (!window.BidlyHybridLogin && attempts < maxAttempts) {
            console.log('Bidly: Waiting for shared login system...', attempts + 1);
            await new Promise(resolve => setTimeout(resolve, 200)); // Reduced wait time
            attempts++;
        }
        
        if (window.BidlyHybridLogin) {
            console.log('Bidly: Shared hybrid login system loaded');
            // Wait a bit more for customer detection to complete
            await new Promise(resolve => setTimeout(resolve, 500)); // Reduced wait time
        } else {
            console.log('Bidly: Shared login system not available after waiting');
        }

    // Wait for pricing section to become visible
    console.log('Bidly: Waiting for pricing section to become visible...');
    await waitForPricingSection();
        
        // Get settings from block
        const settings = {
            show_timer: true, // Default values since we can't access block settings in external JS
            show_bid_history: true,
            widget_position: 'below_price'
        };
        
        // Check if product has auction data
        const auctionCheck = await checkProductForAuction();
        
        if (auctionCheck.hasAuction) {
            console.log('Bidly: Product has auction data, injecting widget...', auctionCheck);
            // Store auction check data globally for refresh
            window.currentAuctionCheck = auctionCheck;
            injectWidget(auctionCheck, settings);
        } else {
            console.log('Bidly: No auction data found for this product');
        }
    }

    // Listen for login status changes and refresh widget content only (not position)
    window.addEventListener('bidly-login-success', function(event) {
        console.log('Bidly: Login success detected, refreshing widget content only...');
        
        // Find existing widget and refresh its content without repositioning
        const existingWidget = document.querySelector('.bidly-auction-app-embed');
        if (existingWidget && window.currentAuctionCheck) {
            console.log('Bidly: Refreshing existing widget content...');
            
            // Get current auction data
            const auctionCheck = window.currentAuctionCheck;
            const settings = {
                show_timer: true,
                show_bid_history: true,
                widget_position: 'below_price'
            };
            
            // Refresh widget content without changing position
            refreshWidgetContent(existingWidget, auctionCheck, settings);
        }
    });

    window.addEventListener('bidly-logout', function(event) {
        console.log('Bidly: Logout detected, refreshing widget...');
        // Re-check for auction data and refresh widget
        setTimeout(async () => {
            try {
                const auctionCheck = await checkProductForAuction();
                if (auctionCheck.hasAuction) {
                    console.log('Bidly: Re-injecting widget after logout...', auctionCheck);
                    window.currentAuctionCheck = auctionCheck;
                    const settings = {
                        show_timer: true,
                        show_bid_history: true,
                        widget_position: 'below_price'
                    };
                    injectWidget(auctionCheck, settings);
                } else {
                    console.log('Bidly: No auction data found after logout');
                }
            } catch (error) {
                console.error('Bidly: Error refreshing widget after logout:', error);
            }
        }, 100);
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();