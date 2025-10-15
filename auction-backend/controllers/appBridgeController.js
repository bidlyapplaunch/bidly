import jwt from 'jsonwebtoken';
import Store from '../models/Store.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * App Bridge Authentication Controller
 * Handles authentication for Shopify embedded apps using App Bridge
 */

/**
 * Generate App Bridge session token
 * This token is used by App Bridge to authenticate requests
 */
export const generateAppBridgeToken = async (req, res, next) => {
  try {
    const { shop } = req.query;
    
    if (!shop) {
      throw new AppError('Shop parameter is required', 400);
    }

    // Verify the shop is installed and has access token
    const store = await Store.findByDomain(shop);
    if (!store || !store.isInstalled) {
      throw new AppError('Store not found or not installed', 404);
    }

    // Get the API key and secret from environment variables
    const apiKey = process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      throw new AppError('Shopify API credentials are not configured', 500);
    }

    // Generate a session token for App Bridge
    // This token should be short-lived and used for App Bridge authentication
    const sessionToken = jwt.sign(
      { 
        shop: store.shopDomain,
        storeId: store._id,
        iss: apiKey,
        dest: `https://${store.shopDomain}`,
        aud: apiKey,
        sub: store.shopDomain,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        nbf: Math.floor(Date.now() / 1000),
        iat: Math.floor(Date.now() / 1000)
      },
      apiSecret,
      { algorithm: 'HS256' }
    );

    res.json({
      success: true,
      sessionToken,
      shop: store.shopDomain,
      storeName: store.storeName
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify App Bridge session token
 * Middleware to verify App Bridge tokens
 */
export const verifyAppBridgeToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new AppError('App Bridge token required', 401);
    }

    const apiSecret = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET;
    
    if (!apiSecret) {
      throw new AppError('Shopify API secret is not configured', 500);
    }

    const decoded = jwt.verify(token, apiSecret);
    
    // Verify the token is for the correct shop
    const shop = req.query.shop || req.header('x-shopify-shop-domain');
    if (decoded.shop !== shop) {
      throw new AppError('Token shop mismatch', 401);
    }

    // Attach shop info to request
    req.shop = decoded.shop;
    req.storeId = decoded.storeId;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid App Bridge token', 401);
    }
    next(error);
  }
};

/**
 * Get app configuration for App Bridge
 * Returns the configuration needed to initialize App Bridge
 */
/**
 * Debug endpoint to check store status
 */
export const debugStoreStatus = async (req, res, next) => {
  try {
    const { shop } = req.query;
    
    console.log('🔍 Debug store status request:', { shop });
    
    if (!shop) {
      return res.json({
        success: false,
        error: 'No shop parameter provided',
        availableStores: await Store.find({}).select('shopDomain isInstalled').lean()
      });
    }

    const store = await Store.findByDomain(shop);
    
    res.json({
      success: true,
      shop,
      store: store ? {
        id: store._id,
        shopDomain: store.shopDomain,
        storeName: store.storeName,
        isInstalled: store.isInstalled,
        installedAt: store.installedAt,
        hasAccessToken: !!store.accessToken
      } : null,
      allStores: await Store.find({}).select('shopDomain isInstalled').lean()
    });
  } catch (error) {
    next(error);
  }
};

export const getAppConfig = async (req, res, next) => {
  try {
    const { shop } = req.query;
    
    console.log('🔧 App Bridge config request:', { shop, query: req.query });
    
    if (!shop) {
      console.log('❌ No shop parameter provided');
      throw new AppError('Shop parameter is required', 400);
    }

    // Verify the shop is installed
    console.log('🔍 Looking up store for domain:', shop);
    const store = await Store.findByDomain(shop);
    console.log('🏪 Store found:', { 
      exists: !!store, 
      isInstalled: store?.isInstalled,
      shopDomain: store?.shopDomain 
    });
    
    if (!store || !store.isInstalled) {
      console.log('❌ Store not found or not installed');
      throw new AppError('Store not found or not installed', 404);
    }

    // Get the API key from environment variables (support both old and new naming)
    const apiKey = process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY;
    
    console.log('🔑 API Key configuration:', {
      SHOPIFY_CLIENT_ID: process.env.SHOPIFY_CLIENT_ID ? 'Present' : 'Missing',
      SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ? 'Present' : 'Missing',
      resolvedApiKey: apiKey ? 'Present' : 'Missing'
    });
    
    if (!apiKey) {
      console.log('❌ No API key found in environment variables');
      throw new AppError('Shopify API Key is not configured', 500);
    }

    const config = {
      success: true,
      config: {
        apiKey: apiKey,
        shopOrigin: `https://${store.shopDomain}`,
        forceRedirect: true,
        appId: apiKey
      },
      shop: store.shopDomain,
      storeName: store.storeName
    };

    console.log('✅ App Bridge config generated successfully:', {
      shop: store.shopDomain,
      storeName: store.storeName,
      apiKey: apiKey ? 'Present' : 'Missing'
    });

    res.json(config);
  } catch (error) {
    next(error);
  }
};
