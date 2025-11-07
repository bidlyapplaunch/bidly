/**
 * Auction App Embed JavaScript
 * Handles widget injection and hybrid login functionality
 */

(function() {
    'use strict';

    const PREVIEW_DATA = window.__BIDLY_PREVIEW__ || {};
    const PREVIEW_MODE = Boolean(PREVIEW_DATA.preview) || window.location.search.includes('preview=true') || window.location.search.includes('bidly_preview=1');

    // Only run on product pages unless in preview mode
    if (!PREVIEW_MODE && !window.location.pathname.includes('/products/')) {
        return;
    }

    function cleanDomain(value) {
        if (!value) {
            return '';
        }
        if (typeof value === 'object') {
            if (value.permanent_domain) {
                value = value.permanent_domain;
            } else if (typeof value.toString === 'function') {
                value = value.toString();
            }
        }
        if (typeof value !== 'string') {
            return '';
        }
        return value.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase().trim();
    }

    function detectShopDomain() {
        const candidates = [
            PREVIEW_DATA.shopDomain,
            window.Shopify?.shop?.permanent_domain,
            window.Shopify?.shop,
            window.Shopify?.config?.shop,
            window.Shopify?.Analytics?.meta?.shopDomain,
            window.Shopify?.Analytics?.meta?.myshopifyDomain,
            window.__st?.domain,
            window.__st?.shop,
            window.location.hostname
        ];

        let firstValid = '';
        for (const candidate of candidates) {
            const cleaned = cleanDomain(candidate);
            if (!cleaned) {
                continue;
            }
            if (!firstValid) {
                firstValid = cleaned;
            }
            if (cleaned.endsWith('.myshopify.com')) {
                return cleaned;
            }
        }

        // Fallback: if no myshopify domain in primary list, look specifically for one
        for (const candidate of candidates) {
            const cleaned = cleanDomain(candidate);
            if (cleaned && cleaned.endsWith('.myshopify.com')) {
                return cleaned;
            }
        }

        return firstValid || cleanDomain(window.location.hostname);
    }

    const SHOP_DOMAIN = detectShopDomain();
    if (SHOP_DOMAIN) {
        console.log(`🔍 Bidly: Detected shop domain ${SHOP_DOMAIN}`);
    } else {
        console.warn('⚠️ Bidly: Unable to detect shop domain, defaulting to hostname');
    }

    // Configuration
    const CONFIG = {
        backendUrl: (function() {
            // Use backend config if available, otherwise default
            if (window.BidlyBackendConfig) {
                return window.BidlyBackendConfig.getBackendUrl(SHOP_DOMAIN);
            }
            // Fallback to default if backend config not loaded
            console.warn('⚠️ Bidly: Backend config not loaded, using default backend');
            return 'https://bidly-auction-backend.onrender.com';
        })(),
        shopDomain: SHOP_DOMAIN,
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
        ],
        plan: 'none',
        capabilities: {
            key: 'none',
            features: {
                removeBranding: false,
                customization: false,
                popcorn: false,
                chat: false
            },
            limits: {
                auctions: 0
            }
        }
    };

    const PREVIEW_WIDGET_SETTINGS = {
        show_timer: true,
        show_bid_history: true,
        widget_position: 'preview'
    };

    const THEME_BOX_SHADOWS = {
        none: 'none',
        subtle: '0 6px 18px rgba(15, 23, 42, 0.08)',
        medium: '0 18px 45px rgba(15, 23, 42, 0.14)'
    };

    const DEFAULT_WIDGET_THEME = {
        template: 'A',
        font: 'Inter',
        colors: {
            accent: '#38BDF8',
            text: '#EDEEF3',
            bg_solid: '#36526D',
            bg_gradient_start: '#B7BDD2',
            bg_gradient_end: '#283E3B',
            button_bg: '#212736',
            button_hover: '#7FD2C1',
            button_text: '#FFFFFF',
            border: '#FF1E05'
        },
        borderRadius: 16,
        boxShadow: 'medium',
        gradientEnabled: true
    };

    let widgetThemeSettingsCache = null;

    function normalizeWidgetTheme(settings = {}) {
        const normalized = {
            template: settings.template || DEFAULT_WIDGET_THEME.template,
            font: settings.font || DEFAULT_WIDGET_THEME.font,
            borderRadius: settings.borderRadius || DEFAULT_WIDGET_THEME.borderRadius,
            boxShadow: settings.boxShadow || DEFAULT_WIDGET_THEME.boxShadow,
            gradientEnabled: typeof settings.gradientEnabled === 'boolean'
                ? settings.gradientEnabled
                : DEFAULT_WIDGET_THEME.gradientEnabled
        };

        normalized.colors = Object.assign({}, DEFAULT_WIDGET_THEME.colors, settings.colors || {});
        return normalized;
    }

    function buildWidgetThemeStyle(theme) {
        const boxShadow = THEME_BOX_SHADOWS[theme.boxShadow] || THEME_BOX_SHADOWS[DEFAULT_WIDGET_THEME.boxShadow];
        const font = (theme.font || DEFAULT_WIDGET_THEME.font).replace(/'/g, "\\'");
        const colors = theme.colors || DEFAULT_WIDGET_THEME.colors;
        return `
.bidly-widget-root {
    --bidly-font-family: '${font}', sans-serif;
    --bidly-text-color: ${colors.text};
    --bidly-accent-color: ${colors.accent};
    --bidly-bg-color: ${colors.bg_solid};
    --bidly-bg-gradient-start: ${colors.bg_gradient_start};
    --bidly-bg-gradient-end: ${colors.bg_gradient_end};
    --bidly-bg-gradient-enable: ${theme.gradientEnabled ? 1 : 0};
    --bidly-button-bg: ${colors.button_bg};
    --bidly-button-hover-bg: ${colors.button_hover};
    --bidly-button-text: ${colors.button_text};
    --bidly-border-color: ${colors.border};
    --bidly-border-radius: ${theme.borderRadius}px;
    --bidly-box-shadow: ${boxShadow};
}`;
    }

    async function fetchWidgetThemeSettings(force = false) {
        if (widgetThemeSettingsCache && !force && !PREVIEW_MODE) {
            return widgetThemeSettingsCache;
        }

        try {
            const previewSuffix = PREVIEW_MODE ? `&preview=true&_=${Date.now()}` : '';
            const response = await fetch(`${CONFIG.backendUrl}/api/customization/widget?shop=${CONFIG.shopDomain}${previewSuffix}`, {
                headers: PREVIEW_MODE ? { 'Cache-Control': 'no-store' } : undefined
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.settings) {
                    if (data.capabilities) {
                        CONFIG.capabilities = data.capabilities;
                    }
                    if (data.plan) {
                        CONFIG.plan = data.plan;
                    }
                    widgetThemeSettingsCache = normalizeWidgetTheme(data.settings);
                    return widgetThemeSettingsCache;
                }
            } else {
                console.warn('Bidly: Failed to fetch widget customization settings, status:', response.status);
            }
        } catch (error) {
            console.warn('Bidly: Error fetching widget customization settings:', error);
        }

        widgetThemeSettingsCache = normalizeWidgetTheme(DEFAULT_WIDGET_THEME);
        return widgetThemeSettingsCache;
    }

    function applyWidgetTheme(widgetContainer, theme) {
        if (!widgetContainer) {
            return;
        }

        const host = widgetContainer.querySelector('.bidly-widget-container');
        if (!host) {
            return;
        }

        host.classList.add('bidly-widget-root');
        const templateClassNames = ['bidly-template-A', 'bidly-template-B', 'bidly-template-C', 'bidly-template-D'];
        templateClassNames.forEach(className => host.classList.remove(className));
        const templateKey = theme.template || DEFAULT_WIDGET_THEME.template;
        host.classList.add(`bidly-template-${templateKey}`);
        host.setAttribute('data-bidly-template', templateKey);
        host.setAttribute('data-bidly-gradient', theme.gradientEnabled ? '1' : '0');

        let styleElement = host.querySelector('#bidly-widget-theme');
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'bidly-widget-theme';
            host.prepend(styleElement);
        }

        styleElement.textContent = buildWidgetThemeStyle(theme);
    }

    function buildPreviewAuctionData(override = {}) {
        const now = new Date();
        const state = override.status || PREVIEW_DATA.state || 'active';
        const baseBid = override.currentBid ?? 185;
        const minimumBid = override.minimumBid ?? override.startingBid ?? 150;
        return {
            hasAuction: true,
            auctionId: override.auctionId || 'preview-auction',
            status: state,
            currentBid: Number(baseBid),
            startingBid: Number(override.startingBid ?? minimumBid),
            minimumBid: Number(minimumBid),
            reservePrice: Number(override.reservePrice ?? (state === 'active' ? minimumBid : 0)),
            endTime: override.endTime || new Date(now.getTime() + 3600000).toISOString(),
            startTime: override.startTime || new Date(now.getTime() - 3600000).toISOString(),
            bidCount: Number(override.bidCount ?? 8),
            buyNowPrice: Number(override.buyNowPrice ?? 0)
        };
    }

    function renderPreviewWidget(themeOverride, auctionOverride) {
        const container = document.querySelector('[data-preview="1"]') || document.querySelector('.' + CONFIG.widgetClass);
        if (!container) {
            console.warn('Bidly: Preview container not found');
            return null;
        }

        const theme = themeOverride ? normalizeWidgetTheme(themeOverride) : (widgetThemeSettingsCache || normalizeWidgetTheme(DEFAULT_WIDGET_THEME));
        widgetThemeSettingsCache = theme;

        const auctionData = buildPreviewAuctionData(auctionOverride || PREVIEW_DATA.auctionData || {});
        const html = createWidgetHTML(auctionData, PREVIEW_WIDGET_SETTINGS);
        container.innerHTML = html;

        const widgetElement = container.querySelector('.' + CONFIG.widgetClass) || container;
        applyWidgetTheme(widgetElement, theme);

        if (auctionData.status === 'active' && auctionData.endTime) {
            initializeCountdown(auctionData.auctionId, auctionData.endTime);
        }

        window.currentAuctionCheck = auctionData;
        return { container, auctionData, theme };
    }

    window.addEventListener('message', (event) => {
        if (!event?.data || event.data.type !== 'BIDLY_PREVIEW_THEME_UPDATE') {
            return;
        }

        if (!PREVIEW_MODE) {
            return;
        }

        const payload = event.data.payload || {};
        if (payload.state) {
            PREVIEW_DATA.state = payload.state;
        }
        if (payload.theme) {
            PREVIEW_DATA.theme = payload.theme;
        }
        if (payload.auctionData) {
            PREVIEW_DATA.auctionData = payload.auctionData;
        }
        renderPreviewWidget(payload.theme || null, payload.auctionData || {});
        console.log('Bidly: Preview theme update applied from admin message');
    });

    // Theme loading functionality - DISABLED (reverted to original design)
    // Theme customization is temporarily disabled

    // Use hybrid login system
    function getCurrentCustomer() {
        return window.BidlyHybridLogin?.getCurrentCustomer() || null;
    }

    function isUserLoggedIn() {
        return window.BidlyHybridLogin?.isUserLoggedIn() || false;
    }
    
    // Check if current user is a Shopify customer (not a guest)
    function isShopifyCustomer() {
        const customer = getCurrentCustomer();
        if (!customer) return false;
        
        // Check if it's a Shopify customer (has shopifyId or window.Shopify.customer exists)
        if (customer.shopifyId || window.Shopify?.customer?.id) {
            return true;
        }
        
        // Check if customer data matches Shopify customer data
        if (window.customerData?.id && customer.id === window.customerData.id) {
            return true;
        }
        
        // If isTemp is explicitly false, it's a Shopify customer
        if (customer.isTemp === false) {
            return true;
        }
        
        // Otherwise, it's likely a guest
        return false;
    }
    
    // Logout handler
    function handleLogout() {
        console.log('Bidly: Logout button clicked');
        
        const customer = getCurrentCustomer();
        const isShopify = isShopifyCustomer();
        
        if (isShopify) {
            // Shopify customer - redirect to Shopify logout with return URL
            const currentUrl = encodeURIComponent(window.location.href);
            const logoutUrl = `/account/logout?return_url=${currentUrl}`;
            console.log('Bidly: Redirecting Shopify customer to logout:', logoutUrl);
            window.location.href = logoutUrl;
        } else {
            // Guest - clear data and refresh widget
            console.log('Bidly: Logging out guest user');
            if (window.BidlyHybridLogin && window.BidlyHybridLogin.logout) {
                window.BidlyHybridLogin.logout();
                // The logout event listener will handle refreshing the widget
            } else {
                // Fallback: manually clear sessionStorage and reload
                try {
                    sessionStorage.removeItem('bidly_guest_customer');
                } catch (e) {
                    console.warn('Bidly: Could not clear guest storage:', e);
                }
                window.location.reload();
            }
        }
    }
    
    // Expose logout handler globally so it can be called from onclick
    window.BidlyAuctionWidgetLogout = handleLogout;

    // Widget HTML template
    function createWidgetHTML(auctionData, settings) {
        const { auctionId, status, currentBid, startingBid, reservePrice, endTime, bidCount, buyNowPrice, startTime } = auctionData;
        const { show_timer, show_bid_history, widget_position } = settings;
        
        // Determine the display bid and minimum bid logic
        const displayBid = bidCount > 0 ? currentBid : startingBid;
        const minBidAmount = bidCount > 0 ? Math.max(currentBid + 1, startingBid) : startingBid;
        
        // Check if user is logged in and if they're a Shopify customer
        const loggedIn = isUserLoggedIn();
        const isShopify = isShopifyCustomer();
        const isGuest = loggedIn && !isShopify;
        
        // If not logged in, show ONLY login prompt (no auction info)
        if (!loggedIn) {
            return `
                <div id="bidly-auction-widget-${auctionId}" class="${CONFIG.widgetClass}" data-auction-id="${auctionId}">
                    <div class="bidly-widget-container">
                        <div class="bidly-widget-header">
                            <h3 class="bidly-widget-title">Live Auction</h3>
                            <div class="bidly-widget-status">
                                ${status === 'active' ? '<span class="bidly-status-active">LIVE</span>' : 
                                  status === 'pending' ? '<span class="bidly-status-pending">STARTING SOON</span>' : 
                                  '<span class="bidly-status-ended">ENDED</span>'}
                            </div>
                        </div>
                        
                        <div class="bidly-login-required">
                            <div class="bidly-login-message">
                                <h4>Login Required</h4>
                                <p>Please log in to view this auction</p>
                            </div>
                            
                            <div class="bidly-login-options">
                                <button class="bidly-btn bidly-btn-primary bidly-shopify-login" onclick="window.location.href='/account/login'">
                                    <span class="bidly-btn-icon">🛍️</span>
                                    Log in with Shopify
                                </button>
                                
                                <button class="bidly-btn bidly-btn-secondary bidly-guest-login" onclick="window.BidlyHybridLogin?.openGuestLogin()">
                                    <span class="bidly-btn-icon">👤</span>
                                    Continue as Guest (View Only)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // If guest (logged in but not Shopify customer), show widget with blurred bidding section
        const isGuestViewOnly = isGuest;
        
        return `
            <div id="bidly-auction-widget-${auctionId}" class="${CONFIG.widgetClass}" data-auction-id="${auctionId}">
                <div class="bidly-widget-container">
                    <div class="bidly-widget-header">
                        <h3 class="bidly-widget-title">Live Auction</h3>
                        <div class="bidly-widget-status">
                            ${status === 'active' ? '<span class="bidly-status-active">LIVE</span>' : 
                              status === 'pending' ? '<span class="bidly-status-pending">STARTING SOON</span>' : 
                              status === 'reserve_not_met' ? '<span class="bidly-status-ended">RESERVE NOT MET</span>' :
                              '<span class="bidly-status-ended">ENDED</span>'}
                        </div>
                        <div class="bidly-customer-info">
                            <span class="bidly-customer-name">👤 ${getCurrentCustomer()?.fullName || 'Guest User'}</span>
                            <button class="bidly-logout-btn" onclick="window.BidlyAuctionWidgetLogout && window.BidlyAuctionWidgetLogout(); return false;" title="Logout">×</button>
                        </div>
                    </div>

                    ${show_timer && status === 'active' && endTime ? `
                        <div class="bidly-widget-timer">
                            <div class="bidly-timer-card">
                                <div class="bidly-timer-label">Ends In:</div>
                                <div class="bidly-countdown" data-end-time="${endTime}">
                                    <span class="bidly-timer-days">0</span>d 
                                    <span class="bidly-timer-hours">0</span>h 
                                    <span class="bidly-timer-minutes">0</span>m 
                                    <span class="bidly-timer-seconds">0</span>s
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <div class="bidly-widget-pricing">
                        <div class="bidly-current-bid">
                            <span class="bidly-label">${bidCount > 0 ? 'CURRENT BID:' : 'STARTING BID:'}</span>
                            <span class="bidly-amount" data-current-bid="${displayBid}">$${displayBid.toFixed(2)}</span>
                        </div>
                        <div class="bidly-bid-count">
                            <span class="bidly-label">BIDS:</span>
                            <span class="bidly-count" data-bid-count="${bidCount}">${bidCount}</span>
                        </div>
                    </div>

                    ${status === 'active' ? `
                        <div class="bidly-widget-actions ${isGuestViewOnly ? 'bidly-guest-view-only' : ''}">
                            ${isGuestViewOnly ? `
                                <div class="bidly-guest-overlay">
                                    <div class="bidly-guest-message">
                                        <p style="font-weight: 600; margin-bottom: 0.5rem;">View Only</p>
                                        <p style="font-size: 0.9rem; opacity: 0.9;">Login to Shopify to enter the auction</p>
                                        <button class="bidly-btn bidly-btn-primary" onclick="window.location.href='/account/login'" style="margin-top: 1rem;">
                                            Log in with Shopify
                                        </button>
                                    </div>
                                </div>
                            ` : ''}
                            <div class="bidly-inline-bid-form ${isGuestViewOnly ? 'bidly-blurred' : ''}" id="bidly-bid-form-${auctionId}">
                                <div class="bidly-bid-action-card">
                                    <div class="bidly-minimum-bid">
                                        <span class="bidly-label">MINIMUM BID:</span>
                                        <span class="bidly-amount bidly-amount-green" data-min-bid="${minBidAmount}">$${minBidAmount.toFixed(2)}</span>
                                    </div>
                                    <form onsubmit="${isGuestViewOnly ? 'event.preventDefault(); return false;' : `window.BidlyAuctionWidget.submitInlineBid(event, '${auctionId}')`}">
                                        <div class="bidly-bid-input-group">
                                            <input type="number" 
                                                   id="bidly-bid-amount-${auctionId}" 
                                                   name="amount" 
                                                   step="0.01" 
                                                   min="${minBidAmount}" 
                                                   placeholder="Min: $${minBidAmount.toFixed(2)}"
                                                   ${isGuestViewOnly ? 'disabled' : 'required'}>
                                            <button type="submit" class="bidly-submit-bid" ${isGuestViewOnly ? 'disabled' : ''}>Place Bid</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                            ${buyNowPrice > 0 ? `
                                <button class="bidly-buy-now-btn ${isGuestViewOnly ? 'bidly-blurred' : ''}" 
                                        ${isGuestViewOnly ? 'disabled' : `onclick="window.BidlyAuctionWidget.openBuyNowModal('${auctionId}', ${buyNowPrice})"`}
                                        ${isGuestViewOnly ? 'style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                                    Buy Now ($${buyNowPrice.toFixed(2)})
                                </button>
                            ` : ''}
                        </div>
                    ` : status === 'pending' ? `
                        <div class="bidly-pending-message">
                            <div class="bidly-countdown-container">
                                <div class="bidly-countdown-label">Starting in:</div>
                                <div class="bidly-countdown-timer" id="bidly-countdown-${auctionId}">
                                    <span class="bidly-countdown-days">0d</span>
                                    <span class="bidly-countdown-hours">0h</span>
                                    <span class="bidly-countdown-minutes">0m</span>
                                    <span class="bidly-countdown-seconds">0s</span>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="bidly-ended-message">
                            ${status === 'reserve_not_met' 
                                ? 'Auction ended — reserve not met'
                                : `Auction has ended. Final bid: $${displayBid.toFixed(2)}`}
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
            // Wait for Shopify data to load
            let productId = await getProductIdFromPage();
            
            // Retry up to 3 times if product ID not found
            if (!productId) {
                console.log('Bidly: Product ID not found, retrying...');
                for (let i = 0; i < 3; i++) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    productId = await getProductIdFromPage();
                    if (productId) {
                        console.log('Bidly: Product ID found on retry', i + 1);
                        break;
                    }
                }
            }
            
            if (!productId) {
                console.error('Bidly: Could not determine product ID after retries');
                console.log('Bidly: window.Shopify:', window.Shopify);
                console.log('Bidly: document.readyState:', document.readyState);
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

    // Initialize countdown timer for pending auctions
    function initializeCountdownTimer(auctionId, startTime) {
        const countdownElement = document.getElementById(`bidly-countdown-${auctionId}`);
        if (!countdownElement) {
            console.warn('Bidly: Countdown element not found for auction:', auctionId);
            return;
        }

        const startDate = new Date(startTime);
        const now = new Date();
        const timeLeft = startDate - now;
        
        console.log('Bidly: Initializing countdown for auction:', auctionId);
        console.log('Bidly: Start time string:', startTime);
        console.log('Bidly: Start time parsed:', startDate);
        console.log('Bidly: Current time:', now);
        console.log('Bidly: Time left (ms):', timeLeft);
        console.log('Bidly: Time left (seconds):', Math.floor(timeLeft / 1000));
        
        // Check if startTime is valid
        if (isNaN(startDate.getTime())) {
            console.error('Bidly: Invalid start time:', startTime);
            return;
        }
        
        // If time has already passed, show "Starting soon" and refresh in 30 seconds
        if (timeLeft <= 0) {
            console.log('Bidly: Start time has passed, showing "Starting soon"');
            const daysSpan = countdownElement.querySelector('.bidly-countdown-days');
            const hoursSpan = countdownElement.querySelector('.bidly-countdown-hours');
            const minutesSpan = countdownElement.querySelector('.bidly-countdown-minutes');
            const secondsSpan = countdownElement.querySelector('.bidly-countdown-seconds');

            if (daysSpan) daysSpan.textContent = 'Soon';
            if (hoursSpan) hoursSpan.textContent = '';
            if (minutesSpan) minutesSpan.textContent = '';
            if (secondsSpan) secondsSpan.textContent = '';
            
            // Refresh page in 30 seconds to check for status update
            setTimeout(() => {
                console.log('Bidly: Refreshing page to check auction status...');
                window.location.reload();
            }, 30000);
            return;
        }

        function updateCountdown() {
            const now = new Date();
            const timeLeft = startDate - now;

            console.log('Bidly: Countdown update - Time left:', timeLeft, 'Start:', startDate, 'Now:', now);

            if (timeLeft <= 0) {
                // Auction should start - refresh the page to get updated status
                console.log('Bidly: Auction should start now, refreshing...');
                window.location.reload();
                return;
            }

            // Calculate time components
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            // Update countdown display
            const daysSpan = countdownElement.querySelector('.bidly-countdown-days');
            const hoursSpan = countdownElement.querySelector('.bidly-countdown-hours');
            const minutesSpan = countdownElement.querySelector('.bidly-countdown-minutes');
            const secondsSpan = countdownElement.querySelector('.bidly-countdown-seconds');

            if (daysSpan) daysSpan.textContent = `${days}d`;
            if (hoursSpan) hoursSpan.textContent = `${hours}h`;
            if (minutesSpan) minutesSpan.textContent = `${minutes}m`;
            if (secondsSpan) secondsSpan.textContent = `${seconds}s`;

            console.log('Bidly: Countdown updated:', `${days}d ${hours}h ${minutes}m ${seconds}s`);
        }

        // Update immediately
        updateCountdown();

        // Update every second
        const countdownInterval = setInterval(updateCountdown, 1000);

        // Store interval ID for cleanup
        window.bidlyCountdownIntervals = window.bidlyCountdownIntervals || {};
        window.bidlyCountdownIntervals[auctionId] = countdownInterval;

        console.log('Bidly: Countdown timer initialized for auction:', auctionId);
    }

    // Inject widget into pricing section
    async function injectWidget(auctionData, settings) {
        // Check if we have valid auction data
        if (!auctionData || !auctionData.hasAuction) {
            console.log('Bidly: No auction data available, not injecting widget');
            return;
        }

        const themeSettings = await fetchWidgetThemeSettings();

        // Fallback: if pending but no startTime, fetch from backend
        try {
            if (auctionData.status === 'pending' && !auctionData.startTime && auctionData.auctionId) {
                console.log('Bidly: startTime missing; attempting backend fetch for auction', auctionData.auctionId);
                const res = await fetch(`${CONFIG.backendUrl}/api/auctions/${auctionData.auctionId}?shop=${CONFIG.shopDomain}`);
                if (res.ok) {
                    const json = await res.json();
                    const start = (json.data && json.data.startTime) || (json.auction && json.auction.startTime) || null;
                    if (start) {
                        auctionData.startTime = start;
                        console.log('Bidly: Fallback startTime retrieved from backend:', start);
                    } else {
                        console.log('Bidly: Backend did not return startTime');
                    }
                } else {
                    console.log('Bidly: Backend fetch failed with status', res.status);
                }
            }
        } catch (e) {
            console.warn('Bidly: Error during fallback startTime fetch', e);
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
        applyWidgetTheme(widgetContainer, themeSettings);
        
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
        
        // Initialize countdown timer if auction is pending
        if (auctionData.status === 'pending' && auctionData.startTime) {
            console.log('Bidly: Initializing countdown timer for pending auction:', auctionData.auctionId, 'Start time:', auctionData.startTime);
            initializeCountdownTimer(auctionData.auctionId, auctionData.startTime);
        } else {
            console.log('Bidly: Not initializing countdown timer. Status:', auctionData.status, 'Start time:', auctionData.startTime);
        }
        
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

        // Clear any existing interval for this auction
        window.bidlyCountdownIntervals = window.bidlyCountdownIntervals || {};
        if (window.bidlyCountdownIntervals[auctionId]) {
            clearInterval(window.bidlyCountdownIntervals[auctionId]);
            console.log('Bidly: Cleared existing countdown interval for auction:', auctionId);
        }

        // Persist authoritative end time so polling/UI doesn't regress
        window.bidlyAuctionEndTimes = window.bidlyAuctionEndTimes || {};
        window.bidlyAuctionEndTimes[auctionId] = endTime;
        
        function updateCountdown() {
            // Always read from authoritative source to get latest end time (e.g., after time extension)
            const authoritativeEndTime = window.bidlyAuctionEndTimes[auctionId];
            if (!authoritativeEndTime) {
                console.warn('Bidly: No authoritative end time found for auction:', auctionId);
                return;
            }
            
            const endTimestamp = new Date(authoritativeEndTime).getTime();
            const now = new Date().getTime();
            const distance = endTimestamp - now;

            if (distance < 0) {
                countdownElement.innerHTML = '<span class="bidly-time-unit">Auction Ended</span>';
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            // Render fresh markup to avoid querying non-existent child nodes
            countdownElement.innerHTML = `
                <span class="bidly-time-unit">${days}d</span>
                <span class="bidly-time-unit">${hours}h</span>
                <span class="bidly-time-unit">${minutes}m</span>
                <span class="bidly-time-unit">${seconds}s</span>
            `;
        }

        updateCountdown();
        const intervalId = setInterval(updateCountdown, 1000);
        
        // Store interval ID for cleanup
        window.bidlyCountdownIntervals[auctionId] = intervalId;
        console.log('Bidly: Countdown timer initialized/updated for auction:', auctionId, 'End time:', endTime);
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
            
            socket.on('auction-time-extended', (data) => {
                console.log('Bidly: Time extension received:', data);
                if (data.auctionId === auctionId) {
                    // Reinitialize countdown with the new end time (this will clear the old interval)
                    initializeCountdown(auctionId, data.newEndTime);
                    
                    // Show notification for time extension
                    showBidNotification(null, null, null, null, `🍿 ${data.message}`);
                }
            });

            // Some backends also include time extension in a generic bid update; be resilient
            socket.on('bid-update', (data) => {
                if (data.auctionId === auctionId && data.timeExtended && data.newEndTime) {
                    console.log('Bidly: Time extension via bid-update:', data.newEndTime);
                    initializeCountdown(auctionId, data.newEndTime);
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
                    if (response.status === 404) {
                        // Auction not found - it may have been deleted or doesn't exist
                        console.warn('Bidly: Auction not found (404), re-checking for auctions...');
                        
                        // Stop polling this auction ID
                        if (pollingInterval) {
                            clearInterval(pollingInterval);
                            pollingInterval = null;
                        }
                        
                        // Re-check for auctions by product ID
                        const auctionCheck = await checkProductForAuction();
                        if (auctionCheck.hasAuction) {
                            // Found a new auction - refresh the widget
                            console.log('Bidly: Found new auction, refreshing widget...');
                            window.currentAuctionCheck = auctionCheck;
                            const settings = {
                                show_timer: true,
                                show_bid_history: true,
                                widget_position: 'below_price'
                            };
                            const existingWidget = document.querySelector('.bidly-auction-app-embed');
                            if (existingWidget) {
                                refreshWidgetContent(existingWidget, auctionCheck, settings);
                            } else {
                                injectWidget(auctionCheck, settings);
                            }
                        } else {
                            // No auction found - remove widget
                            console.log('Bidly: No auction found, removing widget...');
                            const existingWidget = document.querySelector('.bidly-auction-app-embed');
                            if (existingWidget) {
                                existingWidget.remove();
                            }
                            // Stop polling
                            if (pollingInterval) {
                                clearInterval(pollingInterval);
                                pollingInterval = null;
                            }
                        }
                    } else {
                        console.warn('Bidly: Polling response not ok:', response.status);
                    }
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
            // Use same logic as widget creation
            const bidCount = auctionData.bidCount || auctionData.bidHistory?.length || 0;
            const displayBid = bidCount > 0 ? auctionData.currentBid : auctionData.startingBid;
            currentBidElement.textContent = `$${displayBid.toFixed(2)}`;
            currentBidElement.setAttribute('data-current-bid', displayBid);
            console.log('Bidly: Updated current bid to:', displayBid, 'Element:', currentBidElement);
        } else {
            console.warn('Bidly: Current bid element not found');
        }

        // Update the label (Starting Bid vs Current Bid)
        const bidLabelElement = widget.querySelector('.bidly-label');
        if (bidLabelElement) {
            const bidCount = auctionData.bidCount || auctionData.bidHistory?.length || 0;
            bidLabelElement.textContent = bidCount > 0 ? 'Current Bid:' : 'Starting Bid:';
            console.log('Bidly: Updated bid label to:', bidLabelElement.textContent);
        } else {
            console.warn('Bidly: Bid label element not found');
        }

        // Update minimum bid - try multiple selectors
        let minBidElement = widget.querySelector('[data-min-bid]');
        if (!minBidElement) {
            minBidElement = widget.querySelector('.bidly-minimum-bid .bidly-amount');
        }
        
        if (minBidElement) {
            // Use same logic as widget creation
            const bidCount = auctionData.bidCount || auctionData.bidHistory?.length || 0;
            const minBidAmount = bidCount > 0 ? Math.max(auctionData.currentBid + 1, auctionData.startingBid) : auctionData.startingBid;
            minBidElement.textContent = `$${minBidAmount.toFixed(2)}`;
            minBidElement.setAttribute('data-min-bid', minBidAmount);
            console.log('Bidly: Updated minimum bid to:', minBidAmount, 'Element:', minBidElement);
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

        // Update inline bid form if it exists (for all statuses)
        const bidForm = widget.querySelector('.bidly-inline-bid-form');
        if (bidForm) {
            const bidInput = bidForm.querySelector('input[type="number"]');
            const submitButton = bidForm.querySelector('.bidly-submit-bid');
            
            if (bidInput) {
                // Use same logic as widget creation
                const bidCount = auctionData.bidCount || auctionData.bidHistory?.length || 0;
                const newMinBid = bidCount > 0 ? Math.max(auctionData.currentBid + 1, auctionData.startingBid) : auctionData.startingBid;
                bidInput.min = newMinBid;
                bidInput.placeholder = `Min: $${newMinBid.toFixed(2)}`;
                console.log('Bidly: Updated bid input min to:', newMinBid, 'Element:', bidInput);
            }
            
            // Handle form state based on auction status
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
            } else if (auctionData.status === 'active') {
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

        // Update status if changed
        if (auctionData.status !== 'active') {
            const statusElement = widget.querySelector('.bidly-widget-status');
            if (statusElement) {
                if (auctionData.status === 'reserve_not_met') {
                    statusElement.innerHTML = '<span class="bidly-status-ended">● RESERVE NOT MET</span>';
                } else if (auctionData.status === 'ended') {
                    statusElement.innerHTML = '<span class="bidly-status-ended">● ENDED</span>';
                } else {
                    statusElement.innerHTML = '<span class="bidly-status-pending">● PENDING</span>';
                }
                console.log('Bidly: Updated status to:', auctionData.status);
            }
            
            // Disable bidding if auction ended or reserve not met
            const bidButton = widget.querySelector('.bidly-bid-btn');
            if (bidButton && (auctionData.status === 'ended' || auctionData.status === 'reserve_not_met')) {
                bidButton.disabled = true;
                bidButton.textContent = auctionData.status === 'reserve_not_met' ? 'Reserve Not Met' : 'Auction Ended';
                bidButton.style.opacity = '0.5';
            }
        }

        // Update timer end time if auction is active (but don't touch the display - let initializeCountdown's interval handle it)
        if (auctionData.status === 'active') {
            window.bidlyAuctionEndTimes = window.bidlyAuctionEndTimes || {};
            // Prefer the later of (stored authoritative end, backend endTime)
            const storedEnd = window.bidlyAuctionEndTimes[auctionId] || null;
            const backendEnd = auctionData.endTime || null;
            let authoritativeEnd = backendEnd;
            if (storedEnd && backendEnd) {
                authoritativeEnd = new Date(storedEnd) > new Date(backendEnd) ? storedEnd : backendEnd;
            } else if (storedEnd) {
                authoritativeEnd = storedEnd;
            }
            // Persist authoritative value - the existing countdown timer will read from this
            if (authoritativeEnd) {
                window.bidlyAuctionEndTimes[auctionId] = authoritativeEnd;
                // Only initialize if no timer is currently running
                window.bidlyCountdownIntervals = window.bidlyCountdownIntervals || {};
                if (!window.bidlyCountdownIntervals[auctionId]) {
                    initializeCountdown(auctionId, authoritativeEnd);
                }
                // If timer is already running, it will automatically read from window.bidlyAuctionEndTimes[auctionId]
            }
        }

        console.log('Bidly: Widget data update complete');
    }

    // Show bid notification
    function showBidNotification(currentBid, bidCount, bidderName = null, productTitle = null, customMessage = null) {
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
        if (customMessage) {
            // Custom message (for time extension, etc.)
            messageContent = `
                <div style="font-weight: bold; margin-bottom: 5px;">${customMessage}</div>
            `;
        } else if (typeof bidCount === 'string') {
            // Custom message (like "New bid placed!")
            messageContent = `
                <div style="font-weight: bold; margin-bottom: 5px;">${bidCount}</div>
                ${currentBid != null ? `<div>Current Bid: $${currentBid.toFixed(2)}</div>` : ''}
            `;
        } else if (bidderName && productTitle && currentBid != null) {
            // Enhanced notification with bidder name and product
            const firstName = bidderName.split(' ')[0]; // Get first name only
            messageContent = `
                <div style="font-weight: bold; margin-bottom: 5px;">${firstName} bid $${currentBid.toFixed(2)} on ${productTitle}</div>
                ${bidCount != null ? `<div style="font-size: 12px; opacity: 0.9;">Total Bids: ${bidCount}</div>` : ''}
            `;
        } else if (currentBid != null) {
            // Standard bid notification
            messageContent = `
                <div style="font-weight: bold; margin-bottom: 5px;">New Bid Placed!</div>
                <div>Current Bid: $${currentBid.toFixed(2)}</div>
                ${bidCount != null ? `<div>Total Bids: ${bidCount}</div>` : ''}
            `;
        } else {
            // Fallback for invalid data
            messageContent = `
                <div style="font-weight: bold;">Auction Update</div>
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
        modal.setAttribute('data-auction-id', auctionId);
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
            // Remove any existing modals first
            const existingModals = document.querySelectorAll('.bidly-modal-overlay');
            existingModals.forEach(modal => modal.remove());
            
            const modal = createBidModal(auctionId);
            modal.setAttribute('data-auction-id', auctionId);
            document.body.appendChild(modal);
            modal.style.display = 'flex';
        },

        openBuyNowModal: function(auctionId, price) {
            // Remove any existing modals first
            const existingModals = document.querySelectorAll('.bidly-modal-overlay');
            existingModals.forEach(modal => modal.remove());
            
            const modal = createBuyNowModal(auctionId, price);
            modal.setAttribute('data-auction-id', auctionId);
            document.body.appendChild(modal);
            modal.style.display = 'flex';
        },

        openBidHistory: async function(auctionId) {
            try {
                // Remove any existing modals first
                const existingModals = document.querySelectorAll('.bidly-modal-overlay');
                existingModals.forEach(modal => modal.remove());
                
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
                const bidHistory = (auction.bidHistory || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
                // Create modal element
                const modal = document.createElement('div');
                modal.className = 'bidly-modal-overlay';
                modal.setAttribute('data-auction-id', auctionId);
                modal.innerHTML = `
                    <div class="bidly-modal-content bidly-history-modal">
                        <div class="bidly-modal-header">
                            <h3>Bid History</h3>
                            <button class="bidly-modal-close">&times;</button>
                        </div>
                        <div class="bidly-modal-body">
                            <div class="bidly-bid-history">
                                ${bidHistory.length === 0 ? 
                                    '<p class="bidly-no-bids">No bids placed yet</p>' :
                                    bidHistory.map((bid, index) => {
                                        // Find the highest bid amount to identify current bid
                                        const highestBid = Math.max(...bidHistory.map(b => b.amount));
                                        const isCurrentBid = bid.amount === highestBid;
                                        
                                        return `
                                            <div class="bidly-bid-item ${isCurrentBid ? 'bidly-current-bid' : ''}">
                                                <div class="bidly-bid-info">
                                                    <span class="bidly-bidder">${bid.bidder}</span>
                                                    <span class="bidly-bid-time">${new Date(bid.timestamp).toLocaleString()}</span>
                                                </div>
                                                <div class="bidly-bid-amount">$${bid.amount.toFixed(2)}</div>
                                            </div>
                                        `;
                                    }).join('')
                                }
                            </div>
                        </div>
                    </div>
                `;
                
                // Add modal to page
                document.body.appendChild(modal);
                modal.style.display = 'flex';
                
                // Add close functionality
                const closeBtn = modal.querySelector('.bidly-modal-close');
                closeBtn.addEventListener('click', () => modal.remove());
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) modal.remove();
                });
                
            } catch (error) {
                console.error('Error loading bid history:', error);
                alert('Failed to load bid history');
            }
        },

        closeBidModal: function(auctionId) {
            const modal = document.querySelector(`.bidly-modal-overlay[data-auction-id="${auctionId}"]`);
            if (modal) {
                modal.remove();
            }
        },

        closeBuyNowModal: function(auctionId) {
            const modal = document.querySelector(`.bidly-modal-overlay[data-auction-id="${auctionId}"]`);
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
                    
                    // Immediately fetch fresh auction data and update widget (no delay)
                    console.log('Bidly: Fetching fresh auction data immediately after bid placement');
                    try {
                        const response = await fetch(`${CONFIG.backendUrl}/api/auctions/${auctionId}?shop=${CONFIG.shopDomain}`);
                        if (response.ok) {
                            const data = await response.json();
                            if (data.success && data.auction) {
                                // Update widget with fresh data immediately
                                updateWidgetData(auctionId, data.auction);
                                // Also update cached auction check for future refreshes
                                if (window.currentAuctionCheck && window.currentAuctionCheck.auctionId === auctionId) {
                                    window.currentAuctionCheck = { ...window.currentAuctionCheck, ...data.auction };
                                }
                                console.log('Bidly: Widget updated with fresh data immediately');
                            }
                        }
                    } catch (error) {
                        console.warn('Bidly: Error fetching fresh data after bid:', error);
                        // Fallback: still update widget even if fetch fails (data might be in result)
                        if (result.auction) {
                            updateWidgetData(auctionId, result.auction);
                        }
                    }
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
                customerId: customer.id
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
                    
                    // Immediately fetch fresh auction data and update widget (no delay)
                    console.log('Bidly: Fetching fresh auction data immediately after bid placement');
                    try {
                        const response = await fetch(`${CONFIG.backendUrl}/api/auctions/${auctionId}?shop=${CONFIG.shopDomain}`);
                        if (response.ok) {
                            const data = await response.json();
                            if (data.success && data.auction) {
                                // Update widget with fresh data immediately
                                updateWidgetData(auctionId, data.auction);
                                // Also update cached auction check for future refreshes
                                if (window.currentAuctionCheck && window.currentAuctionCheck.auctionId === auctionId) {
                                    window.currentAuctionCheck = { ...window.currentAuctionCheck, ...data.auction };
                                }
                                console.log('Bidly: Widget updated with fresh data immediately');
                            }
                        }
                    } catch (error) {
                        console.warn('Bidly: Error fetching fresh data after bid:', error);
                        // Fallback: still update widget even if fetch fails (data might be in result)
                        if (result.auction) {
                            updateWidgetData(auctionId, result.auction);
                        }
                    }
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
                // Require logged-in customer (Shopify or guest temp)
                const customer = getCurrentCustomer && getCurrentCustomer();
                if (!isUserLoggedIn() || !customer) {
                    alert('Please log in to continue');
                    return;
                }

                const payload = {
                    bidder: customer.fullName,
                    customerEmail: customer.email,
                    price
                };

                const response = await fetch(`${CONFIG.backendUrl}/api/auctions/${auctionId}/buy-now?shop=${CONFIG.shopDomain}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
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
        console.log('Bidly: Current login state:', { 
            loggedIn: isUserLoggedIn(), 
            isShopify: isShopifyCustomer(),
            customer: getCurrentCustomer() 
        });
        
        // Find the inner widget content element by ID
        const auctionId = auctionCheck.auctionId;
        let innerWidget = widgetElement.querySelector(`#bidly-auction-widget-${auctionId}`);
        if (!innerWidget) {
            console.log('Bidly: Inner widget not found by ID, trying alternative selector...');
            // Try alternative selector
            innerWidget = widgetElement.querySelector(`.${CONFIG.widgetClass}`);
            if (!innerWidget) {
                console.log('Bidly: Inner widget not found, trying direct child...');
                // Try finding it directly in the widget element
                innerWidget = widgetElement.querySelector('div[data-auction-id]');
                if (!innerWidget) {
                    console.log('Bidly: Inner widget not found, using widgetElement itself');
                    innerWidget = widgetElement;
                }
            }
        }
        
        // Generate new widget content
        const newContent = createWidgetHTML(auctionCheck, settings);
        
        // Replace the inner content without affecting positioning
        if (innerWidget === widgetElement) {
            // Replace the entire widget element's innerHTML
            widgetElement.innerHTML = newContent;
        } else {
            // Replace only the inner widget content
            innerWidget.innerHTML = newContent;
        }
        
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

        fetchWidgetThemeSettings()
            .then(theme => {
                applyWidgetTheme(widgetElement, theme);
            })
            .catch(error => {
                console.warn('Bidly: Failed to reapply widget theme:', error);
            });
    }

    // Main initialization function
    async function init() {
        console.log('Bidly: Initializing auction app embed...');
        
        const initialTheme = await fetchWidgetThemeSettings(PREVIEW_MODE);

        if (PREVIEW_MODE) {
            renderPreviewWidget(initialTheme, PREVIEW_DATA.auctionData || { status: PREVIEW_DATA.state || 'active' });
            return;
        }

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
        console.log('Bidly: Login success detected, refreshing widget content only...', event.detail);
        
        // Wait a moment for login state to fully update
        setTimeout(() => {
            // Check login state
            const loggedIn = isUserLoggedIn();
            const isShopify = isShopifyCustomer();
            console.log('Bidly: Login state after login event:', { loggedIn, isShopify, customer: getCurrentCustomer() });
            
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
            } else {
                console.log('Bidly: Widget or auction check not found, cannot refresh', { 
                    hasWidget: !!existingWidget, 
                    hasAuctionCheck: !!window.currentAuctionCheck 
                });
            }
        }, 300);
    });

    window.addEventListener('bidly-logout', function(event) {
        console.log('Bidly: Logout detected, refreshing widget...');
        
        // Wait a moment for logout to complete
        setTimeout(() => {
            // Check login state after logout
            const loggedIn = isUserLoggedIn();
            console.log('Bidly: Login state after logout event:', { loggedIn, customer: getCurrentCustomer() });
            
            // Find existing widget and refresh its content
            const existingWidget = document.querySelector('.bidly-auction-app-embed');
            if (existingWidget && window.currentAuctionCheck) {
                console.log('Bidly: Refreshing widget content after logout...');
                
                // Get current auction data
                const auctionCheck = window.currentAuctionCheck;
                const settings = {
                    show_timer: true,
                    show_bid_history: true,
                    widget_position: 'below_price'
                };
                
                // Refresh widget content (will show login panel since user is logged out)
                refreshWidgetContent(existingWidget, auctionCheck, settings);
            } else if (existingWidget) {
                // Widget exists but no auction check - re-check and refresh
                checkProductForAuction().then(auctionCheck => {
                    if (auctionCheck.hasAuction) {
                        window.currentAuctionCheck = auctionCheck;
                        const settings = {
                            show_timer: true,
                            show_bid_history: true,
                            widget_position: 'below_price'
                        };
                        refreshWidgetContent(existingWidget, auctionCheck, settings);
                    }
                }).catch(error => {
                    console.error('Bidly: Error refreshing widget after logout:', error);
                });
            }
        }, 300);
    });

    // ===== CHAT FUNCTIONALITY =====
    let chatSocket = null;
    let currentProductId = null;
    let chatUsername = null;
    let chatInitialized = false;

    /**
     * Initialize chat for the current product (only for Shopify customers)
     */
    function initializeChat() {
        if (!CONFIG.capabilities?.features?.chat) {
            console.log('Bidly: Live chat is disabled for the current plan');
            return;
        }
        // Only show chat for Shopify customers
        if (!isShopifyCustomer()) {
            console.log('Bidly: Chat only available for Shopify customers');
            return;
        }

        // Don't initialize twice
        if (chatInitialized) {
            return;
        }

        // Get product ID from URL or page
        const productHandle = window.location.pathname.split('/products/')[1]?.split('?')[0]?.split('#')[0];
        if (!productHandle) {
            console.log('Bidly: Could not determine product handle for chat');
            return;
        }

        // Try to get product ID from Shopify data
        const productId = window.Shopify?.analytics?.meta?.page?.resourceId || 
                         document.querySelector('[data-product-id]')?.getAttribute('data-product-id') ||
                         productHandle; // Fallback to handle

        currentProductId = productId;

        // Get username from customer data
        const customer = getCurrentCustomer();
        if (customer) {
            chatUsername = customer.fullName || customer.firstName || `Guest${Math.floor(Math.random() * 1000)}`;
        } else {
            chatUsername = `Guest${Math.floor(Math.random() * 1000)}`;
        }

        // Create chat UI
        createChatUI();

        // Connect to Socket.io for chat
        if (window.io && socket) {
            chatSocket = socket; // Reuse existing socket connection
        } else if (window.io) {
            chatSocket = io(CONFIG.backendUrl, {
                transports: ['websocket', 'polling'],
                timeout: 20000
            });

            chatSocket.on('connect', () => {
                console.log('Bidly: Chat WebSocket connected');
                // Join product chat room
                if (currentProductId) {
                    chatSocket.emit('join-chat-room', currentProductId);
                }
            });

            chatSocket.on('disconnect', () => {
                console.log('Bidly: Chat WebSocket disconnected');
            });
        }

        // Set up chat event listeners
        if (chatSocket) {
            // Listen for chat history
            chatSocket.on('chat-history', ({ productId, messages }) => {
                if (productId === currentProductId) {
                    displayChatMessages(messages);
                }
            });

            // Listen for new messages
            chatSocket.on('chat-message', (messageData) => {
                addChatMessage(messageData);
            });

            // Listen for errors
            chatSocket.on('chat-error', ({ message }) => {
                console.error('Bidly: Chat error:', message);
            });

            // Join room if already connected
            if (chatSocket.connected && currentProductId) {
                chatSocket.emit('join-chat-room', currentProductId);
            }
        }

        chatInitialized = true;
    }

    /**
     * Create chat UI HTML
     */
    function createChatUI() {
        if (!CONFIG.capabilities?.features?.chat) {
            return;
        }
        // Remove existing chat if any
        const existingChat = document.querySelector('.bidly-chat-container');
        if (existingChat) {
            existingChat.remove();
        }

        const chatContainer = document.createElement('div');
        chatContainer.className = 'bidly-chat-container';
        chatContainer.innerHTML = `
            <button class="bidly-chat-toggle" id="bidly-chat-toggle" aria-label="Toggle chat">
                <span class="chat-icon">💬</span>
                <span class="close-icon">✕</span>
            </button>
            <div class="bidly-chat-box hidden" id="bidly-chat-box">
                <div class="bidly-chat-header">
                    <h3>
                        <span class="online-indicator"></span>
                        Live Chat
                    </h3>
                </div>
                <div class="bidly-chat-messages" id="bidly-chat-messages">
                    <div class="bidly-chat-empty">No messages yet. Start the conversation!</div>
                </div>
                <div class="bidly-chat-input-container">
                    <form class="bidly-chat-input-form" id="bidly-chat-form">
                        <input 
                            type="text" 
                            class="bidly-chat-input" 
                            id="bidly-chat-input" 
                            placeholder="Type a message..." 
                            maxlength="500"
                            autocomplete="off"
                        />
                        <button type="submit" class="bidly-chat-send-btn" id="bidly-chat-send">Send</button>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(chatContainer);

        // Set up toggle button
        const toggleBtn = document.getElementById('bidly-chat-toggle');
        const chatBox = document.getElementById('bidly-chat-box');
        
        toggleBtn.addEventListener('click', () => {
            chatBox.classList.toggle('hidden');
            toggleBtn.classList.toggle('minimized');
            
            // Scroll to bottom when opening
            if (!chatBox.classList.contains('hidden')) {
                scrollChatToBottom();
            }
        });

        // Set up form submission
        const chatForm = document.getElementById('bidly-chat-form');
        const chatInput = document.getElementById('bidly-chat-input');
        
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendChatMessage();
        });

        // Focus input when chat opens
        toggleBtn.addEventListener('click', () => {
            if (!chatBox.classList.contains('hidden')) {
                setTimeout(() => chatInput.focus(), 100);
            }
        });
    }

    /**
     * Send a chat message
     */
    function sendChatMessage() {
        const chatInput = document.getElementById('bidly-chat-input');
        const message = chatInput.value.trim();
        const sendBtn = document.getElementById('bidly-chat-send');

        if (!message || !chatSocket || !currentProductId || !chatUsername) {
            return;
        }

        // Disable input while sending
        chatInput.disabled = true;
        sendBtn.disabled = true;

        // Emit message
        chatSocket.emit('new-chat-message', {
            productId: currentProductId,
            username: chatUsername,
            message: message
        });

        // Clear input
        chatInput.value = '';
        chatInput.disabled = false;
        sendBtn.disabled = false;
        chatInput.focus();
    }

    /**
     * Add a message to the chat display
     */
    function addChatMessage(messageData) {
        const messagesContainer = document.getElementById('bidly-chat-messages');
        if (!messagesContainer) return;

        // Remove empty state if present
        const emptyState = messagesContainer.querySelector('.bidly-chat-empty');
        if (emptyState) {
            emptyState.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'bidly-chat-message';

        const timestamp = new Date(messageData.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="username">${escapeHtml(messageData.username)}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${escapeHtml(messageData.message)}</div>
        `;

        messagesContainer.appendChild(messageDiv);
        scrollChatToBottom();
    }

    /**
     * Display chat history
     */
    function displayChatMessages(messages) {
        const messagesContainer = document.getElementById('bidly-chat-messages');
        if (!messagesContainer) return;

        // Clear existing messages
        messagesContainer.innerHTML = '';

        if (messages.length === 0) {
            messagesContainer.innerHTML = '<div class="bidly-chat-empty">No messages yet. Start the conversation!</div>';
            return;
        }

        // Display all messages
        messages.forEach(messageData => {
            addChatMessage(messageData);
        });

        scrollChatToBottom();
    }

    /**
     * Scroll chat to bottom
     */
    function scrollChatToBottom() {
        const messagesContainer = document.getElementById('bidly-chat-messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize chat when widget is successfully injected
    // This will be called after injectWidget completes
    const originalInit = init;
    init = async function() {
        await originalInit();
        // Initialize chat after init completes and widget is injected
        setTimeout(() => {
            if (CONFIG.capabilities?.features?.chat && document.querySelector('.bidly-auction-app-embed')) {
                initializeChat();
            }
        }, 1500);
    };

    // Also initialize chat when login status changes
    window.addEventListener('bidly-login-success', () => {
        setTimeout(() => {
            if (CONFIG.capabilities?.features?.chat && isShopifyCustomer()) {
                initializeChat();
            }
        }, 500);
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();