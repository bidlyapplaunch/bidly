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

    // Generate a session token for App Bridge
    // This token should be short-lived and used for App Bridge authentication
    const sessionToken = jwt.sign(
      { 
        shop: store.shopDomain,
        storeId: store._id,
        iss: process.env.SHOPIFY_API_KEY,
        dest: `https://${store.shopDomain}`,
        aud: process.env.SHOPIFY_API_KEY,
        sub: store.shopDomain,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        nbf: Math.floor(Date.now() / 1000),
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.SHOPIFY_API_SECRET,
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

    const decoded = jwt.verify(token, process.env.SHOPIFY_API_SECRET);
    
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
export const getAppConfig = async (req, res, next) => {
  try {
    const { shop } = req.query;
    
    if (!shop) {
      throw new AppError('Shop parameter is required', 400);
    }

    // Verify the shop is installed
    const store = await Store.findByDomain(shop);
    if (!store || !store.isInstalled) {
      throw new AppError('Store not found or not installed', 404);
    }

    res.json({
      success: true,
      config: {
        apiKey: process.env.SHOPIFY_API_KEY,
        shopOrigin: `https://${store.shopDomain}`,
        forceRedirect: true,
        appId: process.env.SHOPIFY_API_KEY
      },
      shop: store.shopDomain,
      storeName: store.storeName
    });
  } catch (error) {
    next(error);
  }
};
