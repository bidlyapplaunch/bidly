import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Store from '../models/Store.js';

// Load environment variables
dotenv.config();

const checkStoreStatus = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auctions';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Check all stores
    const stores = await Store.find({}).select('+accessToken');
    console.log('\n📊 All stores in database:');
    console.log('=====================================');
    
    if (stores.length === 0) {
      console.log('❌ No stores found in database');
      return;
    }

    stores.forEach((store, index) => {
      console.log(`\n${index + 1}. Store: ${store.shopDomain}`);
      console.log(`   - Store Name: ${store.storeName}`);
      console.log(`   - Is Installed: ${store.isInstalled}`);
      console.log(`   - Installed At: ${store.installedAt}`);
      console.log(`   - Has Access Token: ${!!store.accessToken}`);
      console.log(`   - Access Token Preview: ${store.accessToken ? store.accessToken.substring(0, 20) + '...' : 'None'}`);
      console.log(`   - Plan: ${store.planName}`);
      console.log(`   - Currency: ${store.currency}`);
    });

    // Check specific store
    const targetStore = 'bidly-2.myshopify.com';
    console.log(`\n🔍 Checking specific store: ${targetStore}`);
    console.log('=====================================');
    
    const store = await Store.findByDomain(targetStore);
    if (store) {
      console.log('✅ Store found in database');
      console.log(`   - Store Name: ${store.storeName}`);
      console.log(`   - Is Installed: ${store.isInstalled}`);
      console.log(`   - Has Access Token: ${!!store.accessToken}`);
      console.log(`   - Access Token: ${store.accessToken || 'None'}`);
    } else {
      console.log('❌ Store NOT found in database');
      console.log('💡 This store needs to be installed first');
    }

  } catch (error) {
    console.error('❌ Error checking store status:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

checkStoreStatus();
