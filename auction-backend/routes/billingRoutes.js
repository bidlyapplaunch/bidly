import express from 'express';
import { subscribeToPlan, getCurrentPlan, confirmSubscription, syncPlan, getPlanCapabilitiesHandler, cancelCurrentSubscription } from '../controllers/billingController.js';
import { identifyStore } from '../middleware/storeMiddleware.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Admin-triggered subscription creation. requireAuth (Shopify session token) added so a
// caller can't change a store's billing just by knowing its shop domain. (SVC-01)
router.post('/subscribe', identifyStore, requireAuth, subscribeToPlan);

// Current plan details for admin UI
router.get('/current', identifyStore, getCurrentPlan);

// Lightweight endpoint to share plan capabilities with storefront/widget
router.get('/capabilities', identifyStore, getPlanCapabilitiesHandler);

// Manual sync endpoint (admin)
router.post('/sync', identifyStore, requireAuth, syncPlan);

// Cancel current subscription
router.post('/cancel', identifyStore, requireAuth, cancelCurrentSubscription);

// Shopify return URL after merchant approves billing (browser redirect — no auth header)
router.get('/confirm', identifyStore, confirmSubscription);

// Manual plan override (admin only - bypasses Shopify sync). Previously unauthenticated,
// allowing anyone to grant a store free Enterprise. Now requires a Shopify session. (SVC-01)
router.post('/override', identifyStore, requireAuth, async (req, res, next) => {
  try {
    if (!req.store) {
      return res.status(400).json({ success: false, message: 'Store context required' });
    }

    const { plan } = req.body;
    if (!plan) {
      return res.status(400).json({ success: false, message: 'Plan is required' });
    }

    const validPlans = ['free', 'basic', 'pro', 'enterprise'];
    const planKey = plan.toLowerCase();
    if (!validPlans.includes(planKey)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid plan. Must be one of: ${validPlans.join(', ')}` 
      });
    }

    const previousPlan = req.store.plan || 'free';
    req.store.plan = planKey;
    req.store.planManuallySet = true;
    req.store.pendingPlan = null;
    req.store.planActiveAt = new Date();
    await req.store.save();


    res.json({
      success: true,
      message: `Plan manually set to ${planKey}`,
      previousPlan,
      newPlan: planKey,
      shopDomain: req.store.shopDomain
    });
  } catch (error) {
    console.error('Error overriding plan:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to override plan',
      error: error.message 
    });
  }
});

export default router;


