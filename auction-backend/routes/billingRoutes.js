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

// Manual plan override (admin only - bypasses Shopify sync)
router.post('/override', identifyStore, async (req, res, next) => {
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

    console.log(`✅ Manually set plan for ${req.store.shopDomain}: ${previousPlan} → ${planKey}`);

    res.json({
      success: true,
      message: `Plan manually set to ${planKey}`,
      previousPlan,
      newPlan: planKey,
      shopDomain: req.store.shopDomain
    });
  } catch (error) {
    console.error('❌ Error overriding plan:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to override plan',
      error: error.message 
    });
  }
});

export default router;


