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

    // Check app embed status with timeout to prevent hanging
    let widgetActive = false;
    let widgetError = null;
    
    // Skip API call if store doesn't have access token (not configured yet)
    const hasAccessToken = req.store?.accessToken;
    
    if (!hasAccessToken) {
      console.log('⚠️ Store has no access token, skipping app embed check');
      widgetActive = false;
      widgetError = 'Store not configured - no access token';
    } else {
      try {
        const shopifyService = getShopifyService();
        // Add timeout wrapper to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout checking app embed status')), 5000)
        );
        
        const embedCheckPromise = shopifyService.isAppEmbedEnabled(req.shopDomain);
        const result = await Promise.race([embedCheckPromise, timeoutPromise]);
        
        widgetActive = result.active || false;
        widgetError = result.error || null;
      } catch (error) {
        // If the check times out or fails, log but don't block the response
        console.warn('⚠️ App embed status check failed or timed out:', error.message);
        widgetActive = false;
        widgetError = error.message;
      }
    }

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

