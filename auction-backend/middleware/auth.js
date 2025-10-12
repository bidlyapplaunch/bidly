import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from './errorHandler.js';

// Generate JWT token
export const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'fallback-secret', {
    expiresIn: '7d'
  });
};

// Verify JWT token
export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
};

// Middleware to protect routes (require authentication)
export const requireAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new AppError('Access denied. No token provided.', 401);
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      throw new AppError('Invalid token or user not found.', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AppError('Invalid token.', 401));
    } else if (error.name === 'TokenExpiredError') {
      next(new AppError('Token expired.', 401));
    } else {
      next(error);
    }
  }
};

// Middleware to require admin role
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError('Access denied. Admin role required.', 403));
  }
  next();
};

// Middleware to require customer role
export const requireCustomer = (req, res, next) => {
  if (req.user.role !== 'customer') {
    return next(new AppError('Access denied. Customer role required.', 403));
  }
  next();
};

// Optional auth middleware (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId);
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
};
