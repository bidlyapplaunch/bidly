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
      
      // Try to get products using GraphQL
      console.log('🔍 Testing products API (GraphQL)...');
      const productsResponse = await client.post('/graphql.json', {
        query: `
          query GetProducts($first: Int!) {
            products(first: $first, sortKey: UPDATED_AT, reverse: true) {
              edges {
                node {
                  id
                  title
                  handle
                  status
                }
              }
            }
          }
        `,
        variables: { first: 5 }
      });
      
      if (productsResponse.data?.errors) {
        throw new Error(productsResponse.data.errors.map(err => err.message).join('; '));
      }
      
      console.log('✅ Products API works!');
      
      const productEdges = productsResponse.data?.data?.products?.edges || [];
      const productsData = {
        count: productEdges.length,
        products: productEdges.map(edge => {
          const id = edge.node.id.split('/').pop();
          return {
            id,
            title: edge.node.title,
            handle: edge.node.handle,
            status: edge.node.status
          };
        })
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

// Clear store record (force reinstall)
router.delete('/clear-store/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    
    console.log(`🗑️ Clearing store record for: ${shopDomain}`);
    
    const result = await Store.deleteOne({ shopDomain });
    
    if (result.deletedCount > 0) {
      console.log('✅ Successfully deleted store record');
      res.json({
        success: true,
        message: `Store record cleared for ${shopDomain}`,
        deletedCount: result.deletedCount
      });
    } else {
      res.json({
        success: false,
        message: `No store record found for ${shopDomain}`,
        deletedCount: 0
      });
    }
    
  } catch (error) {
    console.error('❌ Error clearing store record:', error);
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
      plan: store.plan || 'free',
      planManuallySet: store.planManuallySet || false,
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

// Manually set store plan (bypasses Shopify sync)
router.post('/set-plan/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    const { plan } = req.body;
    
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: 'Plan is required in request body'
      });
    }
    
    const validPlans = ['free', 'basic', 'pro', 'enterprise'];
    const planKey = plan.toLowerCase();
    if (!validPlans.includes(planKey)) {
      return res.status(400).json({
        success: false,
        message: `Invalid plan. Must be one of: ${validPlans.join(', ')}`
      });
    }
    
    const store = await Store.findByDomain(shopDomain);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: `Store ${shopDomain} not found`
      });
    }
    
    const previousPlan = store.plan || 'free';
    store.plan = planKey;
    store.planManuallySet = true;
    store.pendingPlan = null;
    store.planActiveAt = new Date();
    await store.save();
    
    console.log(`✅ Manually set plan for ${shopDomain}: ${previousPlan} → ${planKey}`);
    
    res.json({
      success: true,
      message: `Plan manually set to ${planKey} for ${shopDomain}`,
      shopDomain,
      previousPlan,
      newPlan: planKey,
      planManuallySet: true
    });
    
  } catch (error) {
    console.error('❌ Error setting plan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Clear manual plan override (allow Shopify sync again)
router.post('/clear-plan-override/:shopDomain', async (req, res) => {
  try {
    const { shopDomain } = req.params;
    
    const store = await Store.findByDomain(shopDomain);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: `Store ${shopDomain} not found`
      });
    }
    
    store.planManuallySet = false;
    await store.save();
    
    console.log(`✅ Cleared manual plan override for ${shopDomain}`);
    
    res.json({
      success: true,
      message: `Manual plan override cleared for ${shopDomain}`,
      shopDomain,
      planManuallySet: false,
      note: 'Plan will now sync from Shopify subscriptions'
    });
    
  } catch (error) {
    console.error('❌ Error clearing plan override:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

export default router;
