import { body, param, validationResult } from 'express-validator';

// Validation middleware
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Auction creation validation
export const validateCreateAuction = [
  body('shopifyProductId')
    .notEmpty()
    .withMessage('Shopify Product ID is required')
    .isString()
    .withMessage('Shopify Product ID must be a string')
    .trim(),
  
  body('startTime')
    .notEmpty()
    .withMessage('Start time is required')
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      const startTime = new Date(value);
      const now = new Date();
      const status = req.body.status || 'pending';
      
      // Only require future start time for active auctions
      if (status === 'active' && startTime <= now) {
        throw new Error('Start time must be in the future for active auctions');
      }
      return true;
    }),
  
  body('endTime')
    .notEmpty()
    .withMessage('End time is required')
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      const endTime = new Date(value);
      const startTime = new Date(req.body.startTime);
      if (endTime <= startTime) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),
  
  body('startingBid')
    .notEmpty()
    .withMessage('Starting bid is required')
    .isNumeric()
    .withMessage('Starting bid must be a number')
    .isFloat({ min: 0 })
    .withMessage('Starting bid must be a positive number'),
  
  body('buyNowPrice')
    .optional()
    .isNumeric()
    .withMessage('Buy now price must be a number')
    .isFloat({ min: 0 })
    .withMessage('Buy now price must be a positive number'),
  
  handleValidationErrors
];

// Auction update validation
export const validateUpdateAuction = [
  param('id')
    .isMongoId()
    .withMessage('Invalid auction ID'),
  
  body('shopifyProductId')
    .optional()
    .isString()
    .withMessage('Shopify Product ID must be a string')
    .trim(),
  
  body('startTime')
    .optional()
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  
  body('endTime')
    .optional()
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date'),
  
  body('startingBid')
    .optional()
    .isNumeric()
    .withMessage('Starting bid must be a number')
    .isFloat({ min: 0 })
    .withMessage('Starting bid must be a positive number'),
  
  body('buyNowPrice')
    .optional()
    .custom(value => {
      if (value === null) return true;
      if (typeof value === 'string' && value.trim() === '') {
        return true;
      }
      if (isNaN(value)) {
        throw new Error('Buy now price must be a number');
      }
      if (parseFloat(value) < 0) {
        throw new Error('Buy now price must be a positive number');
      }
      return true;
    }),
  
  body('reservePrice')
    .optional()
    .custom(value => {
      if (value === null) return true;
      if (typeof value === 'string' && value.trim() === '') {
        return true;
      }
      if (isNaN(value)) {
        throw new Error('Reserve price must be a number');
      }
      if (parseFloat(value) < 0) {
        throw new Error('Reserve price must be a positive number');
      }
      return true;
    }),
  
  body('status')
    .optional()
    .isIn(['pending', 'active', 'ended', 'closed', 'reserve_not_met'])
    .withMessage('Status must be either pending, active, ended, closed, or reserve_not_met'),
  
  body('popcornEnabled')
    .optional()
    .isBoolean()
    .withMessage('Popcorn enabled must be a boolean value'),
  
  body('popcornTriggerSeconds')
    .optional()
    .isInt({ min: 1, max: 120 })
    .withMessage('Popcorn trigger seconds must be between 1 and 120'),
  
  body('popcornExtendSeconds')
    .optional()
    .isInt({ min: 5, max: 600 })
    .withMessage('Popcorn extend seconds must be between 5 and 600'),

  body('chatEnabled')
    .optional()
    .isBoolean()
    .withMessage('Chat enabled must be a boolean value'),
  
  handleValidationErrors
];

// Bid placement validation
export const validatePlaceBid = [
  param('id')
    .isMongoId()
    .withMessage('Invalid auction ID'),
  
  body('bidder')
    .optional({ checkFalsy: true })
    .isString()
    .withMessage('Bidder name must be a string')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Bidder name must be 100 characters or less'),

  body('customerId')
    .optional()
    .isMongoId()
    .withMessage('Invalid customer ID'),
  
  body('amount')
    .notEmpty()
    .withMessage('Bid amount is required')
    .isNumeric()
    .withMessage('Bid amount must be a number')
    .isFloat({ min: 0 })
    .withMessage('Bid amount must be a positive number'),
  
  body()
    .custom((_, { req }) => {
      const bidderProvided = typeof req.body.bidder === 'string' && req.body.bidder.trim().length > 0;
      if (!bidderProvided && !req.body.customerId) {
        throw new Error('Bidder name or customerId is required');
      }
      return true;
    }),

  handleValidationErrors
];

// Buy now validation (only needs bidder name)
export const validateBuyNow = [
  param('id')
    .isMongoId()
    .withMessage('Invalid auction ID'),
  
  body('bidder')
    .optional({ checkFalsy: true })
    .isString()
    .withMessage('Bidder name must be a string')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Bidder name must be 100 characters or less'),

  body('customerId')
    .optional()
    .isMongoId()
    .withMessage('Invalid customer ID'),

  body()
    .custom((_, { req }) => {
      const bidderProvided = typeof req.body.bidder === 'string' && req.body.bidder.trim().length > 0;
      if (!bidderProvided && !req.body.customerId) {
        throw new Error('Bidder name or customerId is required');
      }
      return true;
    }),
  
  handleValidationErrors
];

// ID parameter validation (for MongoDB ObjectIds)
export const validateId = [
  param('id')
    .notEmpty()
    .withMessage('Auction ID is required')
    .isMongoId()
    .withMessage('Invalid auction ID format'),
  
  handleValidationErrors
];

// Shopify Product ID validation
export const validateShopifyProductId = [
  param('productId')
    .notEmpty()
    .withMessage('Product ID is required')
    .isString()
    .withMessage('Product ID must be a string')
    .trim(),
  
  handleValidationErrors
];
