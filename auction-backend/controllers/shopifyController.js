import getShopifyService from '../services/shopifyService.js';
import { AppError } from '../middleware/errorHandler.js';
import { getCurrentStore, getCurrentShopDomain } from '../middleware/storeMiddleware.js';

/**
 * Get a single product by ID for the current store
 */
export const getProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const shopDomain = getCurrentShopDomain(req);
    
    if (!productId) {
      throw new AppError('Product ID is required', 400);
    }

    if (!shopDomain) {
      throw new AppError('Store context is required', 400);
    }

    const product = await getShopifyService().getProduct(shopDomain, productId);
    
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get multiple products by IDs for the current store
 */
export const getProducts = async (req, res, next) => {
  try {
    const { productIds } = req.body;
    const shopDomain = getCurrentShopDomain(req);
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    if (!shopDomain) {
      throw new AppError('Store context is required', 400);
    }

    const products = await getShopifyService().getProducts(shopDomain, productIds);
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search products for the current store
 */
export const searchProducts = async (req, res, next) => {
  try {
    const { q, query, limit } = req.query;
    const searchQuery = q || query;
    const shopDomain = getCurrentShopDomain(req);
    
    console.log('🔍 Search request:', {
      query: searchQuery,
      shopDomain,
      limit,
      reqQuery: req.query
    });
    
    if (!searchQuery || searchQuery.trim().length === 0) {
      throw new AppError('Search query is required', 400);
    }

    if (!shopDomain) {
      throw new AppError('Store context is required', 400);
    }

    const products = await getShopifyService().searchProducts(shopDomain, searchQuery.trim(), parseInt(limit));
    
    console.log('✅ Search results:', {
      query: searchQuery,
      shopDomain,
      productCount: products.length
    });
    
    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('❌ Search error:', error.message);
    next(error);
  }
};

/**
 * Get all products with pagination for the current store
 */
export const getAllProducts = async (req, res, next) => {
  try {
    const { limit = 50, page_info } = req.query;
    const shopDomain = getCurrentShopDomain(req);
    
    if (!shopDomain) {
      throw new AppError('Store context is required', 400);
    }
    
    const result = await getShopifyService().getAllProducts(shopDomain, parseInt(limit), page_info);
    
    res.json({
      success: true,
      data: result.products,
      pagination: result.pagination,
      count: result.products.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validate if a product exists
 */
export const validateProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const shopDomain = getCurrentShopDomain(req);
    
    if (!productId) {
      throw new AppError('Product ID is required', 400);
    }

    if (!shopDomain) {
      throw new AppError('Store context is required', 400);
    }

    const exists = await getShopifyService().validateProduct(shopDomain, productId);
    
    res.json({
      success: true,
      data: { exists, productId }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get product inventory
 */
export const getProductInventory = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const shopDomain = getCurrentShopDomain(req);
    
    if (!productId) {
      throw new AppError('Product ID is required', 400);
    }

    if (!shopDomain) {
      throw new AppError('Store context is required', 400);
    }

    const inventory = await getShopifyService().getProductInventory(shopDomain, productId);
    
    res.json({
      success: true,
      data: inventory
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get product suggestions for autocomplete
 */
export const getProductSuggestions = async (req, res, next) => {
  try {
    const { q, limit } = req.query;
    const shopDomain = getCurrentShopDomain(req);
    
    if (!q || q.trim().length === 0) {
      throw new AppError('Search query is required', 400);
    }

    if (!shopDomain) {
      throw new AppError('Store context is required', 400);
    }

    const suggestions = await getShopifyService().getProductSuggestions(shopDomain, q.trim(), parseInt(limit));
    
    res.json({
      success: true,
      data: suggestions,
      count: suggestions.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get product by handle
 */
export const getProductByHandle = async (req, res, next) => {
  try {
    const { handle } = req.params;
    const shopDomain = getCurrentShopDomain(req);
    
    if (!handle) {
      throw new AppError('Product handle is required', 400);
    }

    if (!shopDomain) {
      throw new AppError('Store context is required', 400);
    }

    const product = await getShopifyService().getProductByHandle(shopDomain, handle);
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get products by vendor
 */
export const getProductsByVendor = async (req, res, next) => {
  try {
    const { vendor } = req.params;
    const { limit } = req.query;
    const shopDomain = getCurrentShopDomain(req);
    
    if (!vendor) {
      throw new AppError('Vendor name is required', 400);
    }

    if (!shopDomain) {
      throw new AppError('Store context is required', 400);
    }

    const products = await getShopifyService().getProductsByVendor(shopDomain, vendor, parseInt(limit));
    
    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get products by product type
 */
export const getProductsByType = async (req, res, next) => {
  try {
    const { productType } = req.params;
    const { limit } = req.query;
    const shopDomain = getCurrentShopDomain(req);
    
    if (!productType) {
      throw new AppError('Product type is required', 400);
    }

    if (!shopDomain) {
      throw new AppError('Store context is required', 400);
    }

    const products = await getShopifyService().getProductsByType(shopDomain, productType, parseInt(limit));
    
    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get products by tags
 */
export const getProductsByTags = async (req, res, next) => {
  try {
    const { tags } = req.body;
    const { limit } = req.query;
    const shopDomain = getCurrentShopDomain(req);
    
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      throw new AppError('Tags array is required', 400);
    }

    if (!shopDomain) {
      throw new AppError('Store context is required', 400);
    }

    const products = await getShopifyService().getProductsByTags(shopDomain, tags, parseInt(limit));
    
    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Shopify service configuration status
 */
export const getServiceStatus = async (req, res, next) => {
  try {
    console.log('🔍 getServiceStatus called with:', {
      query: req.query,
      headers: req.headers,
      url: req.url,
      hasStore: !!req.store,
      shopDomain: req.shopDomain
    });
    
    // Use req.store from identifyStore middleware - it should always be present
    if (!req.store) {
      throw new AppError('Store not found', 404);
    }
    
    const hasAccessToken = !!req.store.accessToken;
    const isInstalled = !!req.store.isInstalled;
    const configured = isInstalled && hasAccessToken;
    
    return res.json({
      success: true,
      configured,
      shopDomain: req.store.shopDomain,
      storeName: req.store.storeName,
      hasAccessToken,
      isInstalled,
      apiVersion: '2025-10',
      mockMode: !isInstalled || !hasAccessToken,
      installedAt: req.store.installedAt,
      lastAccessAt: req.store.lastAccessAt
    });
    
    // Fallback to lookup if store not in req (shouldn't happen with identifyStore middleware)
    const shopDomain = getCurrentShopDomain(req);
    console.log('🔍 getServiceStatus - shopDomain (fallback):', shopDomain);
    
    if (!shopDomain) {
      throw new AppError('Store context is required', 400);
    }

    const status = await getShopifyService().getStoreConfigStatus(shopDomain);

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Test endpoint to debug Shopify API issues
 */
export const testShopifyConnection = async (req, res, next) => {
  try {
    const shopDomain = getCurrentShopDomain(req);
    
    if (!shopDomain) {
      throw new AppError('Store context is required', 400);
    }

    console.log('🧪 Testing Shopify connection for store:', shopDomain);
    
    const result = await getShopifyService().testStoreConnection(shopDomain);
    
    if (result.success) {
      console.log('✅ Shopify API test successful for store:', shopDomain);
      res.json({
        success: true,
        message: 'Shopify API connection successful',
        store: result.storeName,
        shopInfo: result.shopInfo
      });
    } else {
      console.log('❌ Shopify API test failed for store:', shopDomain);
      res.json({
        success: false,
        message: 'Shopify API connection failed',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Shopify API test failed:', error.message);
    res.json({
      success: false,
      message: 'Shopify API connection failed',
      error: error.message
    });
  }
};