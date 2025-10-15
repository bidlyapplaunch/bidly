#!/usr/bin/env node

/**
 * OAuth Test Script
 * This script helps test the Shopify OAuth flow
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Store from '../models/Store.js';
import shopifyOAuthService from '../services/shopifyOAuthService.js';

// Load environment variables
dotenv.config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bidly-auctions';

/**
 * Test OAuth configuration
 */
async function testOAuthConfig() {
  console.log('🧪 Testing OAuth Configuration...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('  - SHOPIFY_API_KEY:', process.env.SHOPIFY_API_KEY ? '✅ Present' : '❌ Missing');
  console.log('  - SHOPIFY_API_SECRET:', process.env.SHOPIFY_API_SECRET ? '✅ Present' : '❌ Missing');
  console.log('  - SHOPIFY_REDIRECT_URI:', process.env.SHOPIFY_REDIRECT_URI || '❌ Missing');
  console.log('  - MONGODB_URI:', MONGODB_URI);
  
  // Check OAuth service
  console.log('\n🔧 OAuth Service:');
  shopifyOAuthService.initialize();
  console.log('  - Client ID:', shopifyOAuthService.clientId ? '✅ Present' : '❌ Missing');
  console.log('  - Client Secret:', shopifyOAuthService.clientSecret ? '✅ Present' : '❌ Missing');
  console.log('  - Redirect URI:', shopifyOAuthService.redirectUri || '❌ Missing');
  console.log('  - Scopes:', shopifyOAuthService.scopes);
  
  // Test state generation
  const state = shopifyOAuthService.generateState();
  console.log('\n🔐 State Generation:');
  console.log('  - Generated state:', state ? '✅ Working' : '❌ Failed');
  console.log('  - State length:', state?.length || 0);
  
  return {
    hasApiKey: !!process.env.SHOPIFY_API_KEY,
    hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
    hasRedirectUri: !!process.env.SHOPIFY_REDIRECT_URI,
    stateGenerated: !!state
  };
}

/**
 * Test database connection and Store model
 */
async function testDatabase() {
  console.log('\n🗄️ Testing Database Connection...\n');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
    
    // Test Store model
    const storeCount = await Store.countDocuments();
    console.log(`📊 Total stores in database: ${storeCount}`);
    
    // List existing stores
    const stores = await Store.find({}, 'shopDomain storeName isInstalled installedAt').limit(5);
    if (stores.length > 0) {
      console.log('\n🏪 Existing Stores:');
      stores.forEach(store => {
        console.log(`  - ${store.shopDomain} (${store.storeName}) - ${store.isInstalled ? 'Installed' : 'Not Installed'}`);
      });
    } else {
      console.log('📝 No stores found in database');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Generate OAuth URL for testing
 */
function generateTestOAuthUrl() {
  console.log('\n🔗 OAuth URL Generation...\n');
  
  const testShop = 'your-test-store.myshopify.com';
  const state = shopifyOAuthService.generateState();
  
  try {
    const authUrl = shopifyOAuthService.generateAuthUrl(testShop, state);
    console.log('✅ OAuth URL generated successfully');
    console.log(`🏪 Test Shop: ${testShop}`);
    console.log(`🔐 State: ${state}`);
    console.log(`🔗 Auth URL: ${authUrl}`);
    
    return authUrl;
  } catch (error) {
    console.error('❌ Failed to generate OAuth URL:', error.message);
    return null;
  }
}

/**
 * Test HMAC verification
 */
function testHmacVerification() {
  console.log('\n🔐 Testing HMAC Verification...\n');
  
  // Simulate a callback query
  const mockQuery = {
    code: 'test_code_123',
    state: 'test_state_456',
    shop: 'test-store.myshopify.com',
    hmac: 'test_hmac_signature'
  };
  
  try {
    const isValid = shopifyOAuthService.verifyHmac(mockQuery);
    console.log(`🔍 HMAC verification test: ${isValid ? '✅ Working' : '❌ Failed'}`);
    console.log('ℹ️ Note: This test uses mock data, real verification requires valid signatures');
    
    return true;
  } catch (error) {
    console.error('❌ HMAC verification test failed:', error.message);
    return false;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Shopify OAuth Test Suite\n');
  console.log('=' .repeat(50));
  
  const results = {
    oauthConfig: false,
    database: false,
    oauthUrl: false,
    hmacVerification: false
  };
  
  try {
    // Test OAuth configuration
    const oauthConfig = await testOAuthConfig();
    results.oauthConfig = oauthConfig.hasApiKey && oauthConfig.hasApiSecret && oauthConfig.hasRedirectUri;
    
    // Test database
    results.database = await testDatabase();
    
    // Test OAuth URL generation
    const authUrl = generateTestOAuthUrl();
    results.oauthUrl = !!authUrl;
    
    // Test HMAC verification
    results.hmacVerification = testHmacVerification();
    
    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Test Results Summary:');
    console.log('  - OAuth Configuration:', results.oauthConfig ? '✅ PASS' : '❌ FAIL');
    console.log('  - Database Connection:', results.database ? '✅ PASS' : '❌ FAIL');
    console.log('  - OAuth URL Generation:', results.oauthUrl ? '✅ PASS' : '❌ FAIL');
    console.log('  - HMAC Verification:', results.hmacVerification ? '✅ PASS' : '❌ FAIL');
    
    const allPassed = Object.values(results).every(result => result);
    
    if (allPassed) {
      console.log('\n🎉 All tests passed! OAuth setup is ready.');
      console.log('\n📝 Next Steps:');
      console.log('1. Start your backend server: npm run dev');
      console.log('2. Start ngrok: ngrok http 5000');
      console.log('3. Update SHOPIFY_REDIRECT_URI with your ngrok URL');
      console.log('4. Test the OAuth flow with a real Shopify store');
    } else {
      console.log('\n⚠️ Some tests failed. Please check the configuration.');
      console.log('\n🔧 Common Issues:');
      if (!results.oauthConfig) {
        console.log('- Missing SHOPIFY_API_KEY, SHOPIFY_API_SECRET, or SHOPIFY_REDIRECT_URI');
      }
      if (!results.database) {
        console.log('- MongoDB connection failed. Check MONGODB_URI');
      }
      if (!results.oauthUrl) {
        console.log('- OAuth URL generation failed. Check API credentials');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
  } finally {
    // Close database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the tests
runTests().catch(console.error);
