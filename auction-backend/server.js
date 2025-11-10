import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import connectDB from './config/database.js';
import Auction from './models/Auction.js';
import Store from './models/Store.js';
import auctionRoutes from './routes/auctionRoutes.js';
import shopifyRoutes from './routes/shopifyRoutes.js';
import authRoutes from './routes/authRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import oauthRoutes from './routes/oauthRoutes.js';
import appBridgeRoutes from './routes/appBridgeRoutes.js';
import appProxyRoutes from './routes/appProxyRoutes.js';
import debugRoutes from './routes/debugRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import emailService from './services/emailService.js';

// Load environment variables
dotenv.config({ path: './.env' });
console.log('🔍 Environment check:');
console.log('  - EMAIL_USER:', process.env.EMAIL_USER ? 'Present' : 'Missing');
console.log('  - EMAIL_PASS:', process.env.EMAIL_PASS ? 'Present' : 'Missing');

// Connect to MongoDB (non-blocking)
connectDB().catch(error => {
  console.error('⚠️ MongoDB connection failed:', error.message);
  console.log('⚠️ Server will continue without database connection');
});

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: true, // Allow all origins for ngrok development
    methods: ['GET', 'POST']
  }
});
const PORT = process.env.PORT || 5000;
const previewAssetsPath = path.join(__dirname, '../extensions/theme-app-extension/assets');

// Security middleware - Configured for Shopify embedded apps
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.shopify.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.shopify.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"],
      fontSrc: ["'self'", "https://cdn.shopify.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https://admin.shopify.com", "https://*.myshopify.com"],
      // Allow iframe embedding from Shopify admin
      frameAncestors: ["'self'", "https://admin.shopify.com", "https://*.myshopify.com"]
    }
  },
  // Disable X-Frame-Options to allow iframe embedding
  frameguard: false
}));

// CORS configuration - Allow requests from both backends and Shopify admin
app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:3002',
    'https://bidly-auction-admin.onrender.com',
    'https://bidly-auction-customer.onrender.com',
    'https://bidly-auction-backend.onrender.com',
    'https://bidly-auction-backend-2.onrender.com',
    'https://admin.shopify.com',
    'https://*.myshopify.com',
    'https://bidly-2.myshopify.com',
    'https://6sb15z-k1.myshopify.com',
    'https://true-nordic.com',
    'https://www.true-nordic.com'
  ],
  credentials: true,
  // Development headers for iframe compatibility
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'X-Shopify-Shop-Domain',
    'ngrok-skip-browser-warning'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Middleware to allow iframe embedding for Shopify admin
app.use((req, res, next) => {
  // Allow iframe embedding from Shopify admin domains
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://admin.shopify.com https://*.myshopify.com");
  next();
});

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auction API is running',
    timestamp: new Date().toISOString()
  });
});

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

// Load customer routes synchronously to ensure availability for widget login
try {
  const { default: customerRoutes } = await import('./routes/customerRoutes.js');
  app.use('/api/customers', customerRoutes);
  console.log('✅ Customer routes loaded synchronously');
} catch (error) {
  console.error('❌ Failed to load customer routes:', error.message);
  app.use('/api/customers', (req, res) => {
    res.status(500).json({ success: false, message: 'Customer routes not available', error: error.message });
  });
}

// Load customization settings routes synchronously
try {
  const { default: customizationRoutes } = await import('./routes/customizationSettings.js');
  app.use('/api/customization', customizationRoutes);
  console.log('✅ Customization settings routes loaded synchronously');
} catch (error) {
  console.error('❌ Failed to load customization settings routes:', error.message);
  app.use('/api/customization', (req, res) => {
    res.status(500).json({ success: false, message: 'Customization routes not available', error: error.message });
  });
}

