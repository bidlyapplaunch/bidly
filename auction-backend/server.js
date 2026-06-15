// Backend server entry point
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createRequestHandler as createReactRouterRequestHandler } from '@react-router/express';

// ES module equivalent of __dirname (needed for path resolution)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS origin validation for public Shopify app
// Allows any *.myshopify.com store, plus explicit ALLOWED_ORIGINS for admin/custom domains
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

const corsOriginCheck = (origin, callback) => {
  // SEC-20: Allow requests with no Origin header (native mobile apps, curl,
  // server-to-server callers, and Shopify webhooks). We intentionally keep
  // allowing these: a no-Origin request is, by definition, not a browser CORS
  // request (browsers always send Origin for cross-origin fetches/XHR), so the
  // `credentials: true` reflected by the cors() middleware is inert for them —
  // there is no browser to honor Access-Control-Allow-Credentials. Denying
  // no-Origin requests here would break those legitimate non-browser callers
  // (including /webhooks) without adding real protection, so this is left as-is.
  if (!origin) return callback(null, true);
  try {
    const url = new URL(origin);
    // Allow Shopify domains (stores, admin, CDN)
    if (url.hostname.endsWith('.myshopify.com')) return callback(null, true);
    if (url.hostname.endsWith('.shopify.com')) return callback(null, true);
    // Allow the app's own domain (Cloudflare-proxied)
    if (url.hostname.endsWith('.hiiiiiiiiiii.com')) return callback(null, true);
    // Allow explicitly whitelisted origins (admin dashboard, custom domains)
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
  } catch {
    // Invalid URL
  }
  callback(new Error('Not allowed by CORS'));
};

// IMPORTANT:
// Render deployments do not include /build by default (it's .gitignored).
// We load the Remix build dynamically so the backend can still start even if the build isn't present.
const resolveFirstExistingPath = (candidates) => {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const remixServerBuildPath = resolveFirstExistingPath([
  // Relative to auction-backend/server.js (most common case)
  path.resolve(__dirname, '../build/server/index.js'),
  // Fallback: relative to repo root if server.js is in auction-backend/
  path.resolve(process.cwd(), 'build/server/index.js'),
  path.resolve(process.cwd(), '../build/server/index.js'),
  // Fallback: try URL-based resolution (for Windows compatibility)
  fileURLToPath(new URL('../build/server/index.js', import.meta.url)),
]);

let remixBuild;
try {
  if (!remixServerBuildPath) {
    console.error('Remix build path resolution failed. Checked locations:');
    console.error('  -', path.resolve(__dirname, '../build/server/index.js'));
    console.error('  -', path.resolve(process.cwd(), 'build/server/index.js'));
    console.error('  -', path.resolve(process.cwd(), '../build/server/index.js'));
    console.error('  -', fileURLToPath(new URL('../build/server/index.js', import.meta.url)));
    console.error('Current working directory:', process.cwd());
    console.error('Server file location:', __dirname);
    throw new Error('No build/server/index.js found in expected locations');
  }
  remixBuild = await import(remixServerBuildPath);
} catch (e) {
  console.error('Remix build import failed:', e.message);
  console.error('This service must be built during deploy so build/server and build/client exist.');
  console.error('The prestart script should have built it. Check Render build logs.');
  console.error('Server will start but return 503 for Remix routes until build exists.');
  remixBuild = null;
}

// Create the Remix request handler early so we can route embedded /api/* calls to it
const remixRequestHandler = remixBuild
  ? createReactRouterRequestHandler({
      build: remixBuild,
      mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    })
  : null;

import mongoose from 'mongoose';
import connectDB from './config/database.js';
import logger from './utils/logger.js';
import { computeAuctionStatus } from './utils/auctionStatus.js';
import Auction from './models/Auction.js';
import Store from './models/Store.js';
import Customer from './models/Customer.js';
import auctionRoutes from './routes/auctionRoutes.js';
import shopifyRoutes from './routes/shopifyRoutes.js';
import authRoutes from './routes/authRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import oauthRoutes from './routes/oauthRoutes.js';
import appBridgeRoutes from './routes/appBridgeRoutes.js';
import appProxyRoutes from './routes/appProxyRoutes.js';
import debugRoutes from './routes/debugRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import onboardingRoutes from './routes/onboarding.js';
import marketplaceCustomizationRoutes from './routes/marketplaceCustomization.js';
import emailSettingsRoutes from './routes/emailSettings.js';
import blastEmailRoutes from './routes/blastEmailRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import emailService from './services/emailService.js';
import { resumeInterruptedBlasts } from './services/blastEmailService.js';
import identifyStore from './middleware/storeMiddleware.js';

// Load environment variables
dotenv.config({ path: './.env' });

// OPS-05: process-level safety nets. An unhandled rejection or uncaught
// exception leaves the process in an unknown state — log it. We deliberately
// exit on uncaughtException (the process is no longer trustworthy) but only
// log unhandledRejection to avoid taking the whole service down for a single
// stray promise; Render will restart on a hard exit.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason instanceof Error ? reason.stack || reason.message : reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error?.stack || error?.message || error);
  // The process is in an undefined state after an uncaught exception — exit so
  // the orchestrator (Render) restarts a clean instance.
  process.exit(1);
});

