#!/usr/bin/env node

/**
 * Check Store Script
 * This script checks the store record in the database
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Store from '../models/Store.js';

// Load environment variables
dotenv.config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auctions';

async function checkStore() {
  try {
    console.log('🔍 Checking store in database...\n');
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');
    
    // Find the store with access token
    const store = await Store.findOne({ shopDomain: 'ezza-auction.myshopify.com' }).select('+accessToken');
    
    if (!store) {
      console.log('❌ Store not found in database');
      return;
    }
    
    console.log('📊 Store Information:');
    console.log('  - Shop Domain:', store.shopDomain);
    console.log('  - Store Name:', store.storeName);
    console.log('  - Is Installed:', store.isInstalled);
    console.log('  - Has Access Token:', !!store.accessToken);
    console.log('  - Access Token Length:', store.accessToken ? store.accessToken.length : 0);
    console.log('  - Scope:', store.scope);
    console.log('  - Installed At:', store.installedAt);
    console.log('  - Last Access At:', store.lastAccessAt);
    
    if (!store.accessToken) {
      console.log('\n⚠️ No access token found! This means the OAuth flow didn\'t complete properly.');
      console.log('💡 You may need to reinstall the app or check the OAuth callback logs.');
    } else {
      console.log('\n✅ Store has access token - OAuth flow completed successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

checkStore();
