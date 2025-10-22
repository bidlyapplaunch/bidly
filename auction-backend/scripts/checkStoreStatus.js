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

// Check store status
const checkStoreStatus = async () => {
  try {
    console.log('\n🔍 Checking store status...\n');
    
    // Get all stores
    const stores = await Store.find({});
    console.log(`📊 Found ${stores.length} stores in database:`);
    
    for (const store of stores) {
      console.log(`\n🏪 Store: ${store.shopDomain}`);
      console.log(`   - Name: ${store.storeName}`);
      console.log(`   - Email: ${store.storeEmail}`);
      console.log(`   - Installed: ${store.isInstalled}`);
      console.log(`   - Has Token: ${store.accessToken ? 'Yes' : 'No'}`);
      console.log(`   - Token Length: ${store.accessToken ? store.accessToken.length : 0}`);
      console.log(`   - Created: ${store.createdAt}`);
      console.log(`   - Updated: ${store.updatedAt}`);
      
      // Test the token
      if (store.accessToken && store.isInstalled) {
        try {
          console.log(`   🔍 Testing token for ${store.shopDomain}...`);
          const shopifyService = getShopifyService();
          const { client } = await shopifyService.getStoreClient(store.shopDomain);
          
          // Try to get shop info
          const response = await client.get('/shop.json');
          console.log(`   ✅ Token works! Shop: ${response.data.shop.name}`);
        } catch (error) {
          console.log(`   ❌ Token failed: ${error.response?.data?.errors || error.message}`);
        }
      }
    }
    
    // Check specifically for bidly-2.myshopify.com
    console.log('\n🎯 Checking bidly-2.myshopify.com specifically...');
    const bidlyStore = await Store.findByDomain('bidly-2.myshopify.com');
    
    if (!bidlyStore) {
      console.log('❌ bidly-2.myshopify.com not found in database');
      console.log('💡 You need to install the app for this store first');
    } else {
      console.log('✅ Found bidly-2.myshopify.com in database');
      console.log(`   - Installed: ${bidlyStore.isInstalled}`);
      console.log(`   - Has Token: ${bidlyStore.accessToken ? 'Yes' : 'No'}`);
      
      if (bidlyStore.accessToken) {
        try {
          console.log('🔍 Testing token...');
          const shopifyService = getShopifyService();
          const { client } = await shopifyService.getStoreClient('bidly-2.myshopify.com');
          const response = await client.get('/shop.json');
          console.log(`✅ Token works! Shop: ${response.data.shop.name}`);
        } catch (error) {
          console.log(`❌ Token failed: ${error.response?.data?.errors || error.message}`);
          console.log('💡 The token might be expired or invalid');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking store status:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await checkStoreStatus();
  process.exit(0);
};

main();