import express from 'express';
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
  getAllAuctionsPage,
  getAuctionDetailsPage,
} from '../controllers/auctionController.js';
import {
  validateCreateAuction,
  validateUpdateAuction,
  validatePlaceBid,
  validateBuyNow,
  validateId
} from '../middleware/validation.js';
import { checkPlan, enforceAuctionLimit } from '../middleware/planGuard.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Auction listing page route (all auctions) - MUST be first to avoid conflicts
// This route doesn't need store identification middleware
router.get('/list', getAllAuctionsPage);

// Auction details page route (individual auction)
router.get('/page/:id', validateId, getAuctionDetailsPage);

// Auction CRUD routes
// Free plan is allowed to create auctions, limited by enforceAuctionLimit
router.post('/', enforceAuctionLimit, validateCreateAuction, createAuction);
router.get('/', getAllAuctions);
router.get('/stats', getAuctionStats);
router.get('/with-product-data', getAuctionsWithProductData);

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
      console.warn('⚠️ Failed to resolve plan context for store', shopDomain, planError.message);
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
router.put('/:id', checkPlan('free'), validateUpdateAuction, updateAuction);
router.delete('/:id', validateId, deleteAuction);

// Bid placement route
router.post('/:id/bid', validatePlaceBid, placeBid);

// Buy now route
router.post('/:id/buy-now', validateBuyNow, buyNow);

// Relist auction route
router.put('/:id/relist', checkPlan('free'), enforceAuctionLimit, validateCreateAuction, relistAuction);

// Shopify product data routes
router.put('/:id/refresh-product', validateId, refreshProductData);
router.put('/refresh-all-products', refreshAllProductData);

export default router;