// Load other optional routes asynchronously without blocking server startup
(async () => {
  const routeLoaders = [
    {
      name: 'winner',
      import: () => import('./routes/winnerRoutes.js'),
      mount: (routes) => app.use('/api/winner', routes.default)
    },
    {
      name: 'metafields',
      import: () => import('./routes/metafields.js'),
      mount: (routes) => app.use('/api/metafields', routes.default)
    },
    {
      name: 'product-duplication',
      import: () => import('./routes/productDuplication.js'),
      mount: (routes) => app.use('/api/product-duplication', routes.default)
    }
  ];

  // Use Promise.allSettled to load all routes without blocking, even if some fail
  const results = await Promise.allSettled(
    routeLoaders.map(async (loader) => {
      try {
        console.log(`🔄 Loading ${loader.name} routes...`);
        const module = await loader.import();
        console.log(`📦 ${loader.name} module imported:`, {
          hasDefault: !!module.default,
          keys: Object.keys(module)
        });
        
        if (!module.default) {
          throw new Error(`Module ${loader.name} does not have a default export`);
        }
        
        loader.mount(module);
        console.log(`✅ ${loader.name} routes loaded and mounted`);
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
        } else if (loader.name === 'product-duplication') {
          app.use('/api/product-duplication', (req, res) => {
            res.status(500).json({ success: false, message: 'Product duplication routes not available' });
          });
        }
        return { name: loader.name, success: false, error: error.message };
      }
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.success)).length;
  console.log(`📦 Routes loaded: ${successful} successful, ${failed} failed`);
  
  // Log detailed results for debugging
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value?.success) {
        console.log(`  ✅ ${routeLoaders[index].name}: Success`);
      } else {
        console.log(`  ❌ ${routeLoaders[index].name}: Failed - ${result.value?.error}`);
      }
    } else {
      console.log(`  ❌ ${routeLoaders[index].name}: Rejected - ${result.reason}`);
    }
  });
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

    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(assetPath);
  } catch (error) {
    console.error('❌ Failed to serve preview asset:', error);
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
        function reportHeight() {
          try {
            var height = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
            if (window.parent && height) {
              window.parent.postMessage({ type: 'BIDLY_PREVIEW_HEIGHT', height: height }, '*');
            }
          } catch (error) {
            console.warn('Bidly preview height reporting failed:', error);
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

// App Bridge routes for embedded app functionality
app.use('/app-bridge', appBridgeRoutes);

// App Proxy routes for theme integration
app.use('/apps/bidly', appProxyRoutes);

// Debug routes (development only)
app.use('/api/debug', debugRoutes);

// Serve static files from the admin frontend build (after API routes)
const frontendDistPath = path.join(__dirname, '../auction-admin/dist');
console.log('📁 Serving admin frontend from:', frontendDistPath);

// Add cache-busting version
const FRONTEND_VERSION = Date.now() + Math.random();
console.log('🔄 Frontend version (cache-busting):', FRONTEND_VERSION);

// Only serve static files for non-API routes
app.use((req, res, next) => {
  // Skip static file serving for API routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/app-bridge/') || req.path.startsWith('/auth/')) {
    return next();
  }
  
  // Add cache-busting headers for all static files
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Frontend-Version', FRONTEND_VERSION.toString());
  
  console.log('📁 Serving static file:', req.path, 'from admin frontend');
  express.static(frontendDistPath)(req, res, next);
});

// Shopify embedded app entry point - serve the frontend
const serveAdminIndex = (req, res) => {
  const { shop, embedded, hmac, host, id_token, session } = req.query;
  
  console.log('🏪 Shopify embedded app access:', {
    shop,
    embedded,
    hasHmac: !!hmac,
    hasHost: !!host,
    hasIdToken: !!id_token,
    hasSession: !!session,
    referer: req.get('referer'),
    origin: req.get('origin'),
    userAgent: req.get('user-agent')
  });
  
  // Serve the admin frontend index.html with all parameters preserved
  const indexPath = path.join(frontendDistPath, 'index.html');
  console.log('📄 Serving ADMIN index.html from:', indexPath);
  
  // Check if file exists before sending
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error('❌ Admin frontend index.html not found at:', indexPath);
    res.status(503).json({
      success: false,
      message: 'Admin frontend not built. Please check build logs.',
      path: indexPath
    });
  }
};

app.get('/', serveAdminIndex);
app.get('/plans', serveAdminIndex);
app.get('/customization/widget', serveAdminIndex);
app.get('/customization/marketplace', serveAdminIndex);
app.get('/analytics', serveAdminIndex);
app.get('/auctions', serveAdminIndex);
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || req.path.startsWith('/app-bridge/') || req.path.startsWith('/apps/')) {
    return next();
  }

  if (req.method === 'GET' && req.accepts('html')) {
    return serveAdminIndex(req, res);
  }

  return next();
});


// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Store user info if authenticated
  socket.userId = null;
  socket.userRole = null;
  
  // Join auction room for real-time updates
  socket.on('join-auction', (auctionId) => {
    socket.join(`auction-${auctionId}`);
    console.log(`👥 Client ${socket.id} joined auction ${auctionId}`);
    
    // Send current auction status to the newly joined client
    socket.emit('auction-status', {
      auctionId,
      message: 'Connected to auction updates'
    });
  });
  
  // Leave auction room
  socket.on('leave-auction', (auctionId) => {
    socket.leave(`auction-${auctionId}`);
    console.log(`👋 Client ${socket.id} left auction ${auctionId}`);
  });
  
  // Join admin room for admin notifications
  socket.on('join-admin', (userRole) => {
    if (userRole === 'admin') {
      socket.join('admin-room');
      socket.userRole = 'admin';
      console.log(`👑 Admin client ${socket.id} joined admin room`);
    }
  });
  
  // Leave admin room
  socket.on('leave-admin', () => {
    socket.leave('admin-room');
    socket.userRole = null;
    console.log(`👋 Client ${socket.id} left admin room`);
  });
  
  // Set user authentication info
  socket.on('authenticate', (userData) => {
    socket.userId = userData.userId;
    socket.userRole = userData.role;
    console.log(`🔐 Client ${socket.id} authenticated as ${userData.role}: ${userData.userId}`);
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

  // Join product chat room
  socket.on('join-chat-room', (_id) => {
    const productId = normalizeProductId(_id);
    if (!productId) {
      socket.emit('chat-error', { message: 'Invalid product ID for chat room' });
      return;
    }

    socket.join(`chat-${productId}`);
    console.log(`💬 Client ${socket.id} joined chat room for product ${productId}`);
    
    // Send existing messages for this room
    const messages = chatRooms.get(productId) || [];
    socket.emit('chat-history', { productId, messages });
  });
  
  // Leave product chat room
  socket.on('leave-chat-room', (productId) => {
    socket.leave(`chat-${productId}`);
    console.log(`👋 Client ${socket.id} left chat room for product ${productId}`);
  });
  
  // Handle new chat message
  socket.on('new-chat-message', ({ productId: incomingId, username, message }) => {
    const productId = normalizeProductId(incomingId);
    if (!productId || !username || !message) {
      socket.emit('chat-error', { message: 'Missing required fields' });
      return;
    }
    
    // Initialize room if it doesn't exist
    if (!chatRooms.has(productId)) {
      chatRooms.set(productId, []);
    }
    
    // Add message to room (keep last 100 messages per room)
    const messages = chatRooms.get(productId);
    const newMessage = {
      username,
      message: message.trim(),
      timestamp: new Date().toISOString()
    };
    
    messages.push(newMessage);
    
    // Keep only last 100 messages per room
    if (messages.length > 100) {
      messages.shift();
    }
    
    // Broadcast to all clients in this product's chat room
    io.to(`chat-${productId}`).emit('chat-message', newMessage);
    
    console.log(`💬 Chat message in product ${productId} from ${username}: ${message}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id} (${socket.userRole || 'guest'})`);
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
const chatRooms = new Map(); // productId -> [{ username, message, timestamp }]

// Make io available to other modules
app.set('io', io);

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
    
    // Also broadcast globally for admin dashboard updates
    io.emit('auction-status-update', statusUpdateData);
    
    console.log(`📡 Broadcasted status update: Auction ${auctionId} -> ${newStatus}`);
  }
};

// Helper function to compute real-time auction status
const computeAuctionStatus = (auction) => {
  if (auction.status === 'closed') {
    return 'closed';
  }
  const now = new Date();
  const startTime = new Date(auction.startTime);
  const endTime = new Date(auction.endTime);
  if (now < startTime) {
    return 'pending';
  } else if (now >= startTime && now < endTime) {
    return 'active';
  } else {
    return 'ended';
  }
};

// Function to check and broadcast auction status changes
const checkAuctionStatusChanges = async () => {
  try {
    const auctions = await Auction.find({ status: { $in: ['pending', 'active'] } });
    
    for (const auction of auctions) {
      const computedStatus = computeAuctionStatus(auction);
      
      // If the computed status differs from the stored status, broadcast the change
      if (computedStatus !== auction.status) {
        console.log(`🔄 Status change detected: Auction ${auction._id} ${auction.status} -> ${computedStatus}`);
        
        // Update the auction status in the database
        auction.status = computedStatus;
        if (computedStatus === 'ended') {
          auction.endTime = new Date(); // Set actual end time
        }
        await auction.save();
        
        // Send email notifications if auction ended
        if (computedStatus === 'ended' && auction.bidHistory.length > 0) {
          try {
            // Get the winning bid (highest bid)
            const winningBid = auction.bidHistory[auction.bidHistory.length - 1];
                const store = await Store.findByDomain(auction.shopDomain);
                const brandOptions = {
                  plan: store?.plan,
                  storeName: store?.storeName
                };
            
            // Send auction won notification to the winner
            if (winningBid.customerEmail) {
              await emailService.sendAuctionWonNotification(
                winningBid.customerEmail,
                winningBid.bidder,
                auction,
                    winningBid.amount,
                    brandOptions
              );
            }

            // Send outbid notification to all other bidders
            for (let i = 0; i < auction.bidHistory.length - 1; i++) {
              const bid = auction.bidHistory[i];
              if (bid.customerEmail && bid.bidder !== winningBid.bidder) {
                await emailService.sendOutbidNotification(
                  bid.customerEmail,
                  bid.bidder,
                  auction,
                      winningBid.amount,
                      brandOptions
                );
              }
            }

            // Send admin notification
            await emailService.sendAdminNotification(
              'Auction Ended',
              `Auction "${auction.productData?.title || 'Unknown Product'}" ended. Winner: ${winningBid.bidder} with $${winningBid.amount}`,
              auction
            );

            console.log(`✅ Auction end email notifications sent for auction ${auction._id}`);
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
            
            console.log(`✅ Winner processing completed for auction ${auction._id}`);
          } catch (processingError) {
            console.error(`❌ Error processing ended auction ${auction._id}:`, processingError);
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
  console.log(`🚀 Auction API server running on port ${PORT}`);
  console.log(`📊 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`🔗 API base URL: http://0.0.0.0:${PORT}/api/auctions`);
  console.log(`🔌 WebSocket server ready for real-time updates`);
  
  // Start scheduled jobs after server is running
  setTimeout(async () => {
    try {
      const { default: scheduledJobsService } = await import('./services/scheduledJobsService.js');
      scheduledJobsService.start();
      console.log(`⏰ Scheduled jobs started for winner processing`);
    } catch (error) {
      console.error('⚠️ Failed to start scheduled jobs:', error.message);
    }
  }, 2000); // Wait 2 seconds after server starts
});

export default app;
