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
import { validateId } from '../middleware/validation.js';

const router = express.Router();

// Service status
router.get('/status', getServiceStatus);

// Test endpoint
router.get('/test', testShopifyConnection);

// Direct search route for convenience
router.get('/search', searchProducts);

// Product operations
router.get('/products/search', searchProducts);
router.get('/products/suggestions', getProductSuggestions);
router.get('/products', getAllProducts);
router.get('/products/:productId', validateId, getProduct);
router.get('/products/:productId/validate', validateId, validateProduct);
router.get('/products/:productId/inventory', validateId, getProductInventory);
router.get('/products/handle/:handle', getProductByHandle);
router.get('/products/vendor/:vendor', getProductsByVendor);
router.get('/products/type/:productType', getProductsByType);
router.post('/products/batch', getProducts);
router.post('/products/tags', getProductsByTags);

export default router;