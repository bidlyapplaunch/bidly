import express from 'express';
import Customer from '../models/Customer.js';
import { AppError } from '../middleware/errorHandler.js';
import { identifyStore } from '../middleware/storeMiddleware.js';

const router = express.Router();

const sanitizeOptionalString = (value) =>
  typeof value === 'string' ? value : undefined;

// Test route to check if customer routes are working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Customer routes are working' });
});

// Save customer data (simplified version of sync)
router.post('/saveCustomer', async (req, res, next) => {
  try {
    console.log('📧 Customer save endpoint hit');
    console.log('📧 Request body:', req.body);
    console.log('📧 Request headers:', req.headers);
    
    const { 
      shopifyId, 
      email, 
      firstName, 
      lastName, 
      shopDomain,
      displayName 
    } = req.body;

    console.log('📧 Customer save request:', {
      shopifyId,
      email,
      firstName,
      lastName,
      shopDomain
    });

    if (!email || !shopDomain) {
      console.error('❌ Missing required fields:', { email: !!email, shopDomain: !!shopDomain });
      return next(new AppError('Missing required customer data: email and shop domain are required', 400));
    }

    // Find or create customer
    const customer = await Customer.findOrCreate({
      shopifyId,
      email,
      firstName: sanitizeOptionalString(firstName),
      lastName: sanitizeOptionalString(lastName),
      displayName: sanitizeOptionalString(displayName),
      isTemp: !shopifyId // If no shopifyId, it's a temp customer
    }, shopDomain);

    console.log('✅ Customer saved/updated successfully:', {
      id: customer._id,
      email: customer.email,
      shopDomain
    });

    res.json({
      success: true,
      customer: {
        id: customer._id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        displayName: customer.displayName,
        fullName: customer.fullName,
        shopifyId: customer.shopifyId,
        isTemp: customer.isTemp,
        totalBids: customer.totalBids,
        auctionsWon: customer.auctionsWon,
        totalBidAmount: customer.totalBidAmount
      }
    });
  } catch (error) {
    console.error('❌ Error saving customer:', error);
    console.error('   Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue,
      name: error.name
    });
    
    // Handle duplicate key errors (email already exists)
    if (error.code === 11000) {
      return next(new AppError('Customer with this email already exists in this store', 409));
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return next(new AppError(`Validation error: ${error.message}`, 400));
    }
    
    // Handle cast errors
    if (error.name === 'CastError') {
      return next(new AppError(`Invalid data format: ${error.message}`, 400));
    }
    
    next(error);
  }
});

// Sync Shopify customer data
router.post('/sync', async (req, res, next) => {
  try {
    const { 
      shopifyId, 
      email, 
      firstName, 
      lastName, 
      shopDomain,
      displayName 
    } = req.body;

    if (!email || !shopDomain) {
      return next(new AppError('Missing required customer data: email and shop domain are required', 400));
    }

    // Find or create customer
    const customer = await Customer.findOrCreate({
      shopifyId,
      email,
      firstName: sanitizeOptionalString(firstName),
      lastName: sanitizeOptionalString(lastName),
      displayName: sanitizeOptionalString(displayName),
      isTemp: false
    }, shopDomain);

    res.json({
      success: true,
      customer: {
        id: customer._id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        displayName: customer.displayName,
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
      firstName, 
      lastName, 
      email, 
      shopDomain,
      displayName
    } = req.body;

    if (!email || !shopDomain) {
      return next(new AppError('Email and shop domain are required', 400));
    }

    // Find or create temporary customer
    const customer = await Customer.findOrCreate({
      email,
      firstName: sanitizeOptionalString(firstName),
      lastName: sanitizeOptionalString(lastName),
      displayName: sanitizeOptionalString(displayName),
      isTemp: true
    }, shopDomain);

    res.json({
      success: true,
      customer: {
        id: customer._id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        displayName: customer.displayName,
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
router.post('/:id/bid', identifyStore, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { auctionId, amount, isWinning } = req.body;
    const shopDomain = req.shopDomain || req.query.shopDomain;

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
