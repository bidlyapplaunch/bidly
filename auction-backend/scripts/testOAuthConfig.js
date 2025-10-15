import dotenv from 'dotenv';
import shopifyOAuthService from '../services/shopifyOAuthService.js';

dotenv.config({ path: './.env' });

const testOAuthConfig = () => {
  console.log('🔧 Testing OAuth Configuration...');
  
  // Initialize the service
  shopifyOAuthService.initialize();
  
  console.log('\n📊 Environment Variables:');
  console.log('  - SHOPIFY_CLIENT_ID:', process.env.SHOPIFY_CLIENT_ID ? 'Present' : 'Missing');
  console.log('  - SHOPIFY_CLIENT_SECRET:', process.env.SHOPIFY_CLIENT_SECRET ? 'Present' : 'Missing');
  console.log('  - SHOPIFY_API_KEY:', process.env.SHOPIFY_API_KEY ? 'Present' : 'Missing');
  console.log('  - SHOPIFY_API_SECRET:', process.env.SHOPIFY_API_SECRET ? 'Present' : 'Missing');
  console.log('  - SHOPIFY_REDIRECT_URI:', process.env.SHOPIFY_REDIRECT_URI || 'Missing');
  console.log('  - APP_URL:', process.env.APP_URL || 'Missing');
  
  console.log('\n🔧 OAuth Service Configuration:');
  console.log('  - Client ID:', shopifyOAuthService.clientId ? 'Present' : 'Missing');
  console.log('  - Client Secret:', shopifyOAuthService.clientSecret ? 'Present' : 'Missing');
  console.log('  - Redirect URI:', shopifyOAuthService.redirectUri || 'Missing');
  console.log('  - Scopes:', shopifyOAuthService.scopes);
  console.log('  - API Version:', shopifyOAuthService.apiVersion);
  
  // Test generating auth URL
  try {
    const testShop = '1wq3uw-pm.myshopify.com';
    const state = 'test-state';
    const authUrl = shopifyOAuthService.generateAuthUrl(testShop, state);
    console.log('\n✅ Auth URL Generation Test:');
    console.log('  - Test Shop:', testShop);
    console.log('  - Generated URL:', authUrl);
  } catch (error) {
    console.log('\n❌ Auth URL Generation Failed:');
    console.log('  - Error:', error.message);
  }
  
  console.log('\n🎯 Configuration Status:');
  if (shopifyOAuthService.clientId && shopifyOAuthService.clientSecret && shopifyOAuthService.redirectUri) {
    console.log('  ✅ OAuth configuration is complete');
  } else {
    console.log('  ❌ OAuth configuration is incomplete');
    console.log('  🔧 Missing variables:');
    if (!shopifyOAuthService.clientId) console.log('    - SHOPIFY_CLIENT_ID or SHOPIFY_API_KEY');
    if (!shopifyOAuthService.clientSecret) console.log('    - SHOPIFY_CLIENT_SECRET or SHOPIFY_API_SECRET');
    if (!shopifyOAuthService.redirectUri) console.log('    - SHOPIFY_REDIRECT_URI');
  }
};

testOAuthConfig();
