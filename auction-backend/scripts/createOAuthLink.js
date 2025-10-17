import crypto from 'crypto';

const createOAuthLink = () => {
  const shopDomain = 'bidly-2.myshopify.com';
  const apiKey = process.env.SHOPIFY_API_KEY || '4d6fd182c13268701d61dc45f76c735e';
  const apiSecret = process.env.SHOPIFY_API_SECRET || 'your_secret_here';
  const redirectUri = 'https://bidly-auction-backend.onrender.com/auth/shopify/callback';
  
  // Generate a random state parameter for security
  const state = crypto.randomBytes(16).toString('hex');
  
  // Create the OAuth URL
  const oauthUrl = `https://${shopDomain}/admin/oauth/authorize?` +
    `client_id=${apiKey}&` +
    `scope=read_products,read_product_listings,read_orders,write_orders&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${state}`;
  
  console.log('🔗 OAuth Installation URL:');
  console.log('=====================================');
  console.log(oauthUrl);
  console.log('\n📋 Instructions:');
  console.log('1. Copy the URL above');
  console.log('2. Open it in your browser');
  console.log('3. Log in to your Shopify store');
  console.log('4. Accept the app permissions');
  console.log('5. You will be redirected to the admin dashboard');
  console.log('\n🔧 OAuth Configuration:');
  console.log(`   - Shop Domain: ${shopDomain}`);
  console.log(`   - API Key: ${apiKey}`);
  console.log(`   - Redirect URI: ${redirectUri}`);
  console.log(`   - State: ${state}`);
};

createOAuthLink();
