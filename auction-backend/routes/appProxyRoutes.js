import express from 'express';
import {
  getAllAuctions,
  getAuctionById,
  placeBid,
  buyNow
} from '../controllers/auctionController.js';
import {
  validatePlaceBid,
  validateBuyNow,
  validateId
} from '../middleware/validation.js';
import { identifyStore } from '../middleware/storeMiddleware.js';

const router = express.Router();

/**
 * App Proxy Routes for Shopify Theme Integration
 * These routes are accessible via /apps/bidly/* from the storefront
 * They handle CORS and provide a secure way for themes to access auction data
 */

// All app proxy routes require store identification
router.use(identifyStore);

// Get all auctions for theme display
// GET /apps/bidly/api/auctions?shop=store.myshopify.com
router.get('/api/auctions', getAllAuctions);

// Get single auction by ID (accepts both MongoDB ObjectId and Shopify Product ID)
// GET /apps/bidly/api/auctions/:id?shop=store.myshopify.com
router.get('/api/auctions/:id', getAuctionById);

// Place bid on auction
// POST /apps/bidly/api/auctions/:id/bid?shop=store.myshopify.com
router.post('/api/auctions/:id/bid', validateId, validatePlaceBid, placeBid);

// Buy now
// POST /apps/bidly/api/auctions/:id/buy-now?shop=store.myshopify.com
router.post('/api/auctions/:id/buy-now', validateId, validateBuyNow, buyNow);

// Health check endpoint
// GET /apps/bidly/health
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Bidly App Proxy is running',
    timestamp: new Date().toISOString(),
    shop: req.shopDomain
  });
});

export default router;
