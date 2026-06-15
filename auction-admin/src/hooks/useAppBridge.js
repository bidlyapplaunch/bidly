/**
 * Custom hook for App Bridge functionality
 * Provides access to the current shop context derived from the URL/embedded app.
 */
export const useAppBridgeActions = () => {
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

    return {
      shop: shop,
      installed: urlParams.get('installed') === 'true',
      success: urlParams.get('success') === 'true',
      error: urlParams.get('error'),
      message: urlParams.get('message')
    };
  };

  return {
    getShopInfo
  };
};
