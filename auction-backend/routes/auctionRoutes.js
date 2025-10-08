import express from 'express';
import {
  createAuction,
  getAllAuctions,
  getAuctionById,
  updateAuction,
  deleteAuction,
  placeBid,
  getAuctionStats,
  relistAuction
} from '../controllers/auctionController.js';
import {
  validateCreateAuction,
  validateUpdateAuction,
  validatePlaceBid,
  validateId
} from '../middleware/validation.js';

const router = express.Router();

// Auction CRUD routes
router.post('/', validateCreateAuction, createAuction);
router.get('/', getAllAuctions);
router.get('/stats', getAuctionStats);
router.get('/:id', validateId, getAuctionById);
router.put('/:id', validateUpdateAuction, updateAuction);
router.delete('/:id', validateId, deleteAuction);

// Bid placement route
router.post('/:id/bid', validatePlaceBid, placeBid);

// Relist auction route
router.put('/:id/relist', validateCreateAuction, relistAuction);

export default router;
