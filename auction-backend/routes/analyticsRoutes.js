import express from 'express';
import {
  getAnalytics,
  getRevenueAnalytics,
  getUserAnalytics
} from '../controllers/analyticsController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All analytics routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

// Analytics endpoints
router.get('/', getAnalytics);
router.get('/revenue', getRevenueAnalytics);
router.get('/users', getUserAnalytics);

export default router;
