import getShopifyService from '../services/shopifyService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Get a single product by ID
 */
export const getProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    
    if (!productId) {
      throw new AppError('Product ID is required', 400);
    }

    const product = await getShopifyService().getProduct(productId);
    
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
 * Get multiple products by IDs
 */
export const getProducts = async (req, res, next) => {
  try {
    const { productIds } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    const products = await getShopifyService().getProducts(productIds);
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search products
 */
export const searchProducts = async (req, res, next) => {
  try {
    const { q, query, limit } = req.query;
    const searchQuery = q || query;
    
    if (!searchQuery || searchQuery.trim().length === 0) {
      throw new AppError('Search query is required', 400);
    }

    const products = await getShopifyService().searchProducts(searchQuery.trim(), parseInt(limit));
    
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
 * Get all products with pagination
 */
export const getAllProducts = async (req, res, next) => {
  try {
    const { limit = 50, page_info } = req.query;
    
    const result = await getShopifyService().getAllProducts(parseInt(limit), page_info);
    
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
    
    if (!productId) {
      throw new AppError('Product ID is required', 400);
    }

    const exists = await getShopifyService().validateProduct(productId);
    
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
    
    if (!productId) {
      throw new AppError('Product ID is required', 400);
    }

    const inventory = await getShopifyService().getProductInventory(productId);
    
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
    
    if (!q || q.trim().length === 0) {
      throw new AppError('Search query is required', 400);
    }

    const suggestions = await getShopifyService().getProductSuggestions(q.trim(), parseInt(limit));
    
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
    
    if (!handle) {
      throw new AppError('Product handle is required', 400);
    }

    const product = await getShopifyService().getProductByHandle(handle);
    
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
    
    if (!vendor) {
      throw new AppError('Vendor name is required', 400);
    }

    const products = await getShopifyService().getProductsByVendor(vendor, parseInt(limit));
    
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
    
    if (!productType) {
      throw new AppError('Product type is required', 400);
    }

    const products = await getShopifyService().getProductsByType(productType, parseInt(limit));
    
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
    
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      throw new AppError('Tags array is required', 400);
    }

    const products = await getShopifyService().getProductsByTags(tags, parseInt(limit));
    
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
    const status = getShopifyService().getConfigStatus();

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
    const service = getShopifyService();
    console.log('🧪 Testing Shopify connection...');
    
    // Try to make a simple API call
    const response = await service.client.get('/products.json?limit=1');
    console.log('✅ Shopify API test successful');
    
    res.json({
      success: true,
      message: 'Shopify API connection successful',
      productCount: response.data.products.length,
      firstProduct: response.data.products[0]?.title || 'No products found'
    });
  } catch (error) {
    console.error('❌ Shopify API test failed:', error.message);
    res.json({
      success: false,
      message: 'Shopify API connection failed',
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
  }
};