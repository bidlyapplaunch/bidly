import Store from '../models/Store.js';
import { AppError } from './errorHandler.js';

/**
 * Store Middleware
 * This middleware identifies and validates the current store context
 * It extracts the shop domain from various sources and attaches store info to the request
 */

/**
 * Extract shop domain from request
 * This function looks for the shop domain in query parameters, headers, or body
 * @param {Object} req - Express request object
 * @returns {string|null} Shop domain or null if not found
 */
const extractShopDomain = (req) => {
  // Priority order: query param > header > body
  const shopFromQuery = req.query.shop;
  const shopFromHeader = req.headers['x-shopify-shop-domain'];
  const shopFromBody = req.body?.shop;
  
  const shopDomain = shopFromQuery || shopFromHeader || shopFromBody;
  
  if (!shopDomain) {
    return null;
  }
  
  // Clean and validate the shop domain
  const cleanDomain = shopDomain
    .replace(/^https?:\/\//, '') // Remove protocol
    .replace(/\/$/, '') // Remove trailing slash
    .toLowerCase(); // Normalize case
  
  // Basic validation for Shopify domain format
  if (!cleanDomain.includes('.myshopify.com')) {
    console.warn('⚠️ Invalid shop domain format:', shopDomain);
    return null;
  }
  
  return cleanDomain;
};

/**
 * Middleware to identify and validate the current store
 * This middleware runs before routes that need store context
 * It adds store information to req.store and req.shopDomain
 */
export const identifyStore = async (req, res, next) => {
  try {
    // Extract shop domain from request
    const shopDomain = extractShopDomain(req);
    
    if (!shopDomain) {
      console.log('❌ No shop domain found in request');
      console.log('🔍 Request details:', {
        query: req.query,
        headers: req.headers,
        body: req.body,
        url: req.url
      });
      return next(new AppError('Shop domain is required', 400));
    }
    
    console.log('🏪 Identifying store:', shopDomain);
    
    // Find the store in the database
    const store = await Store.findByDomain(shopDomain);
    
    if (!store) {
      console.log('❌ Store not found:', shopDomain);
      return next(new AppError(`Store ${shopDomain} not found. Please install the app first.`, 404));
    }
    
    if (!store.isInstalled) {
      console.log('❌ Store not installed:', shopDomain);
      return next(new AppError(`Store ${shopDomain} is not installed. Please reinstall the app.`, 403));
    }
    
    // Update last access time
    await store.updateLastAccess();
    
    // Attach store information to request
    req.store = store;
    req.shopDomain = shopDomain;
    
    console.log('✅ Store identified:', store.storeName, `(${shopDomain})`);
    
    next();
  } catch (error) {
    console.error('❌ Error in identifyStore middleware:', error.message);
    next(new AppError('Failed to identify store', 500));
  }
};

/**
 * Middleware to require store installation
 * This middleware ensures the store has completed the OAuth flow
 * Use this for routes that require a fully installed store
 */
export const requireStoreInstallation = async (req, res, next) => {
  try {
    const shopDomain = extractShopDomain(req);
    
    if (!shopDomain) {
      return next(new AppError('Shop domain is required', 400));
    }
    
    const store = await Store.findByDomain(shopDomain);
    
    if (!store) {
      // Store not found - redirect to installation
      const installUrl = `/auth/shopify/install?shop=${shopDomain}`;
      console.log('🔄 Redirecting to installation:', installUrl);
      return res.redirect(installUrl);
    }
    
    if (!store.isInstalled) {
      // Store found but not installed - redirect to installation
      const installUrl = `/auth/shopify/install?shop=${shopDomain}`;
      console.log('🔄 Store not installed, redirecting to installation:', installUrl);
      return res.redirect(installUrl);
    }
    
    // Store is installed - continue
    req.store = store;
    req.shopDomain = shopDomain;
    
    next();
  } catch (error) {
    console.error('❌ Error in requireStoreInstallation middleware:', error.message);
    next(new AppError('Failed to verify store installation', 500));
  }
};

/**
 * Middleware to optionally identify store
 * This middleware tries to identify the store but doesn't fail if not found
 * Use this for routes that can work with or without store context
 */
export const optionalStoreIdentification = async (req, res, next) => {
  try {
    const shopDomain = extractShopDomain(req);
    
    if (shopDomain) {
      const store = await Store.findByDomain(shopDomain);
      
      if (store && store.isInstalled) {
        await store.updateLastAccess();
        req.store = store;
        req.shopDomain = shopDomain;
        console.log('✅ Optional store identified:', store.storeName);
      } else {
        console.log('⚠️ Store not found or not installed:', shopDomain);
      }
    } else {
      console.log('ℹ️ No shop domain provided - running without store context');
    }
    
    next();
  } catch (error) {
    console.error('❌ Error in optionalStoreIdentification middleware:', error.message);
    // Don't fail the request, just log the error
    next();
  }
};

/**
 * Middleware to validate store permissions
 * This middleware checks if the store has the required permissions
 * @param {string|Array} requiredScopes - Required permission scopes
 */
export const requireStorePermissions = (requiredScopes) => {
  return (req, res, next) => {
    try {
      if (!req.store) {
        return next(new AppError('Store context required', 400));
      }
      
      const scopes = Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes];
      
      for (const scope of scopes) {
        if (!req.store.hasPermission(scope)) {
          console.log(`❌ Store missing permission: ${scope}`);
          return next(new AppError(`Store missing required permission: ${scope}`, 403));
        }
      }
      
      console.log('✅ Store permissions validated:', scopes.join(', '));
      next();
    } catch (error) {
      console.error('❌ Error in requireStorePermissions middleware:', error.message);
      next(new AppError('Failed to validate store permissions', 500));
    }
  };
};

/**
 * Middleware to add store context to response
 * This middleware adds store information to the response for frontend use
 */
export const addStoreContext = (req, res, next) => {
  if (req.store) {
    // Add store context to response locals for template rendering
    res.locals.store = {
      id: req.store._id,
      shopDomain: req.store.shopDomain,
      storeName: req.store.storeName,
      storeEmail: req.store.storeEmail,
      currency: req.store.currency,
      timezone: req.store.timezone,
      planName: req.store.planName,
      isInstalled: req.store.isInstalled,
      installedAt: req.store.installedAt,
      settings: req.store.settings
    };
  }
  
  next();
};

/**
 * Utility function to get store from request
 * This can be used in route handlers to get the current store
 * @param {Object} req - Express request object
 * @returns {Object|null} Store object or null
 */
export const getCurrentStore = (req) => {
  return req.store || null;
};

/**
 * Utility function to get shop domain from request
 * @param {Object} req - Express request object
 * @returns {string|null} Shop domain or null
 */
export const getCurrentShopDomain = (req) => {
  return req.shopDomain || null;
};
