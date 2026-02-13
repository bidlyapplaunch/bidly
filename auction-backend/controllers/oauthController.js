import shopifyOAuthService from '../services/shopifyOAuthService.js';
import Store from '../models/Store.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Build the Shopify admin URL for redirecting back into the embedded app
 * @param {string} shop - Shop domain (e.g., store.myshopify.com)
 * @param {string} [hostParam] - Base64 host value provided by Shopify
 * @returns {string} - Fully qualified admin URL
 */
const buildShopifyAdminUrl = (shop, hostParam) => {
  const fallbackAppUrl = process.env.SHOPIFY_APP_EMBED_URL || 'https://bidly-auction-admin.onrender.com';
  
  // Determine app handle from client ID
  const clientId = process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY;
  let appHandle = process.env.SHOPIFY_APP_HANDLE;
  
  if (!appHandle && clientId) {
    // Map client IDs to app handles
    if (clientId === 'de32970476f2ecf20d98f9d9b6994c89') {
      appHandle = 'bidly-2'; // Second app
    } else if (clientId === '698a2d663b3718b47b794bfbd6835ef4') {
      appHandle = 'bidly-3'; // First app
    } else {
      appHandle = 'bidly-3'; // Default fallback
    }
  }
  
  appHandle = appHandle || 'bidly-3'; // Final fallback

  if (hostParam) {
    try {
      const decodedHost = Buffer.from(hostParam, 'base64').toString('utf-8');
      if (decodedHost && decodedHost.startsWith('admin.shopify.com')) {
        const hasAppsSegment = decodedHost.includes('/apps/');
        const adminPath = hasAppsSegment ? decodedHost : `${decodedHost}/apps/${appHandle}`;
        return `https://${adminPath}`;
      }
    } catch (error) {
      console.warn('⚠️ Failed to decode host parameter:', error.message);
    }
  }

  if (shop) {
    const storeSlug = shop.replace('.myshopify.com', '');
    return `https://admin.shopify.com/store/${storeSlug}/apps/${appHandle}`;
  }

  return fallbackAppUrl;
};

/**
 * OAuth Controller
 * Handles Shopify OAuth flow for app installation and authentication
 * This controller manages the complete OAuth process from installation to token storage
 */

/**
 * Handle custom app installation
 * This handles the custom app installation flow from Shopify admin
 * GET /auth/shopify/install-custom?client_id=...&signature=...
 */
export const handleCustomAppInstall = async (req, res, next) => {
  try {
    const { client_id, signature, permanent_domain } = req.query;
    
    console.log('🔧 Custom app installation request:', {
      client_id,
      hasSignature: !!signature,
      permanent_domain
    });
    
    // Validate required parameters
    if (!client_id || !signature || !permanent_domain) {
      throw new AppError('Missing required custom app parameters', 400);
    }
    
    // Verify the client_id matches our app
    if (client_id !== process.env.SHOPIFY_API_KEY) {
      throw new AppError('Invalid client ID', 400);
    }
    
    // For custom apps, we need to create a store record with a placeholder token
    // The actual token will be obtained through the standard OAuth flow
    const shopDomain = `${permanent_domain}.myshopify.com`;
    
    console.log('🏪 Processing custom app installation for:', shopDomain);
    
    // Check if store already exists
    let store = await Store.findByDomain(shopDomain);
    
    if (store) {
      // Update existing store
      store.isInstalled = true;
      store.installedAt = new Date();
      store.lastAccessAt = new Date();
      
      // Ensure all required fields are present
      if (!store.shopifyStoreId) store.shopifyStoreId = Date.now();
      if (!store.storeEmail) store.storeEmail = `${permanent_domain}@example.com`;
      if (!store.planName) store.planName = 'Custom App';
      if (!store.accessToken) store.accessToken = 'temp-token';
      if (!store.currency) store.currency = 'USD';
      if (!store.timezone) store.timezone = 'UTC';
      
      await store.save();
      console.log('✅ Updated existing store for custom app');
    } else {
      // Create new store record with all required fields
      store = new Store({
        shopDomain: shopDomain,
        shopifyStoreId: Date.now(), // Temporary ID until OAuth completes
        storeName: permanent_domain,
        storeEmail: `${permanent_domain}@example.com`, // Temporary email until OAuth completes
        currency: 'USD',
        timezone: 'UTC',
        planName: 'Custom App', // Temporary plan name until OAuth completes
        accessToken: 'temp-token', // Temporary token until OAuth completes
        scope: 'read_products,read_product_listings,read_orders,write_orders',
        isInstalled: true,
        installedAt: new Date(),
        lastAccessAt: new Date()
      });
      
      await store.save();
      console.log('✅ Created new store record for custom app');
    }
    
    // Redirect to the admin dashboard with shop parameter
    const adminUrl = 'https://bidly-auction-admin.onrender.com';
    console.log('🔄 Redirecting to admin dashboard (custom app):', `${adminUrl}?shop=${shopDomain}&installed=true&custom_app=true`);
    res.redirect(`${adminUrl}?shop=${shopDomain}&installed=true&custom_app=true`);
    
  } catch (error) {
    console.error('❌ Error handling custom app installation:', error.message);
    next(error);
  }
};

