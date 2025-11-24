/**
 * Backend URL Configuration for Customer Widget
 * Maps shop domains to their respective backend URLs
 * 
 * This file is loaded by the auction widget on product pages.
 * Update STORE_BACKEND_MAP when you deploy a new backend for a different store.
 */

(function() {
    'use strict';

    const console = (() => {
        if (typeof window !== 'undefined' && window.BidlyDebugUtils?.createConsole) {
            return window.BidlyDebugUtils.createConsole('Widget');
        }
        const fallback = (typeof window !== 'undefined' && window.console) || {};
        return {
            log: fallback.log ? fallback.log.bind(fallback) : () => {},
            warn: fallback.warn ? fallback.warn.bind(fallback) : () => {},
            error: fallback.error ? fallback.error.bind(fallback) : () => {}
        };
    })();

    const cleanDomain = (value) => {
        if (!value) {
            return '';
        }
        return value
            .toString()
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '')
            .toLowerCase()
            .trim();
    };

    // Store-to-backend mapping
    const STORE_BACKEND_MAP = {
        // Default store
        'bidly-2.myshopify.com': 'https://bidly-auction-backend.onrender.com',
        
        // New store with second backend
        '6sb15z-k1.myshopify.com': 'https://bidly-auction-backend-2.onrender.com',
        'true-nordic-dev.myshopify.com': 'https://bidly-auction-backend-2.onrender.com',

        // Custom domains that map to the second backend store
        'true-nordic.com': 'https://bidly-auction-backend-2.onrender.com',
        'www.true-nordic.com': 'https://bidly-auction-backend-2.onrender.com',
    };

    // Canonical domain mapping (custom domains -> myshopify domain)
    const CANONICAL_DOMAIN_MAP = {
        'bidly-2.myshopify.com': 'bidly-2.myshopify.com',
        '6sb15z-k1.myshopify.com': '6sb15z-k1.myshopify.com',
        'true-nordic-dev.myshopify.com': '6sb15z-k1.myshopify.com',
        'true-nordic.com': '6sb15z-k1.myshopify.com',
        'www.true-nordic.com': '6sb15z-k1.myshopify.com'
    };

    // Default backend URL (fallback for stores not in the map)
    const DEFAULT_BACKEND = 'https://bidly-auction-backend.onrender.com';

    /**
     * Get backend URL for a given shop domain
     * @param {string} shopDomain - The shop's domain (e.g., 'mystore.myshopify.com')
     * @returns {string} The backend URL for that shop
     */
    function getBackendUrl(shopDomain) {
        if (!shopDomain) {
            console.warn('⚠️ Bidly: No shop domain provided, using default backend');
            return DEFAULT_BACKEND;
        }
        
        // Clean the shop domain (remove protocol, trailing slashes)
        const cleanShop = cleanDomain(shopDomain);
        
        // Check if we have a mapping for this shop
        const backendUrl = STORE_BACKEND_MAP[cleanShop];
        
        if (backendUrl) {
            console.log(`🔗 Bidly: Mapped shop "${cleanShop}" to backend: ${backendUrl}`);
            return backendUrl;
        }
        
        // Fallback to default
        console.log(`⚠️ Bidly: No mapping found for shop "${cleanShop}", using default backend: ${DEFAULT_BACKEND}`);
        return DEFAULT_BACKEND;
    }

    /**
     * Resolve the canonical (myshopify.com) domain for a given host.
     * Falls back to the cleaned input if no mapping is available.
     */
	 function getCanonicalShopDomain(domain) {
        const cleanShop = cleanDomain(domain);
        if (!cleanShop) {
            return '';
        }

        if (cleanShop.endsWith('.myshopify.com')) {
            return cleanShop;
        }

        return CANONICAL_DOMAIN_MAP[cleanShop] || cleanShop;
    }

    // Expose globally for use in auction-app-embed.js
    window.BidlyBackendConfig = {
        getBackendUrl: getBackendUrl,
        getCanonicalShopDomain: getCanonicalShopDomain,
        cleanDomain: cleanDomain,
        STORE_BACKEND_MAP: STORE_BACKEND_MAP,
        CANONICAL_DOMAIN_MAP: CANONICAL_DOMAIN_MAP,
        DEFAULT_BACKEND: DEFAULT_BACKEND
    };

    console.log('✅ Bidly: Backend config loaded');
})();

