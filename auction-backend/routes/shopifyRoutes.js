import express from 'express';
import {
  getProduct,
  getProducts,
  searchProducts,
  getAllProducts,
  validateProduct,
  getProductInventory,
  getProductSuggestions
} from '../controllers/shopifyController.js';
import { validateId } from '../middleware/validation.js';

const router = express.Router();

// Product routes
router.get('/products/search', searchProducts);
router.get('/products/suggestions', getProductSuggestions);
router.get('/products', getAllProducts);
router.get('/products/:productId', validateId, getProduct);
router.get('/products/:productId/inventory', validateId, getProductInventory);
router.get('/products/:productId/validate', validateId, validateProduct);
router.post('/products/batch', getProducts);

export default router;