/**
 * Initiate OAuth flow - redirect store owner to Shopify for app installation
 * This is the entry point when a store owner wants to install your app
 * GET /auth/shopify/install?shop=store.myshopify.com
 */
export const initiateOAuth = async (req, res, next) => {
  try {
    // Initialize OAuth service to ensure environment variables are loaded
    shopifyOAuthService.initialize();
    
    const { shop } = req.query;
    
    // Validate shop parameter
    if (!shop) {
      throw new AppError('Shop parameter is required', 400);
    }

    // Validate shop domain format
    const shopDomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
    if (!shopDomainRegex.test(shop)) {
      throw new AppError('Invalid shop domain format', 400);
    }

    console.log('🚀 Initiating OAuth for shop:', shop);

    // Check if store is already installed
    const existingStore = await Store.findByDomain(shop);
    if (existingStore && existingStore.isInstalled) {
      console.log('✅ Store already installed, redirecting to Shopify admin');
      const adminUrl = buildShopifyAdminUrl(shop, req.query.host);
      console.log('🔄 Redirecting to Shopify admin (already installed):', adminUrl);
      return res.redirect(adminUrl);
    }

    // Set redirect URI based on client ID (for multi-app support)
    // Second app (client_id: de32970476f2ecf20d98f9d9b6994c89) uses bidly-backend-2
    const clientId = shopifyOAuthService.clientId;
    let redirectUri;
    
    if (clientId === 'de32970476f2ecf20d98f9d9b6994c89') {
      // Second app - use bidly-backend-2
      redirectUri = 'https://bidly-backend-2.hiiiiiiiiiii.com/auth/shopify/callback';
      console.log('🔗 Using redirect URI for second app:', redirectUri);
    } else if (process.env.SHOPIFY_REDIRECT_URI) {
      // Use environment variable if set
      redirectUri = process.env.SHOPIFY_REDIRECT_URI;
      console.log('🔗 Using redirect URI from environment:', redirectUri);
    } else {
      // Fallback: dynamically construct from request
      const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
      const finalProtocol = protocol === 'http' && process.env.NODE_ENV === 'production' ? 'https' : protocol;
      
      let host;
      if (process.env.APP_URL) {
        try {
          const appUrl = new URL(process.env.APP_URL);
          host = appUrl.host;
        } catch {
          host = process.env.APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
        }
      } else {
        host = req.get('host') || req.get('x-forwarded-host') || req.hostname || 'bidly-backend.hiiiiiiiiiii.com';
      }
      
      redirectUri = `${finalProtocol}://${host}/auth/shopify/callback`;
      console.log('🔗 Setting dynamic redirect URI:', redirectUri);
    }
    
    shopifyOAuthService.setRedirectUri(redirectUri);

    // Generate a random state parameter for security
    const state = shopifyOAuthService.generateState();
    
    // Store the state temporarily (in production, use Redis or similar)
    // For now, we'll include it in the redirect URL
    const authUrl = shopifyOAuthService.generateAuthUrl(shop, state);
    
    console.log('🔗 Redirecting to Shopify OAuth:', authUrl);
    console.log('🔗 Using redirect URI:', shopifyOAuthService.redirectUri);
    
    // Redirect the store owner to Shopify's OAuth page
    res.redirect(authUrl);
    
  } catch (error) {
    console.error('❌ Error initiating OAuth:', error.message);
    next(error);
  }
};

