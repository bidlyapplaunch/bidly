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
import { identifyStore } from '../middleware/storeMiddleware.js';

const router = express.Router();

// Auction listing page route (all auctions) - MUST be first to avoid conflicts
// This route doesn't need store identification middleware
router.get('/list', getAllAuctionsPage);

// All other auction routes require store identification
router.use(identifyStore);

// Auction details page route (individual auction)
router.get('/page/:id', validateId, getAuctionDetailsPage);

// Auction CRUD routes
router.post('/', validateCreateAuction, createAuction);
router.get('/', getAllAuctions);
router.get('/stats', getAuctionStats);
router.get('/with-product-data', getAuctionsWithProductData);
router.get('/:id', validateId, getAuctionById);
router.put('/:id', validateUpdateAuction, updateAuction);
router.delete('/:id', validateId, deleteAuction);

// Bid placement route
router.post('/:id/bid', validatePlaceBid, placeBid);

// Buy now route
router.post('/:id/buy-now', validateBuyNow, buyNow);

// Relist auction route
router.put('/:id/relist', validateCreateAuction, relistAuction);

// Shopify product data routes
router.put('/:id/refresh-product', validateId, refreshProductData);
router.put('/refresh-all-products', refreshAllProductData);

export default router;
