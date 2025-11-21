import Store from '../models/Store.js';
import { AppError } from './errorHandler.js';

/**
 * Extract shop domain from request.
 * Supports:
 *  - ?shop=
 *  - ?shopDomain=
 *  - ?store=
 *  - ?domain=
 *  - headers: x-shopify-shop-domain, x-shop-domain, x-shopify-shop
 *  - body: shop, shopDomain, store, domain
 */
const extractShopDomain = (req) => {
  const q = req.query || {};
  const h = req.headers || {};
  const b = req.body || {};

  const shopFromQuery =
    q.shop ||
    q.shopDomain ||
    q.store ||
    q.domain;

  const shopFromHeader =
    h['x-shopify-shop-domain'] ||
    h['x-shop-domain'] ||
    h['x-shopify-shop'];

  const shopFromBody =
    b.shop ||
    b.shopDomain ||
    b.store ||
    b.domain;

  const rawDomain = shopFromQuery || shopFromHeader || shopFromBody;

  if (!rawDomain) {
    return null;
  }

  const cleanDomain = String(rawDomain)
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase();

  // Allow both *.myshopify.com and real storefront domains (true-nordic.com, etc)
  const isValidShopDomain =
    cleanDomain.includes('.myshopify.com') ||
    /^[a-z0-9-]+\.[a-z]{2,}$/.test(cleanDomain);

  if (!isValidShopDomain) {
    console.warn('⚠️ Invalid shop domain format:', rawDomain);
    return null;
  }

  return cleanDomain;
};

/**
 * Middleware to identify and validate the current store.
 * Attaches:
 *   req.store
 *   req.shopDomain
 */
export const identifyStore = async (req, res, next) => {
  try {
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

    const store = await Store.findByDomain(shopDomain);

    if (!store) {
      console.log('❌ Store not found:', shopDomain);
      return next(
        new AppError(
          `Store ${shopDomain} not found. Please install the app first.`,
          404
        )
      );
    }

    if (!store.isInstalled) {
      console.log('❌ Store not installed:', shopDomain);
      return next(
        new AppError(
          `Store ${shopDomain} is not installed. Please reinstall the app.`,
          403
        )
      );
    }

    await store.updateLastAccess();

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
 * Require store installation (used for auth / onboarding type routes).
 */
export const requireStoreInstallation = async (req, res, next) => {
  try {
    const shopDomain = extractShopDomain(req);

    if (!shopDomain) {
      return next(new AppError('Shop domain is required', 400));
    }

    const store = await Store.findByDomain(shopDomain);

    if (!store) {
      const installUrl = `/auth/shopify/install?shop=${shopDomain}`;
      console.log('🔄 Redirecting to installation:', installUrl);
      return res.redirect(installUrl);
    }

    if (!store.isInstalled) {
      const installUrl = `/auth/shopify/install?shop=${shopDomain}`;
      console.log('🔄 Store not installed, redirecting to installation:', installUrl);
      return res.redirect(installUrl);
    }

    req.store = store;
    req.shopDomain = shopDomain;

    next();
  } catch (error) {
    console.error('❌ Error in requireStoreInstallation middleware:', error.message);
    next(new AppError('Failed to verify store installation', 500));
  }
};

/**
 * Optional store identification – doesn't hard-fail if store isn't found.
 */
export const optionalStoreIdentification = async (req, res, next) => {
  try {
    const shopDomain = extractShopDomain(req);

    if (shopDomain) {
      req.shopDomain = shopDomain;

      try {
        const store = await Store.findByDomain(shopDomain);

        if (store && store.isInstalled) {
          await store.updateLastAccess();
          req.store = store;
          console.log('✅ Optional store identified:', store.storeName);
        } else {
          console.log('⚠️ Store not found or not installed:', shopDomain);
        }
      } catch (storeError) {
        console.log('⚠️ Error looking up store:', storeError.message);
      }
    } else {
      console.log('ℹ️ No shop domain provided - running without store context');
    }

    next();
  } catch (error) {
    console.error('❌ Error in optionalStoreIdentification middleware:', error.message);
    next();
  }
};

/**
 * Check store permissions.
 */
export const requireStorePermissions = (requiredScopes) => {
  return (req, res, next) => {
    try {
      if (!req.store) {
        return next(new AppError('Store context required', 400));
      }

      const scopes = Array.isArray(requiredScopes)
        ? requiredScopes
        : [requiredScopes];

      for (const scope of scopes) {
        if (!req.store.hasPermission(scope)) {
          console.log(`❌ Store missing permission: ${scope}`);
          return next(
            new AppError(
              `Store missing required permission: ${scope}`,
              403
            )
          );
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
 * Add store context to response.locals (for templates).
 */
export const addStoreContext = (req, res, next) => {
  if (req.store) {
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
 * Utils used by shopifyController & others.
 */
export const getCurrentStore = (req) => req.store || null;

export const getCurrentShopDomain = (req) => req.shopDomain || null;

// Default export = identifyStore (for legacy imports)
export default identifyStore;
