#!/usr/bin/env node

/**
 * Update Existing Auctions Script
 * This script fetches product data for existing auctions that don't have productData
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Auction from '../models/Auction.js';
import getShopifyService from '../services/shopifyService.js';

// Load environment variables
dotenv.config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auctions';

async function updateExistingAuctions() {
  try {
    console.log('🔄 Updating existing auctions with product data...\n');
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');
    
    const shopifyService = getShopifyService();
    const shopDomain = 'ezza-auction.myshopify.com';
    
    // Find auctions that don't have productData or have null productData
    const auctionsToUpdate = await Auction.find({
      $or: [
        { productData: null },
        { productData: { $exists: false } }
      ]
    });
    
    console.log(`📦 Found ${auctionsToUpdate.length} auctions to update`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const auction of auctionsToUpdate) {
      try {
        console.log(`\n🔄 Updating auction: ${auction.shopifyProductId}`);
        
        // Skip if shopifyProductId is not a valid Shopify product ID
        if (!auction.shopifyProductId || isNaN(auction.shopifyProductId)) {
          console.log(`⚠️ Skipping invalid product ID: ${auction.shopifyProductId}`);
          continue;
        }
        
        // Fetch product data from Shopify
        const productData = await shopifyService.getProduct(shopDomain, auction.shopifyProductId);
        
        if (productData) {
          // Update the auction with product data
          auction.productData = productData;
          await auction.save();
          
          console.log(`✅ Updated: ${productData.title} - $${productData.price}`);
          successCount++;
        } else {
          console.log(`❌ No product data found for: ${auction.shopifyProductId}`);
          errorCount++;
        }
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`❌ Error updating auction ${auction.shopifyProductId}: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Update Summary:`);
    console.log(`  - Successfully updated: ${successCount} auctions`);
    console.log(`  - Errors: ${errorCount} auctions`);
    console.log(`  - Total processed: ${auctionsToUpdate.length} auctions`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

updateExistingAuctions();
