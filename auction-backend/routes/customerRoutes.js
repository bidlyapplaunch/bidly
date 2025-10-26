import express from 'express';
import Customer from '../models/Customer.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Sync Shopify customer data
router.post('/sync', async (req, res, next) => {
  try {
    const { 
      shopifyId, 
      email, 
      firstName, 
      lastName, 
      shopDomain 
    } = req.body;

    if (!email || !firstName || !lastName || !shopDomain) {
      return next(new AppError('Missing required customer data', 400));
    }

    // Find or create customer
    const customer = await Customer.findOrCreate({
      shopifyId,
      email,
      firstName,
      lastName,
      isTemp: false
    }, shopDomain);

    res.json({
      success: true,
      customer: {
        id: customer._id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        fullName: customer.fullName,
        shopifyId: customer.shopifyId,
        isTemp: customer.isTemp,
        totalBids: customer.totalBids,
        auctionsWon: customer.auctionsWon,
        totalBidAmount: customer.totalBidAmount
      }
    });
  } catch (error) {
    next(error);
  }
});

// Temporary guest login
router.post('/temp-login', async (req, res, next) => {
  try {
    const { 
      name, 
      email, 
      shopDomain 
    } = req.body;

    if (!name || !email || !shopDomain) {
      return next(new AppError('Name, email, and shop domain are required', 400));
    }

    // Parse name into first and last name
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Find or create temporary customer
    const customer = await Customer.findOrCreate({
      email,
      firstName,
      lastName,
      isTemp: true
    }, shopDomain);

    res.json({
      success: true,
      customer: {
        id: customer._id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        fullName: customer.fullName,
        shopifyId: customer.shopifyId,
        isTemp: customer.isTemp,
        totalBids: customer.totalBids,
        auctionsWon: customer.auctionsWon,
        totalBidAmount: customer.totalBidAmount
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get customer by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { shopDomain } = req.query;

    if (!shopDomain) {
      return next(new AppError('Shop domain is required', 400));
    }

    const customer = await Customer.findOne({ 
      _id: id, 
      shopDomain 
    });

    if (!customer) {
      return next(new AppError('Customer not found', 404));
    }

    res.json({
      success: true,
      customer: {
        id: customer._id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        fullName: customer.fullName,
        shopifyId: customer.shopifyId,
        isTemp: customer.isTemp,
        totalBids: customer.totalBids,
        auctionsWon: customer.auctionsWon,
        totalBidAmount: customer.totalBidAmount,
        bidHistory: customer.bidHistory
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update customer bid history
router.post('/:id/bid', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { auctionId, amount, isWinning } = req.body;
    const { shopDomain } = req.query;

    if (!shopDomain) {
      return next(new AppError('Shop domain is required', 400));
    }

    const customer = await Customer.findOne({ 
      _id: id, 
      shopDomain 
    });

    if (!customer) {
      return next(new AppError('Customer not found', 404));
    }

    await customer.addBid(auctionId, amount, isWinning);

    res.json({
      success: true,
      message: 'Bid added to customer history'
    });
  } catch (error) {
    next(error);
  }
});

// Get customer bidding stats
router.get('/:id/stats', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { shopDomain } = req.query;

    if (!shopDomain) {
      return next(new AppError('Shop domain is required', 400));
    }

    const customer = await Customer.findOne({ 
      _id: id, 
      shopDomain 
    });

    if (!customer) {
      return next(new AppError('Customer not found', 404));
    }

    res.json({
      success: true,
      stats: {
        totalBids: customer.totalBids,
        auctionsWon: customer.auctionsWon,
        totalBidAmount: customer.totalBidAmount,
        averageBidAmount: customer.totalBids > 0 ? customer.totalBidAmount / customer.totalBids : 0,
        winRate: customer.totalBids > 0 ? (customer.auctionsWon / customer.totalBids) * 100 : 0
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