// OPS-05: Connect to MongoDB. If the INITIAL connection fails we must NOT serve
// traffic — every request that needs the DB would error in confusing ways and
// the multi-tenant guarantees can't hold without it. Log and exit so Render
// restarts (and surfaces the failure) instead of silently running brokenly.
connectDB()
  .then(async () => {
    await fixCustomerIndexes();
    // Resume any interrupted blast email sends
    resumeInterruptedBlasts().catch(err =>
      logger.error('Failed to resume interrupted blasts:', err)
    );
  })
  .catch(error => {
    logger.error('MongoDB connection failed on startup — refusing to serve traffic:', error.message);
    process.exit(1);
  });

const app = express();

// HTTPS enforcement in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOriginCheck,
    methods: ['GET', 'POST']
  }
});

// Normalize a raw shop value to a canonical lowercase domain (or null).
// Used to derive a socket's tenant for cross-tenant join gating (SEC-18/SEC-17).
const normalizeSocketShop = (raw) => {
  if (!raw) return null;
  const normalized = String(raw)
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase();
  return /^[a-z0-9.-]+$/.test(normalized) ? normalized : null;
};

// Best-effort tenant for a socket from the handshake (query or auth payload).
// This is a FALLBACK only — authenticated customer tokens set socket.shopDomain
// directly. Guests/admin sockets currently send no shop, so this is frequently
// null; the join gates below are written to allow null (preserve live behavior)
// and only reject on a concrete mismatch.
const shopFromHandshake = (socket) => {
  const q = socket.handshake?.query || {};
  const a = socket.handshake?.auth || {};
  return normalizeSocketShop(q.shop || q.shopDomain || a.shopDomain || a.shop);
};

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    // Allow unauthenticated connections (public auction viewers)
    socket.userRole = 'guest';
    socket.userId = null;
    socket.customerId = null;
    socket.shopDomain = shopFromHandshake(socket);
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === 'customer') {
      socket.userRole = 'customer';
      socket.customerId = decoded.customerId;
      socket.customerEmail = decoded.email;
      socket.shopDomain = normalizeSocketShop(decoded.shopDomain) || shopFromHandshake(socket);
    } else {
      // Admin/legacy JWT
      socket.userRole = decoded.role || 'user';
      socket.userId = decoded.userId;
      socket.shopDomain = shopFromHandshake(socket);
    }

    next();
  } catch (error) {
    // Invalid token — allow as guest rather than rejecting
    // (public viewers shouldn't need auth)
    socket.userRole = 'guest';
    socket.userId = null;
    socket.customerId = null;
    socket.shopDomain = shopFromHandshake(socket);
    next();
  }
});

const PORT = process.env.PORT || 5000;
const previewAssetsPath = path.join(__dirname, '../extensions/theme-app-extension/assets');
const remixClientPath = resolveFirstExistingPath([
  path.join(__dirname, '../build/client'),
  path.resolve(process.cwd(), 'build/client'),
  path.resolve(process.cwd(), '../build/client'),
]);

// Helpful for debugging which deploy is serving requests
app.use((req, res, next) => {
  const commit =
    process.env.RENDER_GIT_COMMIT ||
    process.env.GIT_COMMIT ||
    process.env.COMMIT_SHA ||
    '';
  if (commit) {
    res.setHeader('X-App-Commit', commit);
  }
  next();
});

// Always-available diagnostics (must NOT depend on Remix build)
app.get('/diagnostics/remix-assets', (req, res) => {
  const commit =
    process.env.RENDER_GIT_COMMIT ||
    process.env.GIT_COMMIT ||
    process.env.COMMIT_SHA ||
    null;

  const assetsDir = remixClientPath ? path.join(remixClientPath, 'assets') : null;

  const serverCandidates = [
    path.resolve(__dirname, '../build/server/index.js'),
    path.resolve(process.cwd(), 'build/server/index.js'),
    path.resolve(process.cwd(), '../build/server/index.js'),
  ];

  const serverPathChecks = serverCandidates.map((p) => ({ path: p, exists: fs.existsSync(p) }));

  const clientCandidates = [
    path.resolve(__dirname, '../build/client'),
    path.resolve(process.cwd(), 'build/client'),
    path.resolve(process.cwd(), '../build/client'),
  ];

  const clientPathChecks = clientCandidates.map((p) => ({
    path: p,
    exists: fs.existsSync(p),
    hasAssets: fs.existsSync(path.join(p, 'assets')),
  }));

  res.json({
    commit,
    cwd: process.cwd(),
    __dirname,
    remixServerBuildPath,
    hasRemixServerBuild: Boolean(remixServerBuildPath && fs.existsSync(remixServerBuildPath)),
    remixClientPath,
    hasRemixClient: Boolean(remixClientPath && fs.existsSync(remixClientPath)),
    assetsDir,
    hasAssetsDir: Boolean(assetsDir && fs.existsSync(assetsDir)),
    serverPathChecks,
    clientPathChecks,
  });
});

