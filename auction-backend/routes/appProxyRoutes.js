import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  getAllAuctions,
  getAuctionById,
  placeBid,
  buyNow,
  getAllAuctionsPage,
  getAuctionDetailsPage
} from '../controllers/auctionController.js';
import {
  validatePlaceBid,
  validateBuyNow,
  validateId
} from '../middleware/validation.js';
import { identifyStore } from '../middleware/storeMiddleware.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * App Proxy Routes for Shopify Theme Integration
 * These routes are accessible via /apps/bidly/* from the storefront
 * They handle CORS and provide a secure way for themes to access auction data
 */

// Serve theme extension assets (NO AUTHENTICATION REQUIRED)
// GET /apps/bidly/assets/bidly-widget.css
router.get('/assets/bidly-widget.css', (req, res) => {
  try {
    const cssPath = path.join(__dirname, '../../extensions/theme-app-extension/assets/bidly-widget.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    
    res.setHeader('Content-Type', 'text/css');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(cssContent);
  } catch (error) {
    console.error('Error serving CSS:', error);
    res.status(404).send('/* CSS file not found */');
  }
});

// GET /apps/bidly/assets/bidly-widget.js
router.get('/assets/bidly-widget.js', (req, res) => {
  try {
    const jsPath = path.join(__dirname, '../../extensions/theme-app-extension/assets/bidly-widget.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(jsContent);
  } catch (error) {
    console.error('Error serving JS:', error);
    res.status(404).send('// JS file not found');
  }
});

// Health check endpoint (NO AUTHENTICATION REQUIRED)
// GET /apps/bidly/health
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Bidly App Proxy is running',
    timestamp: new Date().toISOString()
  });
});

// All other app proxy routes require store identification
router.use(identifyStore);

// Get auction listing page (all auctions) - MUST be first to avoid conflicts
// GET /apps/bidly/api/auctions/list?shop=store.myshopify.com
router.get('/api/auctions/list', getAllAuctionsPage);

// Get all auctions for theme display
// GET /apps/bidly/api/auctions?shop=store.myshopify.com
router.get('/api/auctions', getAllAuctions);

// Get single auction by ID (accepts both MongoDB ObjectId and Shopify Product ID)
// GET /apps/bidly/api/auctions/:id?shop=store.myshopify.com
router.get('/api/auctions/:id', getAuctionById);

// Get auction details page (renders HTML page for individual auction)
// GET /apps/bidly/api/auctions/page/:id?shop=store.myshopify.com
router.get('/api/auctions/page/:id', validateId, getAuctionDetailsPage);

// Place bid on auction
// POST /apps/bidly/api/auctions/:id/bid?shop=store.myshopify.com
router.post('/api/auctions/:id/bid', validateId, validatePlaceBid, placeBid);

// Buy now
// POST /apps/bidly/api/auctions/:id/buy-now?shop=store.myshopify.com
router.post('/api/auctions/:id/buy-now', validateId, validateBuyNow, buyNow);

export default router;
