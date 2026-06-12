import express from 'express';
import {
  getAnalytics,
  getRevenueAnalytics,
  getUserAnalytics
} from '../controllers/analyticsController.js';
import { optionalStoreIdentification } from '../middleware/storeMiddleware.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Identify store (does not hard fail if absent; controller will validate)
router.use(optionalStoreIdentification);
// Require a valid Shopify session — analytics expose a store's revenue/user data and must
// not be readable by anyone who simply supplies ?shop=. (SVC-23)
router.use(requireAuth);

// Analytics endpoints
router.get('/', getAnalytics);
router.get('/revenue', getRevenueAnalytics);
router.get('/users', getUserAnalytics);

export default router;
