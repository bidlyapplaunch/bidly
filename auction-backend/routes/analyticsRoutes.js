import express from 'express';
import {
  getAnalytics,
  getRevenueAnalytics,
  getUserAnalytics
} from '../controllers/analyticsController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { optionalStoreIdentification } from '../middleware/storeMiddleware.js';

const router = express.Router();

// All analytics routes require authentication and admin role
// Temporarily disabled for testing - re-enable in production
// router.use(requireAuth);
// router.use(requireAdmin);

// Identify store (does not hard fail if absent; controller will validate)
router.use(optionalStoreIdentification);

// Analytics endpoints
router.get('/', getAnalytics);
router.get('/revenue', getRevenueAnalytics);
router.get('/users', getUserAnalytics);

export default router;
