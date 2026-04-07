import Store from '../models/Store.js';
import { AppError } from './errorHandler.js';
import { decodeShopifySession } from './auth.js';

const STATIC_PATH_PREFIXES = [
  '/assets/',
  '/favicon',
  '/manifest',
  '/robots.txt',
  '/shopify-test',
  '/index.html',
  '/health',
  '/render-health',
  '/preview/'
];

// Common static file extensions
const STATIC_FILE_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.css', '.js', '.map'];

const DOMAIN_OPTIONAL_PREFIXES = ['/api/auth', '/auth', '/api/onboarding'];

const cleanDomain = (rawDomain) => {
  if (!rawDomain) {
    return null;
  }

  const normalized = String(rawDomain)
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase();

  if (!/^[a-z0-9.-]+$/.test(normalized)) {
    return null;
  }

  return normalized;
};

const isMyshopifyDomain = (domain) =>
  typeof domain === 'string' && domain.endsWith('.myshopify.com');

const normalizeShopDomain = (rawDomain) => cleanDomain(rawDomain);

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

  const normalized = normalizeShopDomain(rawDomain);

  if (!normalized) {
    console.warn('Invalid shop domain format:', rawDomain);
  }

  return normalized;
};

/**
 * Middleware to identify and validate the current store.
 * Attaches:
 *   req.store
 *   req.shopDomain
 */
export const identifyStore = async (req, res, next) => {
  try {
    if (req.method === 'OPTIONS') {
      return next();
    }

    // Skip store validation for root path (embedded app initialization)
    if (req.path === '/' || req.path === '') {
      return next();
    }

    // Skip store validation for admin SPA paths (served separately)
    if (req.path.startsWith('/admin')) {
      return next();
    }

    // Only enforce store validation for API/app-proxy/app-bridge paths
    const requiresStoreValidation =
      req.path.startsWith('/api/') ||
      req.path.startsWith('/apps/') ||
      req.path.startsWith('/app-bridge/');

    if (!requiresStoreValidation) {
      return next();
    }

    if (
      req.method === 'GET' &&
      (STATIC_PATH_PREFIXES.some((prefix) => req.path.startsWith(prefix)) ||
       STATIC_FILE_EXTENSIONS.some((ext) => req.path.endsWith(ext)))
    ) {
      return next();
    }

    if (DOMAIN_OPTIONAL_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
      // Skip store lookup for these paths - they don't need it
      return next();
    }

    let requestedDomain = normalizeShopDomain(extractShopDomain(req));
    
    // Prefer Shopify session token (RS256) if present
    if (!requestedDomain) {
      const bearer = req.header('Authorization')?.replace('Bearer ', '');
      const shopifySession = await decodeShopifySession(bearer).catch(() => null);
      if (shopifySession?.shopDomain) {
        requestedDomain = shopifySession.shopDomain;
      }
    }
    const originDomain = cleanDomain(req.headers?.origin);
    
    let store = null;

    const tryResolveStore = async (domain) => {
      if (!domain) {
        return null;
      }
      if (isMyshopifyDomain(domain)) {
        const byCanonical = await Store.findByDomain(domain);
        if (byCanonical) {
          return byCanonical;
        }
      }
      const byKnownDomain = await Store.findOne({ knownDomains: domain }).select('+accessToken');
      return byKnownDomain;
    };

    if (requestedDomain) {
      store = await tryResolveStore(requestedDomain);
    }

    if (!store && originDomain) {
      store = await tryResolveStore(originDomain);
    }

    if (!store) {
      return next(
        new AppError(
          'Shop domain is required and must match an installed store',
          400
        )
      );
    }

    if (!store.isInstalled) {
      return next(
        new AppError(
          `Store ${store.shopDomain} is not installed. Please reinstall the app.`,
          403
        )
      );
    }

    await store.updateLastAccess();
    req.store = store;
    req.shopDomain = store.shopDomain;

    const candidateDomains = [requestedDomain, originDomain]
      .filter(Boolean)
      .filter((domain) => domain !== store.shopDomain);

    if (candidateDomains.length) {
      let changed = false;
      for (const domain of candidateDomains) {
        if (domain && !store.knownDomains.includes(domain)) {
          store.knownDomains.push(domain);
          changed = true;
        }
      }
      if (changed) {
        await store.save();
      }
    }

    next();
  } catch (error) {
    console.error('Error in identifyStore middleware:', error.message);
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
      return res.redirect(installUrl);
    }

    if (!store.isInstalled) {
      const installUrl = `/auth/shopify/install?shop=${shopDomain}`;
      return res.redirect(installUrl);
    }

    req.store = store;
    req.shopDomain = shopDomain;

    next();
  } catch (error) {
    console.error('Error in requireStoreInstallation middleware:', error.message);
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
        }
      } catch (storeError) {
        // Non-critical: store lookup failed in optional middleware
      }
    } else {
    }

    next();
  } catch (error) {
    console.error('Error in optionalStoreIdentification middleware:', error.message);
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
          return next(
            new AppError(
              `Store missing required permission: ${scope}`,
              403
            )
          );
        }
      }

      next();
    } catch (error) {
      console.error('Error in requireStorePermissions middleware:', error.message);
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
