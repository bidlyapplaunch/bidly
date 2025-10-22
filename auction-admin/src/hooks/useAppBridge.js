// Note: App Bridge React hooks are not available in this version
// This is a simplified version for basic functionality

/**
 * Custom hook for App Bridge functionality
 * Provides easy access to App Bridge actions and utilities
 */
export const useAppBridgeActions = () => {
  // Simplified version without App Bridge hooks
  const app = null;
  const navigate = null;

  // Simplified navigation functions
  const navigateTo = (path) => {
    window.location.href = path;
  };

  const navigateToAdmin = (path) => {
    window.location.href = path;
  };

  const navigateToExternal = (url) => {
    window.open(url, '_blank');
  };

  // Get current shop information
  const getShopInfo = () => {
    console.log('🔍 getShopInfo - Current URL:', window.location.href);
    console.log('🔍 getShopInfo - Search params:', window.location.search);
    
    const urlParams = new URLSearchParams(window.location.search);
    
    // Try multiple sources for shop domain
    let shop = urlParams.get('shop');
    
    // If not in search params, try to extract from hash or other sources
    if (!shop) {
      // Check if shop is in the hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      shop = hashParams.get('shop');
    }
    
    // If still not found, try to extract from the hostname (for embedded apps)
    if (!shop && window.location.hostname.includes('myshopify.com')) {
      shop = window.location.hostname;
    }
    
    // If still not found, try to get from App Bridge context (if available)
    if (!shop && window.shopify && window.shopify.config) {
      shop = window.shopify.config.shop;
    }
    
    // If still not found, try to get from global App Bridge context
    if (!shop && window.shopifyAppBridge) {
      try {
        const app = window.shopifyAppBridge.createApp({
          apiKey: process.env.REACT_APP_SHOPIFY_API_KEY,
          shopOrigin: window.location.hostname
        });
        shop = app.getState().shop;
      } catch (e) {
        console.log('🔍 App Bridge context not available:', e.message);
      }
    }
    
    // If still not found, try to get from the App Bridge initialization data
    if (!shop && window.shopifyAppBridgeData) {
      shop = window.shopifyAppBridgeData.shop;
    }
    
    // If still not found, try to get from the global shop variable
    if (!shop && window.shop) {
      shop = window.shop;
    }
    
    // Debug logging
    console.log('🔍 getShopInfo - Found shop:', shop);
    console.log('🔍 getShopInfo - All URL params:', Object.fromEntries(urlParams.entries()));
    console.log('🔍 getShopInfo - Window.shopify:', window.shopify);
    console.log('🔍 getShopInfo - Window.shopifyAppBridge:', window.shopifyAppBridge);
    
    return {
      shop: shop,
      installed: urlParams.get('installed') === 'true',
      success: urlParams.get('success') === 'true',
      error: urlParams.get('error'),
      message: urlParams.get('message')
    };
  };

  return {
    app,
    navigateTo,
    navigateToAdmin,
    navigateToExternal,
    getShopInfo
  };
};
