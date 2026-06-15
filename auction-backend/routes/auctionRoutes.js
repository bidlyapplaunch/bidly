import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
  createAuction,
  getAllAuctions,
  getAuctionById,
  updateAuction,
  deleteAuction,
  placeBid,
  buyNow,
  getAuctionStats,
  relistAuction,
  refreshProductData,
  refreshAllProductData,
  getAuctionsWithProductData,
} from '../controllers/auctionController.js';
import {
  validateCreateAuction,
  validateUpdateAuction,
  validatePlaceBid,
  validateBuyNow,
  validateId
} from '../middleware/validation.js';
import { checkPlan, enforceAuctionLimit } from '../middleware/planGuard.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

const bidRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 15, // 15 bids per minute per shop+IP combo
  keyGenerator: (req) => `${req.shopDomain || 'unknown'}:${ipKeyGenerator(req.ip)}`,
  message: { success: false, message: 'Too many bid attempts. Please wait a moment before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auction CRUD routes
// Free plan is allowed to create auctions, limited by enforceAuctionLimit
router.post('/', requireAuth, enforceAuctionLimit, validateCreateAuction, createAuction);
router.get('/', getAllAuctions);
router.get('/stats', requireAuth, getAuctionStats);
router.get('/with-product-data', requireAuth, getAuctionsWithProductData);

// Get auction by Shopify product ID (for widget) - MUST be before /:id route
router.get('/by-product/:productId', async (req, res, next) => {
  try {
    const { productId } = req.params;
    const shopDomain = req.shopDomain;
    
    if (!shopDomain) {
      return next(new AppError('Shop domain is required (middleware)', 400));
    }
    
    // Find auction by Shopify product ID (exclude soft-deleted auctions)
    const Auction = (await import('../models/Auction.js')).default;
    const auction = await Auction.findOne({ 
      shopifyProductId: productId, 
      shopDomain: shopDomain,
      isDeleted: { $ne: true } // Exclude soft-deleted auctions
    });
    
    if (!auction) {
      const { t } = await import('../services/i18n.js');
      const message = await t(req.shopDomain || null, 'errors.auction_not_found');
      return res.status(404).json({ success: false, message });
    }
    
    // Compute real-time status
    const now = new Date();
    const startTime = new Date(auction.startTime);
    const endTime = new Date(auction.endTime);
    
    let status = auction.status;
    if (auction.status !== 'closed') {
      if (now < startTime) {
        status = 'pending';
      } else if (now >= startTime && now < endTime) {
        status = 'active';
      } else {
        status = 'ended';
      }
    }
    
    const auctionWithRealTimeStatus = {
      ...auction.toObject(),
      status: status
    };

    let planContext = null;
    try {
      const Store = (await import('../models/Store.js')).default;
      const { sanitizePlan, getPlanCapabilities, DEFAULT_PLAN } = await import('../config/billingPlans.js');
      const store = await Store.findByDomain(shopDomain).select('plan');
      const planKey = sanitizePlan(store?.plan || DEFAULT_PLAN);
      planContext = getPlanCapabilities(planKey);
    } catch (planError) {
      console.warn('Failed to resolve plan context for store', shopDomain, planError.message);
    }
    
    res.json({
      success: true,
      auction: auctionWithRealTimeStatus,
      plan: planContext
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', validateId, getAuctionById);
router.put('/:id', requireAuth, checkPlan('free'), validateUpdateAuction, updateAuction);
router.delete('/:id', requireAuth, validateId, deleteAuction);

// Bid placement route
router.post('/:id/bid', bidRateLimit, validatePlaceBid, placeBid);

// Buy now route
router.post('/:id/buy-now', bidRateLimit, validateBuyNow, buyNow);

// Relist auction route
router.put('/:id/relist', requireAuth, checkPlan('free'), enforceAuctionLimit, validateCreateAuction, relistAuction);

// Shopify product data routes
router.put('/:id/refresh-product', requireAuth, validateId, refreshProductData);
router.put('/refresh-all-products', requireAuth, refreshAllProductData);

export default router;
