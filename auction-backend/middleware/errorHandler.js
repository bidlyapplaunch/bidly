import { t, tSync } from '../services/i18n.js';

// Global error handling middleware
export const errorHandler = async (err, req, res, next) => {
  console.error('Error:', err);

  const shopDomain = req.shopDomain || null;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    
    const message = shopDomain 
      ? await t(shopDomain, 'errors.validation_failed')
      : tSync('errors.validation_failed');
    
    return res.status(400).json({
      success: false,
      message,
      errors
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = shopDomain
      ? await t(shopDomain, 'errors.duplicate_key', { field })
      : tSync('errors.duplicate_key', { field });
    
    return res.status(400).json({
      success: false,
      message,
      field
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    const message = shopDomain
      ? await t(shopDomain, 'errors.invalid_id')
      : tSync('errors.invalid_id');
    
    return res.status(400).json({
      success: false,
      message
    });
  }

  // Custom application errors
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message
    });
  }

  // Default server error
  const message = process.env.NODE_ENV === 'production'
    ? (shopDomain ? await t(shopDomain, 'errors.internal_server_error') : tSync('errors.internal_server_error'))
    : err.message;
  
  res.status(500).json({
    success: false,
    message
  });
};

// 404 handler
export const notFound = async (req, res, next) => {
  const shopDomain = req.shopDomain || null;
  const message = shopDomain
    ? await t(shopDomain, 'errors.not_found')
    : tSync('errors.not_found');
  const error = new Error(`${message} - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Custom error class
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}
