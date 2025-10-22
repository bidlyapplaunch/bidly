import express from 'express';
import Store from '../models/Store.js';
import getShopifyService from '../services/shopifyService.js';

const router = express.Router();

/**
 * Debug Routes
 * These routes help debug OAuth and API issues
 * Only use in development - remove in production
 */

// Test OAuth token for a specific store
router.get('/oauth-test/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    
    console.log(`🔍 Testing OAuth token for: ${shopDomain}`);
    
    // Get the store record
    const store = await Store.findByDomain(shopDomain);
    
    if (!store) {
      return res.json({
        success: false,
        message: 'Store not found in database',
        shopDomain
      });
    }
    
    const storeInfo = {
      domain: store.shopDomain,
      name: store.storeName,
      installed: store.isInstalled,
      hasToken: !!store.accessToken,
      tokenLength: store.accessToken ? store.accessToken.length : 0,
      tokenPreview: store.accessToken ? store.accessToken.substring(0, 20) + '...' : 'None',
      scope: store.scope || 'None',
      lastAccess: store.lastAccessAt || 'Never',
      createdAt: store.createdAt,
      updatedAt: store.updatedAt
    };
    
    console.log('🏪 Store info:', storeInfo);
    
    if (!store.accessToken) {
      return res.json({
        success: false,
        message: 'No access token found',
        storeInfo
      });
    }
    
    // Test the token with Shopify API
    console.log('🧪 Testing token with Shopify API...');
    
    try {
      const shopifyService = getShopifyService();
      const { client } = await shopifyService.getStoreClient(shopDomain);
      
      // Try to get shop info
      console.log('🔍 Testing shop info API...');
      const shopResponse = await client.get('/shop.json');
      console.log('✅ Shop info API works!');
      
      const shopData = {
        name: shopResponse.data.shop.name,
        domain: shopResponse.data.shop.domain,
        plan: shopResponse.data.shop.plan_name,
        currency: shopResponse.data.shop.currency,
        timezone: shopResponse.data.shop.timezone
      };
      
      // Try to get products
      console.log('🔍 Testing products API...');
      const productsResponse = await client.get('/products.json', {
        params: { limit: 5 }
      });
      console.log('✅ Products API works!');
      
      const productsData = {
        count: productsResponse.data.products.length,
        products: productsResponse.data.products.map(p => ({
          id: p.id,
          title: p.title,
          handle: p.handle,
          status: p.status
        }))
      };
      
      return res.json({
        success: true,
        message: 'OAuth token is working correctly',
        storeInfo,
        shopData,
        productsData
      });
      
    } catch (error) {
      console.log('❌ Token test failed:', error.response?.data || error.message);
      
      return res.json({
        success: false,
        message: 'OAuth token test failed',
        error: {
          status: error.response?.status,
          message: error.response?.data?.errors || error.message,
          details: error.response?.data
        },
        storeInfo
      });
    }
    
  } catch (error) {
    console.error('❌ Error in OAuth test:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// List all stores
router.get('/stores', async (req, res) => {
  try {
    const stores = await Store.find({});
    
    const storesInfo = stores.map(store => ({
      domain: store.shopDomain,
      name: store.storeName,
      installed: store.isInstalled,
      hasToken: !!store.accessToken,
      tokenLength: store.accessToken ? store.accessToken.length : 0,
      scope: store.scope || 'None',
      lastAccess: store.lastAccessAt || 'Never',
      createdAt: store.createdAt,
      updatedAt: store.updatedAt
    }));
    
    res.json({
      success: true,
      message: `Found ${stores.length} stores`,
      stores: storesInfo
    });
    
  } catch (error) {
    console.error('❌ Error listing stores:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

export default router;
