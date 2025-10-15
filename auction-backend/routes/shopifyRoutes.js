import express from 'express';
import {
  getProduct,
  getProducts,
  searchProducts,
  getAllProducts,
  validateProduct,
  getProductInventory,
  getProductSuggestions,
  getProductByHandle,
  getProductsByVendor,
  getProductsByType,
  getProductsByTags,
  getServiceStatus,
  testShopifyConnection
} from '../controllers/shopifyController.js';
import { validateId, validateShopifyProductId } from '../middleware/validation.js';
import { identifyStore, optionalStoreIdentification } from '../middleware/storeMiddleware.js';

const router = express.Router();

// Service status - requires store context
router.get('/status', identifyStore, getServiceStatus);

// Test endpoint - requires store context
router.get('/test', identifyStore, testShopifyConnection);

// Direct search route for convenience - requires store context
router.get('/search', identifyStore, searchProducts);

// Product operations - all require store context
router.get('/products/search', identifyStore, searchProducts);
router.get('/products/suggestions', identifyStore, getProductSuggestions);
router.get('/products', identifyStore, getAllProducts);
router.get('/products/:productId', identifyStore, validateShopifyProductId, getProduct);
router.get('/products/:productId/validate', identifyStore, validateShopifyProductId, validateProduct);
router.get('/products/:productId/inventory', identifyStore, validateShopifyProductId, getProductInventory);
router.get('/products/handle/:handle', identifyStore, getProductByHandle);
router.get('/products/vendor/:vendor', identifyStore, getProductsByVendor);
router.get('/products/type/:productType', identifyStore, getProductsByType);
router.post('/products/batch', identifyStore, getProducts);
router.post('/products/tags', identifyStore, getProductsByTags);

export default router;