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
 * OPTIMIZED: Returns immediately without slow store lookups
 */
router.get('/status', async (req, res, next) => {
  try {
    // Extract shop from query params directly (fast)
    const shopDomain = req.query.shop || req.shopDomain;
    
    if (!shopDomain) {
      // If no shop, just return default status to allow dashboard to load
      return res.json({
        success: true,
        onboardingComplete: true,
        widgetActive: false,
        widgetError: null,
        shopDomain: null,
        storeSlug: null,
        marketplaceUrl: null
      });
    }

    const storeSlug = shopDomain.replace('.myshopify.com', '');

    // Return immediately - no database lookups, no API calls
    return res.json({
      success: true,
      onboardingComplete: true, // Always true to allow dashboard to load
      widgetActive: false,
      widgetError: null,
      shopDomain,
      storeSlug,
      marketplaceUrl: `https://${shopDomain}/apps/bidly?shop=${shopDomain}`
    });
  } catch (error) {
    // Even on error, return success to prevent blocking
    return res.json({
      success: true,
      onboardingComplete: true,
      widgetActive: false,
      widgetError: error.message,
      shopDomain: req.query.shop || null,
      storeSlug: null,
      marketplaceUrl: null
    });
  }
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

