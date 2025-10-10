import shopifyService from '../services/shopifyService.js';
import AppError from '../utils/AppError.js';

/**
 * Get a single product by ID
 */
export const getProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    
    if (!productId) {
      throw new AppError('Product ID is required', 400);
    }

    const product = await shopifyService.getProduct(productId);
    
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
    
    if (!productIds || !Array.isArray(productIds)) {
      throw new AppError('Product IDs array is required', 400);
    }

    if (productIds.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    const products = await shopifyService.getProducts(productIds);
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search products by query
 */
export const searchProducts = async (req, res, next) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query || query.trim().length === 0) {
      throw new AppError('Search query is required', 400);
    }

    const products = await shopifyService.searchProducts(query.trim(), parseInt(limit));
    
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
    
    const result = await shopifyService.getAllProducts(parseInt(limit), page_info);
    
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

    const exists = await shopifyService.validateProduct(productId);
    
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

    const inventory = await shopifyService.getProductInventory(productId);
    
    res.json({
      success: true,
      data: inventory
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get product suggestions for auction creation
 */
export const getProductSuggestions = async (req, res, next) => {
  try {
    const { q: query, limit = 20 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        data: [],
        message: 'Query must be at least 2 characters long'
      });
    }

    const suggestions = await shopifyService.getProductSuggestions(query.trim(), parseInt(limit));
    
    res.json({
      success: true,
      data: suggestions,
      count: suggestions.length
    });
  } catch (error) {
    next(error);
  }
};