const fixCustomerIndexes = async () => {
  try {
    const indexes = await Customer.collection.indexes();

    const legacyEmailIndex = indexes.find((idx) => idx.name === 'email_1');
    if (legacyEmailIndex) {
      await Customer.collection.dropIndex('email_1');
    }

    await Customer.collection.createIndex(
      { email: 1, shopDomain: 1 },
      { unique: true }
    );
  } catch (err) {
    console.error('Failed to migrate Customer indexes:', err.message);
  }
};

// CORS must be first middleware so identifyStore/routes see headers
app.use(cors({
  origin: corsOriginCheck,
  credentials: true,
  methods: 'GET,POST,PUT,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization,X-Shopify-Shop-Domain,Cache-Control'
}));

// Security middleware - Configured for Shopify embedded apps
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.shopify.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "https://cdn.shopify.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"],
      fontSrc: ["'self'", "https://cdn.shopify.com", "https://fonts.gstatic.com", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https://admin.shopify.com", "https://*.myshopify.com"],
      // Allow form submissions to backend (needed for OAuth flow)
      // Allow all HTTPS form submissions to support OAuth redirects
      formAction: ["'self'", "https:"],
      // Allow iframe embedding from Shopify admin
      // Note: CSP frame-ancestors doesn't support wildcards for myshopify.com subdomains
      // Since Shopify can load apps from various domains, we allow admin.shopify.com
      // X-Frame-Options is disabled (frameguard: false) to allow embedding
      frameAncestors: ["'self'", "https://admin.shopify.com"]
    }
  },
  // Disable X-Frame-Options to allow iframe embedding (we use CSP frame-ancestors instead)
  frameguard: false
}));

// Middleware to allow iframe embedding for Shopify admin
app.use((req, res, next) => {
  // Remove X-Frame-Options header (invalid 'ALLOWALL' value was causing issues)
  // CSP frame-ancestors (set by helmet above) is the modern way to control iframe embedding
  // No need to set X-Frame-Options when using CSP frame-ancestors
  res.removeHeader('X-Frame-Options');
  next();
});

// Logging middleware
app.use(morgan('combined'));

// ============================================
// Webhook endpoint with HMAC validation
// MUST be before express.json() to access raw body
// ============================================
app.post('/webhooks', express.raw({ type: '*/*' }), (req, res) => {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const topic = req.headers['x-shopify-topic'] || 'unknown';
  

  // Get the client secret for HMAC validation
  const clientSecret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_CLIENT_SECRET;
  
  if (!clientSecret) {
    console.error('SHOPIFY_API_SECRET not configured - cannot validate webhook');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!hmacHeader) {
    console.warn('Missing X-Shopify-Hmac-SHA256 header - rejecting webhook');
    return res.status(401).json({ error: 'Missing HMAC signature' });
  }

  // Compute HMAC digest from raw body
  const rawBody = req.body || Buffer.alloc(0);
  const computedHmac = crypto
    .createHmac('sha256', clientSecret)
    .update(rawBody)
    .digest('base64');

  // Timing-safe comparison to prevent timing attacks
  let hmacValid = false;
  try {
    const computedBuffer = Buffer.from(computedHmac, 'base64');
    const headerBuffer = Buffer.from(hmacHeader, 'base64');
    
    // timingSafeEqual requires equal length buffers
    if (computedBuffer.length === headerBuffer.length) {
      hmacValid = crypto.timingSafeEqual(computedBuffer, headerBuffer);
    }
  } catch (e) {
    console.warn('HMAC comparison error:', e.message);
    hmacValid = false;
  }

  if (!hmacValid) {
    console.warn('Invalid HMAC signature - rejecting webhook for topic:', topic);
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }


  // Parse body as JSON for processing (if needed)
  let payload = {};
  try {
    if (rawBody.length > 0) {
      payload = JSON.parse(rawBody.toString('utf8'));
    }
  } catch (e) {
    console.warn('Could not parse webhook body as JSON:', e.message);
  }

  // Handle compliance webhooks (GDPR)
  // These are mandatory but can be acknowledged with 200 OK
  // Actual data handling would go here based on topic
  return res.status(200).json({ success: true });
});

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(identifyStore);

// Health check endpoint (OPS-04). Always returns 200 so it can be used as a
// liveness probe; the DB readiness is surfaced via `db` (mongoose readyState:
// 0=disconnected, 1=connected, 2=connecting, 3=disconnecting).
const healthHandler = (req, res) => {
  const dbState = mongoose.connection.readyState;
  res.status(200).json({
    success: true,
    status: dbState === 1 ? 'ok' : 'degraded',
    db: dbState,
    message: 'Auction API is running',
    timestamp: new Date().toISOString()
  });
};
app.get('/health', healthHandler);
app.get('/healthz', healthHandler);

