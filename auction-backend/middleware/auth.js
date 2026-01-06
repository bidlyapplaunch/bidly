import jwt from 'jsonwebtoken';
import { shopifyApi } from '@shopify/shopify-api';
import User from '../models/User.js';
import { AppError } from './errorHandler.js';

// Shopify session decoder (RS256)
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || process.env.SHOPIFY_CLIENT_ID,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_API_SECRET_KEY || process.env.SHOPIFY_CLIENT_SECRET,
  scopes: [],
  hostName: (process.env.SHOPIFY_APP_URL || 'localhost').replace(/^https?:\/\//, ''),
  apiVersion: '2024-10',
});

const normalizeShopFromToken = (payload) => {
  const destHost = payload?.dest?.replace(/^https?:\/\//, '');
  const sub = payload?.sub?.replace(/^https?:\/\//, '');
  return destHost || sub || null;
};

export const decodeShopifySession = async (token) => {
  if (!token) return null;
  try {
    const payload = await shopify.session.decodeSessionToken(token);
    const shopDomain = normalizeShopFromToken(payload);
    if (!shopDomain) {
      throw new AppError('Invalid Shopify session token: missing shop', 401);
    }
    return { payload, shopDomain };
  } catch (err) {
    // If the token is clearly HS256, ignore it (legacy JWTs are not used for embedded)
    try {
      const header = JSON.parse(Buffer.from(token.split('.')[0] || '', 'base64').toString('utf8'));
      if (header?.alg === 'HS256') {
        console.warn('Ignoring legacy HS256 token for embedded request');
        return null;
      }
    } catch (_e) {
      // ignore parse errors
    }
    throw new AppError('Invalid Shopify session token', 401);
  }
};

// Generate JWT token (legacy, non-embedded)
export const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'fallback-secret', {
    expiresIn: '7d'
  });
};

// Middleware to protect routes (require Shopify session for embedded; HS256 is rejected)
export const requireAuth = async (req, res, next) => {
  try {
    const bearer = req.header('Authorization')?.replace('Bearer ', '');

    // First, try Shopify session token (RS256)
    const shopifySession = await decodeShopifySession(bearer);
    if (shopifySession) {
      req.shopDomain = req.shopDomain || shopifySession.shopDomain;
      req.shopifySession = shopifySession.payload;
      return next();
    }

    const isEmbedded =
      req.query?.embedded === '1' ||
      req.headers['x-shopify-embedded-app'] === '1' ||
      req.headers['x-shopify-app-id'];

    // Embedded flow: require a valid Shopify session token (RS256)
    if (isEmbedded) {
      throw new AppError('Shopify session token required', 401);
    }

    // Legacy JWT (only for non-embedded flows). If missing, deny.
    if (!bearer) {
      throw new AppError('Access denied. No token provided.', 401);
    }

    const decodedLegacy = jwt.verify(bearer, process.env.JWT_SECRET || 'fallback-secret');
    const user = await User.findById(decodedLegacy.userId);
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
