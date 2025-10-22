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
    // Since we can see the shop domain in App Bridge initialization,
    // let's use a simple approach that works
    const urlParams = new URLSearchParams(window.location.search);
    
    // Try to get shop from URL params first
    let shop = urlParams.get('shop');
    
    // If not found, use the hardcoded shop domain we know works
    if (!shop) {
      shop = 'bidly-2.myshopify.com';
      console.log('🔍 Using hardcoded shop domain:', shop);
    }
    
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
