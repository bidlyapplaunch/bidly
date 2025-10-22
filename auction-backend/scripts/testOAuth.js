import mongoose from 'mongoose';
import Store from '../models/Store.js';
import getShopifyService from '../services/shopifyService.js';

// Connect to database
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auctions';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

// Test OAuth token
const testOAuthToken = async () => {
  try {
    console.log('\n🔍 Testing OAuth token for bidly-2.myshopify.com...\n');
    
    // Get the store record
    const store = await Store.findByDomain('bidly-2.myshopify.com');
    
    if (!store) {
      console.log('❌ Store not found in database');
      return;
    }
    
    console.log('🏪 Store found:');
    console.log(`   - Domain: ${store.shopDomain}`);
    console.log(`   - Name: ${store.storeName}`);
    console.log(`   - Installed: ${store.isInstalled}`);
    console.log(`   - Has Token: ${store.accessToken ? 'Yes' : 'No'}`);
    console.log(`   - Token Length: ${store.accessToken ? store.accessToken.length : 0}`);
    console.log(`   - Token Preview: ${store.accessToken ? store.accessToken.substring(0, 20) + '...' : 'None'}`);
    console.log(`   - Scope: ${store.scope || 'None'}`);
    console.log(`   - Last Access: ${store.lastAccessAt || 'Never'}`);
    
    if (!store.accessToken) {
      console.log('❌ No access token found!');
      return;
    }
    
    // Test the token with Shopify API
    console.log('\n🧪 Testing token with Shopify API...');
    
    try {
      const shopifyService = getShopifyService();
      const { client } = await shopifyService.getStoreClient('bidly-2.myshopify.com');
      
      // Try to get shop info
      console.log('🔍 Testing shop info API...');
      const shopResponse = await client.get('/shop.json');
      console.log('✅ Shop info API works!');
      console.log(`   - Shop Name: ${shopResponse.data.shop.name}`);
      console.log(`   - Shop Domain: ${shopResponse.data.shop.domain}`);
      console.log(`   - Shop Plan: ${shopResponse.data.shop.plan_name}`);
      
      // Try to get products
      console.log('\n🔍 Testing products API...');
      const productsResponse = await client.get('/products.json', {
        params: { limit: 5 }
      });
      console.log('✅ Products API works!');
      console.log(`   - Found ${productsResponse.data.products.length} products`);
      
      if (productsResponse.data.products.length > 0) {
        console.log(`   - First product: ${productsResponse.data.products[0].title}`);
      }
      
    } catch (error) {
      console.log('❌ Token test failed:');
      console.log(`   - Status: ${error.response?.status}`);
      console.log(`   - Error: ${error.response?.data?.errors || error.message}`);
      
      if (error.response?.data?.errors) {
        console.log('   - Shopify Errors:', error.response.data.errors);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing OAuth token:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await testOAuthToken();
  process.exit(0);
};

main();