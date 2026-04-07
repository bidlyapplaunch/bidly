import express from 'express';
import {
  getAnalytics,
  getRevenueAnalytics,
  getUserAnalytics
} from '../controllers/analyticsController.js';
import { optionalStoreIdentification } from '../middleware/storeMiddleware.js';

const router = express.Router();

// Identify store (does not hard fail if absent; controller will validate)
router.use(optionalStoreIdentification);

// Analytics endpoints
router.get('/', getAnalytics);
router.get('/revenue', getRevenueAnalytics);
router.get('/users', getUserAnalytics);

export default router;
