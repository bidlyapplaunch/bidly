import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Store from '../models/Store.js';
import getShopifyService from '../services/shopifyService.js';

// Load environment variables
dotenv.config();

const testShopifyAPI = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auctions';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    const shopDomain = 'bidly-2.myshopify.com';
    console.log(`\n🧪 Testing Shopify API for store: ${shopDomain}`);
    console.log('=====================================');

    // Get store from database
    const store = await Store.findByDomain(shopDomain);
    if (!store) {
      console.log('❌ Store not found in database');
      return;
    }

    console.log('✅ Store found in database');
    console.log(`   - Access Token: ${store.accessToken ? store.accessToken.substring(0, 20) + '...' : 'None'}`);

    // Test Shopify service
    try {
      console.log('\n🔍 Testing Shopify service initialization...');
      const shopifyService = getShopifyService();
      console.log('✅ Shopify service initialized');

      console.log('\n🔍 Testing product search...');
      const products = await shopifyService.searchProducts(shopDomain, 'test', 5);
      console.log('✅ Product search successful');
      console.log(`   - Found ${products.length} products`);
      
      if (products.length > 0) {
        console.log('   - First product:', {
          id: products[0].id,
          title: products[0].title,
          handle: products[0].handle
        });
      }

    } catch (shopifyError) {
      console.log('❌ Shopify API error:', shopifyError.message);
      console.log('   - Error details:', shopifyError);
    }

  } catch (error) {
    console.error('❌ Error testing Shopify API:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

testShopifyAPI();
