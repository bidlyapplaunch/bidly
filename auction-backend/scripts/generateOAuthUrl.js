#!/usr/bin/env node

/**
 * Generate OAuth Installation URL
 * This script creates the correct OAuth URL for installing the app
 */

import ShopifyOAuthService from '../services/shopifyOAuthService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

const shopifyOAuthService = ShopifyOAuthService;

// Get shop domain from command line argument
const shopDomain = process.argv[2];

if (!shopDomain) {
  console.log('❌ Please provide a shop domain');
  console.log('Usage: node generateOAuthUrl.js <shop-domain>');
  console.log('Example: node generateOAuthUrl.js 1wq3uw-pm.myshopify.com');
  process.exit(1);
}

try {
  // Initialize the service to load configuration
  shopifyOAuthService.initialize();
  
  // Generate state parameter for security
  const state = shopifyOAuthService.generateState();
  
  // Generate the OAuth URL
  const authUrl = shopifyOAuthService.generateAuthUrl(shopDomain, state);
  
  console.log('🔗 OAuth Installation URL:');
  console.log('');
  console.log(authUrl);
  console.log('');
  console.log('📋 Copy this URL and paste it in your browser to install the app');
  console.log('');
  console.log('🔧 Configuration:');
  console.log(`  - Shop Domain: ${shopDomain}`);
  console.log(`  - Client ID: ${shopifyOAuthService.clientId}`);
  console.log(`  - Redirect URI: ${shopifyOAuthService.redirectUri}`);
  console.log(`  - Scopes: ${shopifyOAuthService.scopes}`);
  console.log(`  - State: ${state}`);
  
} catch (error) {
  console.error('❌ Error generating OAuth URL:', error.message);
  process.exit(1);
}
