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
    const urlParams = new URLSearchParams(window.location.search);
    
    // Try to get shop from URL params first
    let shop = urlParams.get('shop');
    
    // If not found, try to extract from the hostname (for embedded apps)
    if (!shop && window.location.hostname.includes('myshopify.com')) {
      shop = window.location.hostname;
    }
    
    // If still not found, try to get from App Bridge context
    if (!shop && window.shopify && window.shopify.config) {
      shop = window.shopify.config.shop;
    }
    
    // If still not found, try to get from the global App Bridge data
    if (!shop && window.shopifyAppBridgeData) {
      shop = window.shopifyAppBridgeData.shop;
    }
    
    console.log('🔍 getShopInfo - Found shop:', shop);
    console.log('🔍 getShopInfo - URL:', window.location.href);
    console.log('🔍 getShopInfo - Hostname:', window.location.hostname);
    
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
