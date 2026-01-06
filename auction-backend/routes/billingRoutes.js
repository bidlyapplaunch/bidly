import express from 'express';
import { subscribeToPlan, getCurrentPlan, confirmSubscription, syncPlan, getPlanCapabilitiesHandler, cancelCurrentSubscription } from '../controllers/billingController.js';
import { identifyStore } from '../middleware/storeMiddleware.js';

const router = express.Router();

// Admin-triggered subscription creation (legacy embedded: no JWT required, store scoped)
router.post('/subscribe', identifyStore, subscribeToPlan);

// Current plan details for admin UI
router.get('/current', identifyStore, getCurrentPlan);

// Lightweight endpoint to share plan capabilities with storefront/widget
router.get('/capabilities', identifyStore, getPlanCapabilitiesHandler);

// Manual sync endpoint (admin)
router.post('/sync', identifyStore, syncPlan);

// Cancel current subscription
router.post('/cancel', identifyStore, cancelCurrentSubscription);

// Shopify return URL after merchant approves billing
router.get('/confirm', identifyStore, confirmSubscription);

export default router;


