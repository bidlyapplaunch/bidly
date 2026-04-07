import express from 'express';
import jwt from 'jsonwebtoken';
import Customer from '../models/Customer.js';
import { AppError } from '../middleware/errorHandler.js';
import { ensureCustomer } from '../services/customerService.js';
import rateLimit from 'express-rate-limit';

const JWT_SECRET = process.env.JWT_SECRET;

function generateCustomerToken(customer, shopDomain) {
  return jwt.sign(
    { customerId: customer._id.toString(), email: customer.email, shopDomain, type: 'customer' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function verifyCustomerToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Customer authentication required' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== 'customer') {
      return res.status(403).json({ success: false, message: 'Invalid token type' });
    }

    // Verify shop domain matches
    if (decoded.shopDomain !== req.shopDomain) {
      return res.status(403).json({ success: false, message: 'Token does not match current shop' });
    }

    req.customerAuth = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

const saveCustomerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Please try again in a minute.' }
});

const router = express.Router();

const sanitizeOptionalString = (value) =>
  typeof value === 'string' ? value : undefined;

// Test route to check if customer routes are working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Customer routes are working' });
});

// Save customer data (simplified version of sync)
router.post('/saveCustomer', saveCustomerLimiter, async (req, res, next) => {
  try {
    console.log('📧 Customer save endpoint hit');
    console.log('📧 Request body:', req.body);
    console.log('📧 Request headers:', req.headers);
    
    const {
      shopifyId,
      email,
      firstName,
      lastName,
      displayName,
      phone
    } = req.body;
    const shopDomain = req.shopDomain;

    console.log('📧 Customer save request:', {
      shopifyId,
      email,
      firstName,
      lastName,
      shopDomain
    });

    if (!shopDomain) {
      return next(new AppError('Shop domain is required (middleware)', 400));
    }

    if (!email) {
      console.error('❌ Missing required fields:', { email: !!email, shopDomain: !!shopDomain });
      return next(new AppError('Missing required customer data: email is required', 400));
    }

    // Validate email format server-side
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return next(new AppError('Invalid email format', 400));
    }

    // Validate phone format if provided (digits, spaces, dashes, plus, parens)
    if (phone && typeof phone === 'string') {
      const trimmedPhone = phone.trim();
      if (trimmedPhone.length === 0 || !/^[+\d\s\-()]+$/.test(trimmedPhone)) {
        return next(new AppError('Invalid phone number format', 400));
      }
    }

    // Ensure customer exists (global + per-store profile)
    const customer = await ensureCustomer(
      shopDomain,
      email,
      sanitizeOptionalString(firstName),
      sanitizeOptionalString(lastName),
      shopifyId || null,
      !shopifyId, // isTemp = true if no shopifyId
      sanitizeOptionalString(phone)
    );

    console.log('✅ Customer saved/updated successfully:', {
      id: customer._id,
      email: customer.email,
      shopDomain
    });

    const customerToken = generateCustomerToken(customer, shopDomain);

    res.json({
      success: true,
      token: customerToken,
      customer: {
        id: customer._id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        displayName: customer.displayName,
        fullName: customer.fullName,
        shopifyId: customer.shopifyId,
        isTemp: customer.isTemp,
        phone: customer.phone,
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
      const errorEmail = (req.body?.email || error.keyValue?.email || '').toLowerCase().trim();
      const errorShopDomain =
        req.shopDomain ||
        req.body?.shopDomain ||
        req.query?.shop ||
        req.query?.shopDomain ||
        req.query?.store ||
        req.query?.domain;

      if (!errorEmail || !errorShopDomain) {
        console.error('❌ Cannot handle duplicate error: missing email or shopDomain', {
          emailPresent: !!errorEmail,
          shopDomainPresent: !!errorShopDomain
        });
        return next(new AppError('Duplicate customer already exists and cannot be resolved', 409));
      }

      console.log('⚠️ Duplicate customer detected, fetching existing customer:', {
        email: errorEmail,
        shopDomain: errorShopDomain
      });

      try {
        const existingCustomer = await Customer.findOne({
          email: errorEmail,
          shopDomain: errorShopDomain.toLowerCase().trim()
        });

        if (!existingCustomer) {
          console.error('❌ Customer not found despite duplicate key error', {
            email: errorEmail,
            shopDomain: errorShopDomain
          });
          return next(new AppError('Customer with this email already exists in this store', 409));
        }

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
        return res.status(409).json({
          success: false,
          message: 'Customer already exists for this store',
          existingCustomer: {
            id: existingCustomer._id,
            email: existingCustomer.email,
            firstName: existingCustomer.firstName,
            lastName: existingCustomer.lastName,
            displayName: existingCustomer.displayName,
            fullName: existingCustomer.fullName,
            shopifyId: existingCustomer.shopifyId,
            isTemp: existingCustomer.isTemp,
            shopDomain: existingCustomer.shopDomain
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
      displayName,
      phone
    } = req.body;
    const shopDomain = req.shopDomain;

    if (!shopDomain) {
      return next(new AppError('Shop domain is required (middleware)', 400));
    }

    if (!email) {
      return next(new AppError('Missing required customer data: email is required', 400));
    }

    // Ensure customer exists (global + per-store profile)
    const customer = await ensureCustomer(
      shopDomain,
      email,
      sanitizeOptionalString(firstName),
      sanitizeOptionalString(lastName),
      shopifyId || null,
      !shopifyId, // isTemp = true if no shopifyId
      sanitizeOptionalString(phone)
    );

    const customerToken = generateCustomerToken(customer, shopDomain);

    res.json({
      success: true,
      token: customerToken,
      customer: {
        id: customer._id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        displayName: customer.displayName,
        fullName: customer.fullName,
        shopifyId: customer.shopifyId,
        isTemp: customer.isTemp,
        phone: customer.phone,
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
      displayName
    } = req.body;
    const shopDomain = req.shopDomain;

    if (!shopDomain) {
      return next(new AppError('Shop domain is required (middleware)', 400));
    }

    if (!email) {
      return next(new AppError('Email is required', 400));
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

    const customerToken = generateCustomerToken(customer, shopDomain);

    res.json({
      success: true,
      token: customerToken,
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
router.get('/by-email', verifyCustomerToken, async (req, res, next) => {
  try {
    const email = req.query.email;
    const shopDomain = req.shopDomain;

    if (!shopDomain) {
      return next(new AppError('Shop domain is required (middleware)', 400));
    }

    if (!email) {
      return next(new AppError('Email is required', 400));
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (req.customerAuth.email !== normalizedEmail) {
      return res.status(403).json({ success: false, message: 'You can only look up your own customer data' });
    }
    const normalizedShopDomain = shopDomain.toLowerCase().trim();
    
    let customer = await Customer.findOne({ 
      email: normalizedEmail, 
      shopDomain: normalizedShopDomain 
    });

    if (!customer) {
      console.log(`❌ Customer not found for email: ${normalizedEmail} in shop: ${normalizedShopDomain}`);

      console.log('🆕 Creating per-store customer via ensureCustomer for', {
        email: normalizedEmail,
        shopDomain: normalizedShopDomain
      });

      customer = await ensureCustomer(
        normalizedShopDomain,
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
router.get('/:id', verifyCustomerToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const shopDomain = req.shopDomain;

    if (!shopDomain) {
      return next(new AppError('Shop domain is required (middleware)', 400));
    }

    if (req.customerAuth.customerId !== req.params.id) {
      return res.status(403).json({ success: false, message: 'You can only view your own customer data' });
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
    const shopDomain = req.shopDomain;

    if (!shopDomain) {
      return next(new AppError('Shop domain is required (middleware)', 400));
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
router.get('/:id/stats', verifyCustomerToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const shopDomain = req.shopDomain;

    if (!shopDomain) {
      return next(new AppError('Shop domain is required (middleware)', 400));
    }

    if (req.customerAuth.customerId !== req.params.id) {
      return res.status(403).json({ success: false, message: 'You can only view your own customer data' });
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
