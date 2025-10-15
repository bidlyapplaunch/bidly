#!/usr/bin/env node

/**
 * Test Search Script
 * This script tests the search functionality directly
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import getShopifyService from '../services/shopifyService.js';

// Load environment variables
dotenv.config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auctions';

async function testSearch() {
  try {
    console.log('🔍 Testing search functionality...\n');
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');
    
    const shopifyService = getShopifyService();
    const shopDomain = 'ezza-auction.myshopify.com';
    
    console.log('🧪 Testing search for "gift"...');
    const results = await shopifyService.searchProducts(shopDomain, 'gift', 10);
    
    console.log('📊 Search Results:');
    console.log(`  - Found ${results.length} products`);
    
    if (results.length > 0) {
      results.forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.title} - $${product.price}`);
      });
    } else {
      console.log('  No products found');
    }
    
    console.log('\n🧪 Testing search for "Card"...');
    const results2 = await shopifyService.searchProducts(shopDomain, 'Card', 10);
    
    console.log('📊 Search Results:');
    console.log(`  - Found ${results2.length} products`);
    
    if (results2.length > 0) {
      results2.forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.title} - $${product.price}`);
      });
    } else {
      console.log('  No products found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

testSearch();
