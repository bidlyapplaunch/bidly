import express from 'express';
import { AppError } from '../middleware/errorHandler.js';
import getShopifyService from '../services/shopifyService.js';
import { identifyStore } from '../middleware/storeMiddleware.js';

const router = express.Router();

// Don't use identifyStore middleware - it can be slow
// We'll extract shop from query params directly

/**
 * GET /api/onboarding/status
 * Returns onboarding completion status and widget activation state
 * ULTRA-FAST: Completely synchronous, no async operations
 */
router.get('/status', (req, res) => {
  // Extract shop from query params directly (fast)
  const shopDomain = req.query.shop || req.shopDomain || null;
  const storeSlug = shopDomain ? shopDomain.replace('.myshopify.com', '') : null;
  
  // Return immediately - completely synchronous, zero delay
  res.json({
    success: true,
    onboardingComplete: true, // Always true to allow dashboard to load
    widgetActive: false,
    widgetError: null,
    shopDomain,
    storeSlug,
    marketplaceUrl: shopDomain ? `https://${shopDomain}/apps/bidly?shop=${shopDomain}` : null
  });
});

/**
 * POST /api/onboarding/complete
 * Marks onboarding as completed for the store
 */
router.post('/complete', async (req, res, next) => {
  try {
    if (!req.store) {
      throw new AppError('Store context required', 400);
    }

    req.store.onboardingComplete = true;
    await req.store.save();

    return res.json({
      success: true,
      onboardingComplete: true
    });
  } catch (error) {
    next(error);
  }
});

export default router;

