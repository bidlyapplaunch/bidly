import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Store from '../models/Store.js';
import getShopifyService from '../services/shopifyService.js';

// Load environment variables
dotenv.config();

const verifyInstallation = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auctions';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    const shopDomain = 'bidly-2.myshopify.com';
    console.log(`\n🔍 Verifying installation for: ${shopDomain}`);
    console.log('=====================================');

    // Check if store exists
    const store = await Store.findByDomain(shopDomain);
    if (!store) {
      console.log('❌ Store not found in database');
      console.log('💡 Please complete the OAuth installation first');
      return;
    }

    console.log('✅ Store found in database');
    console.log(`   - Store Name: ${store.storeName}`);
    console.log(`   - Is Installed: ${store.isInstalled}`);
    console.log(`   - Has Access Token: ${!!store.accessToken}`);
    console.log(`   - Access Token Preview: ${store.accessToken ? store.accessToken.substring(0, 20) + '...' : 'None'}`);

    if (!store.accessToken || store.accessToken === 'temp-token') {
      console.log('❌ Invalid access token');
      console.log('💡 Please complete the OAuth flow to get a real token');
      return;
    }

    // Test Shopify API
    try {
      console.log('\n🧪 Testing Shopify API...');
      const shopifyService = getShopifyService();
      const products = await shopifyService.searchProducts(shopDomain, 'test', 1);
      console.log('✅ Shopify API working!');
      console.log(`   - Found ${products.length} products`);
    } catch (error) {
      console.log('❌ Shopify API test failed:', error.message);
      console.log('💡 The access token might be invalid or expired');
    }

  } catch (error) {
    console.error('❌ Error verifying installation:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

verifyInstallation();