// Render health check endpoint (for Render's health checks)
app.get('/render-health', (req, res) => {
  res.json({
    success: true,
    message: 'Bidly Auction API Server',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/auctions', auctionRoutes);
app.use('/api/shopify', shopifyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/marketplace-customization', marketplaceCustomizationRoutes);
app.use('/api/email-settings/blasts', blastEmailRoutes);
app.use('/api/email-settings', emailSettingsRoutes);
app.use('/api/chat', chatRoutes);

// Load customer routes synchronously to ensure availability for widget login
try {
  const { default: customerRoutes } = await import('./routes/customerRoutes.js');
  app.use('/api/customers', customerRoutes);
} catch (error) {
  console.error('Failed to load customer routes:', error.message);
  app.use('/api/customers', (req, res) => {
    res.status(500).json({ success: false, message: 'Customer routes not available', error: error.message });
  });
}

// Load customization settings routes synchronously
try {
  const { default: customizationRoutes } = await import('./routes/customizationSettings.js');
  app.use('/api/customization', customizationRoutes);
} catch (error) {
  console.error('Failed to load customization settings routes:', error.message);
  app.use('/api/customization', (req, res) => {
    res.status(500).json({ success: false, message: 'Customization routes not available', error: error.message });
  });
}

// Metafields routes are required for every bid, so load synchronously
try {
  const { default: metafieldsRoutes } = await import('./routes/metafields.js');
  app.use('/api/metafields', metafieldsRoutes);
} catch (error) {
  console.error('Failed to load metafields routes:', error.message);
  app.use('/api/metafields', (req, res) => {
    res.status(500).json({ success: false, message: 'Metafields routes not available', error: error.message });
  });
}

// Load other optional routes asynchronously without blocking server startup
(async () => {
  const routeLoaders = [
    {
      name: 'winner',
      import: () => import('./routes/winnerRoutes.js'),
      mount: (routes) => app.use('/api/winner', routes.default)
    }
    // Removed dead 'product-duplication' loader (SVC-04): the service threw on call
    // (require() in an ESM module) and its winner flow is superseded by
    // winnerProcessingService (Shopify draft order + invoice).
  ];

  // Use Promise.allSettled to load all routes without blocking, even if some fail
  const results = await Promise.allSettled(
    routeLoaders.map(async (loader) => {
      try {
        const module = await loader.import();

        if (!module.default) {
          throw new Error(`Module ${loader.name} does not have a default export`);
        }
        
        loader.mount(module);
        return { name: loader.name, success: true };
      } catch (error) {
        console.error(`❌ Failed to load ${loader.name} routes:`, error);
        console.error(`   Error stack:`, error.stack);
        // Add fallback route
        if (loader.name === 'customer') {
          app.use('/api/customers', (req, res) => {
            res.status(500).json({ success: false, message: 'Customer routes not available' });
          });
        } else if (loader.name === 'winner') {
          app.use('/api/winner', (req, res) => {
            res.status(500).json({ success: false, message: 'Winner routes not available' });
          });
        } else if (loader.name === 'metafields') {
          app.use('/api/metafields', (req, res) => {
            res.status(500).json({ success: false, message: 'Metafields routes not available' });
          });
        }
        return { name: loader.name, success: false, error: error.message };
      }
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.success)).length;
  if (failed > 0) {
    results.forEach((result, index) => {
      if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value?.success)) {
        console.error(`Failed to load ${routeLoaders[index].name} routes:`, result.reason || result.value?.error);
      }
    });
  }
})();

app.get('/preview/widget-assets/:asset', (req, res) => {
  try {
    const assetName = req.params.asset || '';
    if (assetName.includes('..')) {
      return res.status(400).send('Invalid asset name');
    }

    const assetPath = path.join(previewAssetsPath, assetName);
    if (!fs.existsSync(assetPath)) {
      return res.status(404).send('Asset not found');
    }

    // Set correct MIME type based on file extension
    const ext = path.extname(assetName).toLowerCase();
    const mimeTypes = {
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    
    return res.sendFile(assetPath);
  } catch (error) {
    console.error('Failed to serve preview asset:', error);
    return res.status(500).send('Failed to load preview asset');
  }
});

app.get('/preview/widget', (req, res) => {
  const shop = (req.query.shop || '').toString();
  const stateParam = (req.query.state || '').toString();
  const allowedStates = ['pending', 'active', 'ended'];
  const state = allowedStates.includes(stateParam) ? stateParam : 'active';
  const version = Date.now().toString();

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bidly Widget Preview</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="/preview/widget-assets/auction-app-embed.css?v=${version}" />
    <style>
      body {
        margin: 0;
        padding: 24px;
        background: #f4f6f8;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
    </style>
    <script>
      window.__BIDLY_PREVIEW__ = {
        preview: true,
        shopDomain: ${JSON.stringify(shop || null)},
        state: ${JSON.stringify(state)}
      };
      (function() {
        const data = window.__BIDLY_PREVIEW__;
        if (!window.Shopify) {
          window.Shopify = { shop: { permanent_domain: data.shopDomain || 'preview-shop.myshopify.com' } };
        }
        if (!window.Shopify.shop) {
          window.Shopify.shop = { permanent_domain: data.shopDomain || 'preview-shop.myshopify.com' };
        }
        if (!window.BidlyHybridLogin) {
          window.BidlyHybridLogin = {
            getCurrentCustomer: () => ({ fullName: 'Preview User', isTemp: false }),
            isUserLoggedIn: () => true,
            openGuestLogin: () => {},
            logout: () => {}
          };
        }
        if (!window.location.pathname.includes('/products/')) {
          const newPath = '/products/bidly-preview';
          const query = window.location.search || '';
          history.replaceState({}, '', newPath + query);
        }
      })();
    </script>
  </head>
  <body>
    <div class="bidly-product-widget bidly-auction-app-embed" data-bidly-widget-root data-preview="1"></div>
    <script src="/preview/widget-assets/backendConfig.js?v=${version}"></script>
    <script src="/preview/widget-assets/auction-app-embed.js?v=${version}" defer></script>
    <script>
      (function() {
        // For embedded Shopify apps, parent is always admin.shopify.com
        // Use '*' as fallback for non-Shopify contexts
        function getTargetOrigin() {
          // If we're in an iframe (embedded app), parent is Shopify admin
          if (window.self !== window.top) {
            return 'https://admin.shopify.com';
          }
          // Fallback to wildcard for non-embedded contexts
          return '*';
        }

        function reportHeight() {
          try {
            var height = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
            if (window.parent && height) {
              var targetOrigin = getTargetOrigin();
              window.parent.postMessage({ type: 'BIDLY_PREVIEW_HEIGHT', height: height }, targetOrigin);
            }
          } catch (error) {
            // Silently fail - this is just for preview height reporting
            // Don't log errors to avoid console spam
          }
        }

        window.addEventListener('load', function() {
          reportHeight();
          setTimeout(reportHeight, 500);
          setTimeout(reportHeight, 1500);
        });

        window.addEventListener('resize', reportHeight);

        var observer = new MutationObserver(function() {
          reportHeight();
        });

        observer.observe(document.body, {
          attributes: true,
          childList: true,
          subtree: true
        });
      })();
    </script>
  </body>
</html>`;

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
});

// Add diagnostic endpoint to check route loading status
app.get('/api/debug/routes', (req, res) => {
  res.json({
    success: true,
    message: 'Route diagnostic endpoint',
    routes: {
      customization: 'Check /api/customization',
      customer: 'Check /api/customers',
      winner: 'Check /api/winner',
      metafields: 'Check /api/metafields',
      'product-duplication': 'Check /api/product-duplication'
    }
  });
});

// OAuth routes for Shopify app installation
app.use('/auth/shopify', oauthRoutes);
app.use('/webhooks/shopify', oauthRoutes);
app.use('/webhooks/app', oauthRoutes);

// Note: /webhooks endpoint with HMAC validation is defined earlier (before JSON body parser)

// App Bridge routes for embedded app functionality
app.use('/app-bridge', appBridgeRoutes);

// App Proxy routes for theme integration
app.use('/apps/bidly', appProxyRoutes);

// Debug routes — only mounted outside production. These expose per-store access-token
// previews/scopes, force-uninstall (DELETE /clear-store/:shop) and plan overrides, so they
// must never be reachable in a production deployment. (SVC-02)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', debugRoutes);
} else {
  console.log('ℹ️ Debug routes are disabled in production');
}

// Serve static files from the legacy admin build at the root
const frontendDistPath = path.join(__dirname, '../auction-admin/dist');
// Add cache-busting version header for troubleshooting
const FRONTEND_VERSION = Date.now() + Math.random();

// Serve legacy admin assets under /assets (content-hashed from Vite build)
const adminAssetsDir = path.join(frontendDistPath, 'assets');
if (fs.existsSync(adminAssetsDir)) {
  app.use(
    '/assets',
    express.static(adminAssetsDir, {
      fallthrough: true,
      setHeaders(res) {
        // Assets are content-hashed; safe to cache long-term
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );

  // Case-insensitive fallback for asset filenames
  app.get('/assets/*', (req, res, next) => {
    try {
      const requested = req.path.replace(/^\/assets\//, '');
      const safeName = path.basename(requested);
      if (!safeName || safeName !== requested) {
        return res.status(400).send('Bad asset path');
      }

      const directPath = path.join(adminAssetsDir, safeName);
      if (fs.existsSync(directPath)) {
        return res.sendFile(directPath);
      }

      const files = fs.readdirSync(adminAssetsDir);
      const match = files.find((f) => f.toLowerCase() === safeName.toLowerCase());
      if (match) {
        return res.sendFile(path.join(adminAssetsDir, match));
      }

      return next();
    } catch (_e) {
      return next();
    }
  });

  // Serve other static files in dist (e.g., vite.svg)
  app.use(express.static(frontendDistPath));
} else {
  console.warn('Legacy admin assets directory not found at:', adminAssetsDir);
}

// Diagnostics for troubleshooting asset 404s
app.get('/_diag/remix', (req, res) => {
  const assetsDir = remixClientPath ? path.join(remixClientPath, 'assets') : null;
  let assetsSample = [];
  try {
    if (assetsDir && fs.existsSync(assetsDir)) {
      assetsSample = fs.readdirSync(assetsDir).slice(0, 20);
    }
  } catch (_e) {
    assetsSample = [];
  }

  return res.json({
    commit:
      process.env.RENDER_GIT_COMMIT ||
      process.env.GIT_COMMIT ||
      process.env.COMMIT_SHA ||
      null,
    remixClientPath,
    remixServerBuildPath,
    hasRemixServerBuild: Boolean(remixServerBuildPath && fs.existsSync(remixServerBuildPath)),
    hasRemixClient: Boolean(remixClientPath && fs.existsSync(remixClientPath)),
    hasAssetsDir: Boolean(assetsDir && fs.existsSync(assetsDir)),
    assetsSample,
    cwd: process.cwd(),
  });
});

app.use((req, res, next) => {
  // Only apply static middleware for non-API-like paths
  const pathIsApiLike =
    req.path.startsWith('/api/') ||
    req.path.startsWith('/auth/') ||
    req.path.startsWith('/app-bridge/') ||
    req.path.startsWith('/apps/') ||
    req.path.startsWith('/assets/') ||
    req.path.startsWith('/diagnostics/') ||
    req.path.startsWith('/_diag/');

  if (pathIsApiLike) {
    return next();
  }

  // Add cache-busting headers for legacy static files
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Frontend-Version', FRONTEND_VERSION.toString());

  return express.static(frontendDistPath)(req, res, next);
});

// Shopify embedded app entry point - serve the legacy admin index.html
const serveLegacyAdmin = (req, res, next) => {
  // Skip if request is clearly for API or other services
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/auth/') ||
    req.path.startsWith('/app-bridge/') ||
    req.path.startsWith('/apps/') ||
    req.path.startsWith('/assets/') ||
    req.path.startsWith('/diagnostics/') ||
    req.path.startsWith('/_diag/')
  ) {
    return next();
  }

  const { shop, embedded, hmac, host, id_token, session } = req.query;

  const indexPath = path.join(frontendDistPath, 'index.html');

  if (fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(indexPath);
  }

  console.error('Legacy admin index.html not found at:', indexPath);
  return res.status(503).json({
    success: false,
    message: 'Legacy admin frontend not built. Please check build logs.',
    path: indexPath
  });
};

// Handle /bidly path - always serve admin app for embedded requests
// Shopify admin loads at /apps/bidly, which requests backend at /bidly or /
// App proxy routes are handled separately at /apps/bidly
app.all('/bidly', (req, res, next) => {
  const { embedded, host, hmac, shop } = req.query;
  const referer = req.get('referer') || '';
  
  // Always serve admin app for /bidly - this is the embedded app entry point
  // Storefront requests go to /apps/bidly (app proxy) which is handled separately
  return serveLegacyAdmin(req, res, next);
});

// SPA fallback for legacy admin (root)
app.get('*', serveLegacyAdmin);

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

// WebSocket connection handling
io.on('connection', (socket) => {
  
  // Store user info if authenticated
  socket.userId = null;
  socket.userRole = null;
  
  // Join auction room for real-time updates
  socket.on('join-auction', async (auctionId) => {
    // SEC-18: prevent cross-tenant subscription. If this socket has a known
    // tenant (shopDomain), the auction it subscribes to must belong to that
    // same shop. We do NOT change the room naming scheme (bid broadcasts in
    // another file target `auction-${id}`) — we only gate the join.
    //
    // Guests/admin sockets frequently have no shopDomain (the storefront and
    // admin clients don't send one on the handshake today). Rejecting those
    // would break the live storefront, so when socket.shopDomain is absent we
    // allow the join (preserving current behavior) and only reject on a
    // concrete shop mismatch.
    if (socket.shopDomain) {
      try {
        const auction = await Auction.findById(auctionId).select('shopDomain').lean();
        if (auction && auction.shopDomain && auction.shopDomain !== socket.shopDomain) {
          socket.emit('auction-status', {
            auctionId,
            error: 'forbidden',
            message: 'Auction does not belong to this store'
          });
          return;
        }
      } catch (err) {
        // CastError on a malformed id, or a transient DB error. Be conservative:
        // do not subscribe to a room we couldn't validate.
        socket.emit('auction-status', {
          auctionId,
          error: 'invalid',
          message: 'Could not validate auction'
        });
        return;
      }
    }

    socket.join(`auction-${auctionId}`);

    // Send current auction status to the newly joined client
    socket.emit('auction-status', {
      auctionId,
      message: 'Connected to auction updates'
    });
  });
  
  // Leave auction room
  socket.on('leave-auction', (auctionId) => {
    socket.leave(`auction-${auctionId}`);
  });
  
  // Join admin room for admin notifications
  socket.on('join-admin', () => {
    // Role was verified server-side during connection via JWT
    if (socket.userRole === 'admin') {
      socket.join('admin-room');
      socket.emit('admin-joined', { success: true });
    } else {
      socket.emit('admin-joined', { success: false, message: 'Admin authentication required' });
    }
  });
  
  // Leave admin room
  socket.on('leave-admin', () => {
    socket.leave('admin-room');
    socket.userRole = null;
  });
  
  // Set user authentication info
  socket.on('authenticate', (data) => {
    // Token already validated in connection middleware
    // This event is kept for backward compatibility but does nothing
    // Authentication happens via handshake.auth.token
    socket.emit('authenticated', { role: socket.userRole });
  });
  
  // Handle ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });
  
  // ===== CHAT FUNCTIONALITY =====
  const normalizeProductId = (value) => {
    if (!value) return null;
    const stringValue = value.toString().trim();
    if (!stringValue) return null;

    const match = stringValue.match(/Product\/(\d+)/i);
    if (match && match[1]) {
      return match[1];
    }

    if (/^\d+$/.test(stringValue)) {
      return stringValue;
    }

    return null;
  };

  // SEC-17: resolve the owning shop for a product (via its auction record) so
  // chat can be gated to the socket's tenant. We keep the room key as
  // `chat-${productId}` (other code emits to that key — changing it desyncs),
  // and only refuse to join/broadcast on a concrete cross-tenant mismatch.
  //
  // Returns:
  //   true  -> ok to proceed (no concrete mismatch found)
  //   false -> a known mismatch (different shop) — caller should reject
  // Sockets without a shopDomain (guests/admin that send no shop) always pass,
  // preserving the live storefront chat behavior.
  const chatShopCache = new Map(); // productId -> shopDomain (or null if unknown)
  const isChatProductAllowedForSocket = async (productId) => {
    if (!socket.shopDomain) return true; // no tenant known — don't break guests
    let auctionShop = chatShopCache.get(productId);
    if (auctionShop === undefined) {
      try {
        const auction = await Auction.findOne({ shopifyProductId: productId })
          .select('shopDomain')
          .lean();
        auctionShop = auction?.shopDomain || null;
      } catch {
        auctionShop = null; // transient/cast error — treat as unknown, allow
      }
      chatShopCache.set(productId, auctionShop);
    }
    // Unknown owner (no auction found) -> allow; known + mismatch -> reject.
    if (auctionShop && auctionShop !== socket.shopDomain) return false;
    return true;
  };

  // Join product chat room
  socket.on('join-chat-room', async (_id) => {
    const productId = normalizeProductId(_id);
    if (!productId) {
      socket.emit('chat-error', { message: 'Invalid product ID for chat room' });
      return;
    }

    if (!(await isChatProductAllowedForSocket(productId))) {
      socket.emit('chat-error', { message: 'Chat does not belong to this store' });
      return;
    }

    socket.join(`chat-${productId}`);

    // Send existing messages for this room (ensure all have id for future deletion)
    const messages = (chatRooms.get(productId) || []).map((msg) => {
      if (!msg.id) {
        msg.id = `chat-${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      }
      return msg;
    });
    socket.emit('chat-history', { productId, messages });
  });
  
  // Leave product chat room
  socket.on('leave-chat-room', (productId) => {
    socket.leave(`chat-${productId}`);
  });
  
  // Handle new chat message
  socket.on('new-chat-message', async ({ productId: incomingId, username, message }) => {
    const productId = normalizeProductId(incomingId);
    if (!productId || !username || !message) {
      socket.emit('chat-error', { message: 'Missing required fields' });
      return;
    }

    // SEC-17: don't accept/broadcast a message into a room owned by a different shop.
    if (!(await isChatProductAllowedForSocket(productId))) {
      socket.emit('chat-error', { message: 'Chat does not belong to this store' });
      return;
    }

    // Initialize room if it doesn't exist
    if (!chatRooms.has(productId)) {
      // Evict the oldest-inserted room when at capacity (Map preserves insertion order).
      if (chatRooms.size >= MAX_CHAT_ROOMS) {
        const oldestKey = chatRooms.keys().next().value;
        if (oldestKey !== undefined) chatRooms.delete(oldestKey);
      }
      chatRooms.set(productId, []);
    }
    
    // Add message to room (keep last MAX_CHAT_MESSAGES_PER_ROOM messages per room)
    const messages = chatRooms.get(productId);
    const newMessage = {
      id: `chat-${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      username,
      message: message.trim(),
      timestamp: new Date().toISOString()
    };
    
    messages.push(newMessage);
    
    // Keep only last N messages per room
    if (messages.length > MAX_CHAT_MESSAGES_PER_ROOM) {
      messages.shift();
    }
    
    // Broadcast to all clients in this product's chat room
    io.to(`chat-${productId}`).emit('chat-message', newMessage);
    
  });
  
  socket.on('disconnect', () => {
  });
  
  // Send connection confirmation
  socket.emit('connected', {
    message: 'Connected to auction system',
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });
});

// ===== CHAT FUNCTIONALITY =====
// In-memory store for chat messages (per product room) - shared across all connections
const chatRooms = new Map(); // productId -> [{ id, username, message, timestamp }]
const MAX_CHAT_MESSAGES_PER_ROOM = 100;
// Hard cap on the number of rooms so a store browsing many products can't grow the map
// without bound between the hourly idle-cleanup passes. (BACKEND-21)
const MAX_CHAT_ROOMS = 1000;

// Clean up expired chat rooms every hour
setInterval(() => {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  for (const [productId, messages] of chatRooms.entries()) {
    if (messages.length === 0) {
      chatRooms.delete(productId);
      continue;
    }
    const lastMessage = messages[messages.length - 1];
    if (now - new Date(lastMessage.timestamp).getTime() > ONE_DAY_MS) {
      chatRooms.delete(productId);
    }
  }
}, 60 * 60 * 1000); // Run every hour

// Make io and chatRooms available to other modules (e.g. chat routes)
app.set('io', io);
app.set('chatRooms', chatRooms);

// Global function to broadcast auction status updates
global.broadcastAuctionStatusUpdate = (auctionId, newStatus, auctionData) => {
  if (io) {
    const statusUpdateData = {
      auctionId,
      newStatus,
      auctionData,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast to specific auction room
    io.to(`auction-${auctionId}`).emit('auction-status-update', statusUpdateData);

    // Mirror to admin dashboards only (BACKEND-06: was a global io.emit to every
    // connected socket across all stores)
    io.to('admin-room').emit('auction-status-update', statusUpdateData);
    
  }
};

// computeAuctionStatus is imported from utils/auctionStatus.js (BACKEND-13) — the local
// copy here previously did not preserve reserve_not_met, so a reserve_not_met auction was
// incorrectly reclassified as 'ended' by the poller.

// Function to check and broadcast auction status changes
const checkAuctionStatusChanges = async () => {
  try {
    const auctions = await Auction.find({ status: { $in: ['pending', 'active'] } });
    
    for (const auction of auctions) {
      const computedStatus = computeAuctionStatus(auction);
      
      // If the computed status differs from the stored status, broadcast the change
      if (computedStatus !== auction.status) {
        
        // Update the auction status in the database
        auction.status = computedStatus;
        // Note: we intentionally do NOT overwrite endTime here — it holds the
        // scheduled end time and is used for "ended at" display and history.
        await auction.save();
        
        // Send email notifications if auction ended
        if (computedStatus === 'ended' && auction.bidHistory.length > 0) {
          try {
            // Determine the winning bid the same way winnerProcessingService does:
            // highest amount, earliest timestamp on a tie. Do NOT assume the last
            // appended bid is the winner.
            const winningBid = [...auction.bidHistory].sort((a, b) => {
              if (b.amount !== a.amount) return b.amount - a.amount;
              return new Date(a.timestamp) - new Date(b.timestamp);
            })[0];
            const store = await Store.findByDomain(auction.shopDomain);
            const brandOptions = {
              plan: store?.plan,
              storeName: store?.storeName
            };

            // NOTE: the winner "you won" email is sent by winnerProcessingService
            // (sendWinnerNotification) after the draft order is created, so it is
            // intentionally NOT sent here — otherwise the winner gets two emails.

            // Send outbid notification to each unique losing bidder (deduped + batched,
            // so a bidder who bid multiple times only gets one email and slow SMTP
            // round-trips don't serialize inside the 5s polling tick).
            const loserEmails = new Map();
            for (const bid of auction.bidHistory) {
              if (bid.customerEmail && bid.bidder !== winningBid.bidder && !loserEmails.has(bid.customerEmail)) {
                loserEmails.set(bid.customerEmail, bid.bidder);
              }
            }
            await Promise.allSettled(
              [...loserEmails].map(([email, bidder]) =>
                emailService.sendOutbidNotification(
                  auction.shopDomain,
                  email,
                  bidder,
                  auction,
                  winningBid.amount,
                  brandOptions
                )
              )
            );

            // Send admin notification
            await emailService.sendAdminNotification(
              auction.shopDomain,
              'Auction Ended',
              `Auction "${auction.productData?.title || 'Unknown Product'}" ended. Winner: ${winningBid.bidder} with $${winningBid.amount}`,
              auction
            );

          } catch (emailError) {
            console.error(`⚠️ Auction end email notification error for auction ${auction._id}:`, emailError);
            // Don't fail the status update if email fails
          }
        }
        
        // Process ended auctions (duplicate product, create draft order, notify winner)
        if (computedStatus === 'ended') {
          try {
            // Use the new winner processing service
            const { default: winnerProcessingService } = await import('./services/winnerProcessingService.js');
            await winnerProcessingService.processAuctionWinner(auction._id, auction.shopDomain);
          } catch (processingError) {
            console.error(`❌ Error processing ended auction ${auction._id}:`, processingError);
            console.error(`❌ Error stack:`, processingError.stack);
            // Don't fail the status update if processing fails
          }
        }
        
        // Broadcast the status change
        global.broadcastAuctionStatusUpdate(auction._id, computedStatus, {
          _id: auction._id,
          shopifyProductId: auction.shopifyProductId,
          productData: auction.productData,
          status: computedStatus,
          currentBid: auction.currentBid,
          startTime: auction.startTime,
          endTime: auction.endTime
        });
      }
    }
  } catch (error) {
    console.error('Error checking auction status changes:', error);
  }
};

// Check for status changes every 5 seconds for faster response
setInterval(checkAuctionStatusChanges, 5000);

// Start server first
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Bidly auction backend listening on port ${PORT}`);

  // Start scheduled jobs after server is running
  setTimeout(async () => {
    try {
      const { default: scheduledJobsService } = await import('./services/scheduledJobsService.js');
      scheduledJobsService.start();
      logger.info('Scheduled jobs started');
    } catch (error) {
      logger.error('Failed to start scheduled jobs:', error.message);
    }
  }, 2000); // Wait 2 seconds after server starts
});

export default app;
