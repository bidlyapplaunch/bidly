import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import connectDB from './config/database.js';
import Auction from './models/Auction.js';
import auctionRoutes from './routes/auctionRoutes.js';
import shopifyRoutes from './routes/shopifyRoutes.js';
import authRoutes from './routes/authRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import oauthRoutes from './routes/oauthRoutes.js';
import appBridgeRoutes from './routes/appBridgeRoutes.js';
import appProxyRoutes from './routes/appProxyRoutes.js';
import debugRoutes from './routes/debugRoutes.js';
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

// CORS configuration - Development setup for ngrok
app.use(cors({
         origin: [
           'http://localhost:3001',
           'http://localhost:3002',
           'https://bidly-auction-admin.onrender.com',
           'https://bidly-auction-customer.onrender.com',
           'https://admin.shopify.com',
           'https://*.myshopify.com',
           'https://bidly-2.myshopify.com'
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

// Root endpoint for Render (moved after Shopify embedded app route)

// API routes
app.use('/api/auctions', auctionRoutes);
app.use('/api/shopify', shopifyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/analytics', analyticsRoutes);

// Customer routes for hybrid login system
const { default: customerRoutes } = await import('./routes/customerRoutes.js');
app.use('/api/customers', customerRoutes);

// Winner processing routes
const { default: winnerRoutes } = await import('./routes/winnerRoutes.js');
app.use('/api/winner', winnerRoutes);

// Widget features re-enabled with fixed imports
const { default: metafieldsRoutes } = await import('./routes/metafields.js');
const { default: productDuplicationRoutes } = await import('./routes/productDuplication.js');
app.use('/api/metafields', metafieldsRoutes);
app.use('/api/product-duplication', productDuplicationRoutes);

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
app.get('/', (req, res) => {
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
  res.sendFile(indexPath);
});

// Render health check endpoint (after Shopify embedded app route)
app.get('/render-health', (req, res) => {
  res.json({
    success: true,
    message: 'Bidly Auction API Server',
    status: 'running',
    timestamp: new Date().toISOString()
  });
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
            
            // Send auction won notification to the winner
            if (winningBid.customerEmail) {
              await emailService.sendAuctionWonNotification(
                winningBid.customerEmail,
                winningBid.bidder,
                auction,
                winningBid.amount
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
                  winningBid.amount
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
