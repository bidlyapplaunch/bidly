#!/usr/bin/env node

/**
 * Set Enterprise Plan Script
 * This script sets the store plan to enterprise
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Store from '../models/Store.js';

// Load environment variables
dotenv.config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auctions';

async function setEnterprisePlan() {
  try {
    console.log('🚀 Setting store to enterprise plan...\n');
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');
    
    // Find the store - get from command line argument or use default
    const shopDomain = process.argv[2] || '6sb15z-k1.myshopify.com';
    const store = await Store.findByDomain(shopDomain);
    
    if (!store) {
      console.log(`❌ Store ${shopDomain} not found in database`);
      return;
    }
    
    const previousPlan = store.plan || 'free';
    console.log(`📊 Current plan: ${previousPlan}`);
    
    // Set plan to enterprise
    store.plan = 'enterprise';
    store.planManuallySet = true;
    store.pendingPlan = null;
    store.planActiveAt = new Date();
    await store.save();
    
    console.log(`✅ Successfully set plan to enterprise`);
    console.log(`   Previous plan: ${previousPlan}`);
    console.log(`   New plan: enterprise`);
    console.log(`   Plan manually set: true`);
    console.log(`   Plan active at: ${store.planActiveAt}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

setEnterprisePlan();

