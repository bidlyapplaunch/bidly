import express from 'express';
import { subscribeToPlan, getCurrentPlan, confirmSubscription, syncPlan, getPlanCapabilitiesHandler } from '../controllers/billingController.js';
import { requireAuth } from '../middleware/auth.js';
import { identifyStore } from '../middleware/storeMiddleware.js';

const router = express.Router();

// Admin-triggered subscription creation
router.post('/subscribe', requireAuth, identifyStore, subscribeToPlan);

// Current plan details for admin UI
router.get('/current', requireAuth, identifyStore, getCurrentPlan);

// Lightweight endpoint to share plan capabilities with storefront/widget
router.get('/capabilities', identifyStore, getPlanCapabilitiesHandler);

// Manual sync endpoint (admin)
router.post('/sync', requireAuth, identifyStore, syncPlan);

// Shopify return URL after merchant approves billing
router.get('/confirm', identifyStore, confirmSubscription);

export default router;


