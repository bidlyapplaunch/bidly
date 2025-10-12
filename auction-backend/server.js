import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/database.js';
import auctionRoutes from './routes/auctionRoutes.js';
import shopifyRoutes from './routes/shopifyRoutes.js';
import authRoutes from './routes/authRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

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
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    methods: ['GET', 'POST']
  }
});
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true
}));

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

// API routes
app.use('/api/auctions', auctionRoutes);
app.use('/api/shopify', shopifyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/analytics', analyticsRoutes);

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

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Auction API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API base URL: http://localhost:${PORT}/api/auctions`);
  console.log(`🔌 WebSocket server ready for real-time updates`);
});

export default app;
