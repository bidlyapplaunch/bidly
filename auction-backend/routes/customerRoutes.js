import express from 'express';
import Customer from '../models/Customer.js';
import { AppError } from '../middleware/errorHandler.js';
import { identifyStore } from '../middleware/storeMiddleware.js';
import { ensureCustomer } from '../services/customerService.js';

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

    // Ensure customer exists (global + per-store profile)
    const customer = await ensureCustomer(
      shopDomain,
      email,
      sanitizeOptionalString(firstName),
      sanitizeOptionalString(lastName),
      shopifyId || null,
      !shopifyId // isTemp = true if no shopifyId
    );

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
    
    // Handle duplicate key errors (should not happen with ensureCustomer, but keep for safety)
    if (error.code === 11000) {
      // Extract email and shopDomain from req.body
      const errorEmail = req.body?.email || error.keyValue?.email;
      const errorShopDomain = req.body?.shopDomain;
      
      if (!errorEmail || !errorShopDomain) {
        console.error('❌ Cannot handle duplicate error: missing email or shopDomain');
        return next(new AppError('Customer with this email already exists in this store', 409));
      }
      
      console.log('⚠️ Duplicate customer detected, fetching existing customer:', { email: errorEmail, shopDomain: errorShopDomain });
      try {
        // Find the existing customer directly (don't use ensureCustomer as it might try to create again)
        const existingCustomer = await Customer.findOne({
          email: errorEmail.toLowerCase().trim(),
          shopDomain: errorShopDomain
        });
        
        if (!existingCustomer) {
          console.error('❌ Customer not found despite duplicate key error');
          return next(new AppError('Customer with this email already exists in this store', 409));
        }
        
        // Update fields if provided and different
        let shouldUpdate = false;
        if (req.body?.shopifyId && !existingCustomer.shopifyId) {
          existingCustomer.shopifyId = req.body.shopifyId;
          existingCustomer.isTemp = false;
          shouldUpdate = true;
        }
        if (req.body?.firstName && !existingCustomer.firstName) {
          existingCustomer.firstName = req.body.firstName;
          shouldUpdate = true;
        }
        if (req.body?.lastName && !existingCustomer.lastName) {
          existingCustomer.lastName = req.body.lastName;
          shouldUpdate = true;
        }
        if (shouldUpdate) {
          await existingCustomer.save();
        }
        
        console.log('✅ Found existing customer, returning it');
        return res.json({
          success: true,
          customer: {
            id: existingCustomer._id,
            email: existingCustomer.email,
            firstName: existingCustomer.firstName,
            lastName: existingCustomer.lastName,
            displayName: existingCustomer.displayName,
            fullName: existingCustomer.fullName,
            shopifyId: existingCustomer.shopifyId,
            isTemp: existingCustomer.isTemp,
            totalBids: existingCustomer.totalBids,
            auctionsWon: existingCustomer.auctionsWon,
            totalBidAmount: existingCustomer.totalBidAmount
          }
        });
      } catch (findError) {
        console.error('❌ Error finding existing customer:', findError);
        return next(new AppError('Customer with this email already exists in this store', 409));
      }
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

    // Ensure customer exists (global + per-store profile)
    const customer = await ensureCustomer(
      shopDomain,
      email,
      sanitizeOptionalString(firstName),
      sanitizeOptionalString(lastName),
      shopifyId || null,
      !shopifyId // isTemp = true if no shopifyId
    );

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

    // Ensure customer exists (global + per-store profile)
    // For temp-login, always mark as temp (no shopifyId)
    const customer = await ensureCustomer(
      shopDomain,
      email,
      sanitizeOptionalString(firstName),
      sanitizeOptionalString(lastName),
      null, // No shopifyId for temp login
      true  // isTemp = true for temp login
    );

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

// Get customer by email and shop domain (MUST be before /:id route)
router.get('/by-email', async (req, res, next) => {
  try {
    const email = req.query.email;
    const shopDomain =
      req.query.shop ||
      req.query.shopDomain ||
      req.query.store ||
      req.query.domain;

    if (!email || !shopDomain) {
      return next(new AppError('Email and shopDomain (any format) is required', 400));
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedShop = shopDomain.toLowerCase().trim();
    
    // Try multiple shop domain formats to handle different formats
    const shopDomainVariants = [
      normalizedShop, // Exact match
      normalizedShop.endsWith('.myshopify.com') 
        ? normalizedShop 
        : `${normalizedShop}.myshopify.com`, // Add .myshopify.com if missing
      normalizedShop.replace('.myshopify.com', ''), // Remove .myshopify.com
      normalizedShop.replace(/^https?:\/\//, '').replace(/\/$/, '') // Remove protocol and trailing slash
    ];
    
    // Remove duplicates
    const uniqueVariants = [...new Set(shopDomainVariants)];
    
    let customer = null;
    for (const shopVariant of uniqueVariants) {
      customer = await Customer.findOne({ 
        email: normalizedEmail, 
        shopDomain: shopVariant 
      });
      if (customer) {
        console.log(`✅ Found customer with shop domain variant: ${shopVariant}`);
        break;
      }
    }

    if (!customer) {
      console.log(`❌ Customer not found for email: ${normalizedEmail}, tried shop variants:`, uniqueVariants);

      const targetShopDomain = uniqueVariants[0];
      console.log('🆕 Creating per-store customer via ensureCustomer for', {
        email: normalizedEmail,
        shopDomain: targetShopDomain
      });

      customer = await ensureCustomer(
        targetShopDomain,
        normalizedEmail,
        null,
        null,
        null,
        false
      );
    }

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
