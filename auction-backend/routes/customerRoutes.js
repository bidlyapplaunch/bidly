import express from 'express';
import Customer from '../models/Customer.js';
import { AppError } from '../middleware/errorHandler.js';
import { identifyStore } from '../middleware/storeMiddleware.js';

const router = express.Router();

// Save customer data (simplified version of sync)
router.post('/saveCustomer', async (req, res, next) => {
  try {
    const { 
      shopifyId, 
      email, 
      firstName, 
      lastName, 
      shopDomain 
    } = req.body;

    console.log('📧 Customer save request:', {
      shopifyId,
      email,
      firstName,
      lastName,
      shopDomain
    });

    if (!email || !firstName || !shopDomain) {
      console.error('❌ Missing required fields:', { email: !!email, firstName: !!firstName, shopDomain: !!shopDomain });
      return next(new AppError('Missing required customer data: email, firstName, and shopDomain are required', 400));
    }

    // Handle missing lastName (some Shopify customers might not have last name)
    const customerLastName = lastName || 'Customer';

    // Find or create customer
    const customer = await Customer.findOrCreate({
      shopifyId,
      email,
      firstName,
      lastName: customerLastName,
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
      keyValue: error.keyValue
    });
    
    // Handle duplicate key errors (email already exists)
    if (error.code === 11000) {
      return next(new AppError('Customer with this email already exists in this store', 409));
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
      firstName, 
      lastName, 
      email, 
      shopDomain 
    } = req.body;

    if (!firstName || !lastName || !email || !shopDomain) {
      return next(new AppError('First name, last name, email, and shop domain are required', 400));
    }

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
