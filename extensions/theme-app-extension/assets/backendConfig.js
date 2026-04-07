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

    // Single backend for all stores (public app)
    const BACKEND_URL = 'https://bidly-auction-backend.onrender.com';

    // Custom domain -> myshopify.com mapping (add entries when merchants use custom domains)
    const CANONICAL_DOMAIN_MAP = {
        'true-nordic.com': '6sb15z-k1.myshopify.com',
        'www.true-nordic.com': '6sb15z-k1.myshopify.com'
    };

    /**
     * Get backend URL for a given shop domain
     * @param {string} shopDomain - The shop's domain (e.g., 'mystore.myshopify.com')
     * @returns {string} The backend URL for that shop
     */
    function getBackendUrl(shopDomain) {
        return BACKEND_URL;
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
        CANONICAL_DOMAIN_MAP: CANONICAL_DOMAIN_MAP,
        BACKEND_URL: BACKEND_URL
    };

    // Consolidate under window.Bidly namespace (keep existing name for backward compat)
    window.Bidly = window.Bidly || {};
    window.Bidly.BackendConfig = window.BidlyBackendConfig;

    console.log('✅ Bidly: Backend config loaded');
})();

