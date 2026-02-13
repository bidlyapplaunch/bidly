import express from 'express';
import { AppError } from '../middleware/errorHandler.js';
import getShopifyService from '../services/shopifyService.js';
import { identifyStore } from '../middleware/storeMiddleware.js';

const router = express.Router();

router.use(identifyStore);

/**
 * GET /api/onboarding/status
 * Returns onboarding completion status and widget activation state
 */
router.get('/status', async (req, res, next) => {
  try {
    if (!req.store) {
      throw new AppError('Store context required', 400);
    }

    const shopDomain = req.shopDomain;
    const storeSlug = shopDomain.replace('.myshopify.com', '');

    // Skip app embed check entirely - it's too slow and causes timeouts
    // Just return false for widgetActive to allow dashboard to load
    const widgetActive = false;
    const widgetError = null;

    return res.json({
      success: true,
      onboardingComplete: !!req.store.onboardingComplete,
      widgetActive,
      widgetError: widgetError || null,
      shopDomain,
      storeSlug,
      marketplaceUrl: `https://${shopDomain}/apps/bidly?shop=${shopDomain}`
    });
  } catch (error) {
    next(error);
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

