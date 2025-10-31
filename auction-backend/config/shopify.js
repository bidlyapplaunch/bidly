import { shopifyApi } from '@shopify/admin-api-client';

// Shopify configuration
const shopifyConfig = {
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET_KEY,
  scopes: ['read_products', 'read_product_listings'],
  hostName: process.env.SHOPIFY_SHOP_DOMAIN, // e.g., 'your-shop.myshopify.com'
  apiVersion: '2025-10',
  isEmbeddedApp: false,
  isPrivateApp: true, // Set to true if using private app
};

// Initialize Shopify API client
export const shopify = shopifyApi(shopifyConfig);

// Helper function to get access token (for private apps)
export const getAccessToken = () => {
  return process.env.SHOPIFY_ACCESS_TOKEN;
};

// Helper function to get shop domain
export const getShopDomain = () => {
  return process.env.SHOPIFY_SHOP_DOMAIN;
};

export default shopify;