/**
 * Handle OAuth callback from Shopify
 * This is where Shopify redirects back after the store owner approves the app
 * GET /auth/shopify/callback?code=...&state=...&shop=...
 */
export const handleOAuthCallback = async (req, res, next) => {
  try {
    // Initialize OAuth service to ensure environment variables are loaded
    shopifyOAuthService.initialize();
    
    const { code, state, shop, hmac } = req.query;
    
    console.log('🔄 Processing OAuth callback for shop:', shop);
    console.log('  - Code present:', !!code);
    console.log('  - State present:', !!state);
    console.log('  - HMAC present:', !!hmac);

    // Validate required parameters
    if (!code || !shop) {
      throw new AppError('Missing required OAuth parameters', 400);
    }

    // Verify HMAC signature for security
    const hmacValid = shopifyOAuthService.verifyHmac(req.query);
    console.log('🔐 HMAC verification result:', hmacValid);
    console.log('🔍 Query parameters:', req.query);
    
    // For development, we'll be more lenient with HMAC verification
    // In production, you should enforce strict HMAC verification
    if (!hmacValid && process.env.NODE_ENV === 'production') {
      throw new AppError('Invalid HMAC signature', 401);
    } else if (!hmacValid) {
      console.warn('⚠️ HMAC verification failed, but allowing in development mode');
    }

    // Exchange authorization code for access token
    const tokenData = await shopifyOAuthService.exchangeCodeForToken(shop, code, state);
    
    // Get additional shop information
    const shopInfo = await shopifyOAuthService.getShopInfo(shop, tokenData.accessToken);
    
    console.log('🏪 Shop info retrieved:', {
      name: shopInfo.name,
      domain: shopInfo.domain,
      plan: shopInfo.planName
    });

    // Check if store already exists
    let store = await Store.findByDomain(shop);
    
    if (store) {
      // Update existing store with new token
      console.log('🔄 Updating existing store:', shop);
      store.accessToken = tokenData.accessToken;
      store.scope = tokenData.scope;
      store.isInstalled = true;
      store.installedAt = new Date();
      
      // Update shop info
      store.storeName = shopInfo.name;
      store.storeEmail = shopInfo.email;
      store.currency = shopInfo.currency;
      store.timezone = shopInfo.timezone;
      store.planName = shopInfo.planName;
      if (!store.plan) {
        // Default any missing/legacy plan to free tier
        store.plan = 'free';
      }
      
      await store.save();
    } else {
      // Create new store record
      console.log('🆕 Creating new store record:', shop);
      store = new Store({
        shopDomain: shop,
        shopifyStoreId: shopInfo.id,
        storeName: shopInfo.name,
        storeEmail: shopInfo.email,
        currency: shopInfo.currency,
        timezone: shopInfo.timezone,
        planName: shopInfo.planName,
        plan: 'free',
        accessToken: tokenData.accessToken,
        scope: tokenData.scope,
        isInstalled: true,
        installedAt: new Date(),
        lastAccessAt: new Date()
      });
      
      await store.save();
    }

    console.log('✅ OAuth flow completed successfully for shop:', shop);
    
    try {
      await shopifyOAuthService.ensureUninstallWebhook(shop, tokenData.accessToken);
    } catch (webhookError) {
      console.warn('⚠️ Unable to ensure uninstall webhook:', webhookError.message);
    }
    
    // For embedded apps, redirect to the admin dashboard URL with shop parameter
    // This will be handled by App Bridge in the frontend
    const adminUrl = buildShopifyAdminUrl(shop, req.query.host);
    console.log('🔄 Redirecting to Shopify admin:', adminUrl);
    res.redirect(adminUrl);
    
  } catch (error) {
    console.error('❌ Error in OAuth callback:', error.message);
    
    // Redirect to error page or show error message
    const shop = req.query.shop || 'unknown';
    const adminUrl = buildShopifyAdminUrl(shop, req.query.host);
    console.log('🔄 Redirecting to Shopify admin (error):', adminUrl);
    res.redirect(`${adminUrl}?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
  }
};

/**
 * Uninstall webhook handler
 * This is called by Shopify when a store uninstalls your app
 * POST /webhooks/shopify/uninstall
 */
export const handleUninstall = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const shopDomain =
      payload.shop_domain ||
      payload.myshopify_domain ||
      (payload.domain ? `${payload.domain}` : null);
    
    console.log('🗑️ Processing uninstall payload:', {
      shop_domain: payload.shop_domain,
      myshopify_domain: payload.myshopify_domain,
      domain: payload.domain
    });
    
    if (!shopDomain) {
      throw new AppError('Shop domain is required', 400);
    }

    const normalizedDomain = shopDomain.endsWith('.myshopify.com')
      ? shopDomain
      : `${shopDomain}.myshopify.com`;

    // Find and mark store as uninstalled
    const store = await Store.findByDomain(normalizedDomain);
    if (store) {
      store.isInstalled = false;
      await store.save();
      console.log('✅ Store marked as uninstalled:', normalizedDomain);
    } else {
      console.log('⚠️ Store not found for uninstall:', normalizedDomain);
    }

    // Always return 200 to acknowledge webhook
    res.status(200).json({ success: true, message: 'Uninstall processed' });
    
  } catch (error) {
    console.error('❌ Error processing uninstall:', error.message);
    // Still return 200 to prevent Shopify from retrying
    res.status(200).json({ success: false, error: error.message });
  }
};

/**
 * Get current store information
 * This endpoint provides information about the currently authenticated store
 * GET /auth/shopify/store
 */
export const getCurrentStore = async (req, res, next) => {
  try {
    const { shop } = req.query;
    
    if (!shop) {
      throw new AppError('Shop parameter is required', 400);
    }

    const store = await Store.findByDomain(shop);
    
    if (!store || !store.isInstalled) {
      throw new AppError('Store not found or not installed', 404);
    }

    // Update last access time
    await store.updateLastAccess();

    console.log('📊 Returning store info for:', shop);
    
    res.json({
      success: true,
      data: {
        id: store._id,
        shopDomain: store.shopDomain,
        storeName: store.storeName,
        storeEmail: store.storeEmail,
        currency: store.currency,
        timezone: store.timezone,
        planName: store.planName,
        isInstalled: store.isInstalled,
        installedAt: store.installedAt,
        lastAccessAt: store.lastAccessAt,
        settings: store.settings,
        stats: store.stats
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting store info:', error.message);
    next(error);
  }
};

/**
 * Check if store is installed
 * This endpoint checks if a store has completed the OAuth flow
 * GET /auth/shopify/status?shop=store.myshopify.com
 */
export const checkInstallationStatus = async (req, res, next) => {
  try {
    const { shop } = req.query;
    
    if (!shop) {
      throw new AppError('Shop parameter is required', 400);
    }

    const store = await Store.findByDomain(shop);
    // Store is only truly "installed" if it has both isInstalled flag AND an access token
    const hasAccessToken = store && store.accessToken;
    const isInstalled = store && store.isInstalled && hasAccessToken;
    
    console.log('🔍 Installation status for', shop, ':', isInstalled ? 'Installed' : 'Not installed');
    if (store && store.isInstalled && !hasAccessToken) {
      console.warn('⚠️ Store marked as installed but missing access token - OAuth incomplete');
    }
    
    res.json({
      success: true,
      data: {
        shop: shop,
        isInstalled: isInstalled,
        installedAt: store?.installedAt || null
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking installation status:', error.message);
    next(error);
  }
};
