import express from 'express';
import { AppError } from '../middleware/errorHandler.js';
import getShopifyService from '../services/shopifyService.js';
import { requireAuth } from '../middleware/auth.js';
import { identifyStore } from '../middleware/storeMiddleware.js';

const router = express.Router();

router.use(requireAuth);
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

    const shopifyService = getShopifyService();
    const { active: widgetActive, error: widgetError } = await shopifyService.isAppEmbedEnabled(req.shopDomain);

    const shopDomain = req.shopDomain;
    const storeSlug = shopDomain.replace('.myshopify.com', '');

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

