import Auction from '../models/Auction.js';
import { AppError } from '../middleware/errorHandler.js';
import getShopifyService from '../services/shopifyService.js';
import emailService from '../services/emailService.js';

// Helper function to compute real-time auction status
const computeAuctionStatus = (auction) => {
  // If auction is manually closed by admin, keep it closed
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

// Create a new auction
export const createAuction = async (req, res, next) => {
  try {
    const { shopifyProductId } = req.body;
    const shopDomain = req.shopDomain; // Get from store middleware
    
    if (!shopDomain) {
      throw new AppError('Store domain is required', 400);
    }
    
    // Fetch product data from Shopify
    let productData = null;
    try {
      productData = await getShopifyService().getProduct(shopDomain, shopifyProductId);
    } catch (shopifyError) {
      console.warn(`Failed to fetch Shopify product ${shopifyProductId}:`, shopifyError.message);
      // Continue without product data - auction can still be created
    }
    
    const auction = new Auction({
      ...req.body,
      shopDomain: shopDomain, // Add store domain for isolation
      currentBid: 0, // Ensure currentBid starts at 0
      productData: productData // Cache the product data
    });
    const savedAuction = await auction.save();
    
    // Send real-time notification about new auction
    const io = req.app.get('io');
    if (io) {
      // Send to admin room
      io.to('admin-room').emit('admin-notification', {
        type: 'new-auction',
        message: `New auction created: "${savedAuction.productData?.title || 'Unknown Product'}"`,
        auctionId: savedAuction._id,
        timestamp: new Date().toISOString(),
        data: {
          productTitle: savedAuction.productData?.title,
          startTime: savedAuction.startTime,
          endTime: savedAuction.endTime,
          startingBid: savedAuction.startingBid
        }
      });

      // Send global auction update
      io.emit('auction-created', {
        auctionId: savedAuction._id,
        productTitle: savedAuction.productData?.title,
        status: savedAuction.status,
        startingBid: savedAuction.startingBid,
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Auction created successfully',
      data: savedAuction
    });
  } catch (error) {
    next(error);
  }
};


// Get all auctions with optional filtering
export const getAllAuctions = async (req, res, next) => {
  try {
    const { status, shopifyProductId, page = 1, limit = 10 } = req.query;
    const shopDomain = req.shopDomain; // Get from store middleware
    
    if (!shopDomain) {
      throw new AppError('Store domain is required', 400);
    }
    
    // Build filter object - ALWAYS filter by store domain
    const filter = { shopDomain: shopDomain };
    if (status) filter.status = status;
    if (shopifyProductId) filter.shopifyProductId = shopifyProductId;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const auctions = await Auction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Compute real-time status for each auction
    const auctionsWithRealTimeStatus = auctions.map(auction => ({
      ...auction,
      status: computeAuctionStatus(auction)
    }));
    
    const total = await Auction.countDocuments(filter);
    
    res.json({
      success: true,
      data: auctionsWithRealTimeStatus,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    next(error);
  }
};


// Get single auction by ID
export const getAuctionById = async (req, res, next) => {
  try {
    const shopDomain = req.shopDomain; // Get from store middleware
    
    if (!shopDomain) {
      throw new AppError('Store domain is required', 400);
    }
    
    // Try to find auction by Shopify product ID first (priority), then by MongoDB ObjectId
    let auction = await Auction.findOne({ 
      shopifyProductId: req.params.id, 
      shopDomain: shopDomain 
    });
    
    // If not found by Shopify product ID, try by MongoDB ObjectId
    if (!auction) {
      auction = await Auction.findOne({ 
        _id: req.params.id, 
        shopDomain: shopDomain 
      });
    }
    
    if (!auction) {
      throw new AppError('Auction not found', 404);
    }
    
    // Compute real-time status
    const auctionWithRealTimeStatus = {
      ...auction.toObject(),
      status: computeAuctionStatus(auction)
    };
    
    res.json({
      success: true,
      data: auctionWithRealTimeStatus
    });
  } catch (error) {
    next(error);
  }
};


// Update auction
export const updateAuction = async (req, res, next) => {
  try {
    const shopDomain = req.shopDomain; // Get from store middleware
    
    if (!shopDomain) {
      throw new AppError('Store domain is required', 400);
    }
    
    const auction = await Auction.findOne({ 
      _id: req.params.id, 
      shopDomain: shopDomain 
    });
    
    if (!auction) {
      throw new AppError('Auction not found', 404);
    }
    
    // Prevent updating certain fields if auction has bids
    if (auction.bidHistory.length > 0) {
      const restrictedFields = ['shopifyProductId', 'startingBid', 'startTime', 'endTime'];
      for (const field of restrictedFields) {
        if (req.body[field] !== undefined) {
          throw new AppError(`Cannot update ${field} after bids have been placed`, 400);
        }
      }
    }
    
    // Update allowed fields
    const allowedUpdates = ['shopifyProductId', 'startTime', 'endTime', 'startingBid', 'buyNowPrice', 'status'];
    const updates = {};
    
    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    
    // Custom validation for start/end time relationship
    if (updates.startTime && updates.endTime) {
      if (new Date(updates.endTime) <= new Date(updates.startTime)) {
        throw new AppError('End time must be after start time', 400);
      }
    } else if (updates.endTime) {
      // If only end time is being updated, compare with current start time
      if (new Date(updates.endTime) <= auction.startTime) {
        throw new AppError('End time must be after start time', 400);
      }
    } else if (updates.startTime) {
      // If only start time is being updated, compare with current end time
      if (new Date(updates.startTime) >= auction.endTime) {
        throw new AppError('Start time must be before end time', 400);
      }
    }
    
    const updatedAuction = await Auction.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: false } // Disable schema validators since we're doing custom validation
    );
    
    res.json({
      success: true,
      message: 'Auction updated successfully',
      data: updatedAuction
    });
  } catch (error) {
    next(error);
  }
};


// Delete auction
export const deleteAuction = async (req, res, next) => {
  try {
    const shopDomain = req.shopDomain; // Get from store middleware
    
    if (!shopDomain) {
      throw new AppError('Store domain is required', 400);
    }
    
    console.log('🗑️ Delete auction request:', {
      auctionId: req.params.id,
      shopDomain: shopDomain,
      method: req.method,
      url: req.url,
      params: req.params
    });
    
    // Check if ID is provided
    if (!req.params.id || req.params.id === 'undefined') {
      throw new AppError('Auction ID is required', 400);
    }
    
    const auction = await Auction.findOne({ 
      _id: req.params.id, 
      shopDomain: shopDomain 
    });
    
    if (!auction) {
      console.log('❌ Auction not found:', req.params.id);
      throw new AppError('Auction not found', 404);
    }
    
    console.log('📦 Found auction to delete:', {
      id: auction._id,
      productId: auction.shopifyProductId,
      bidCount: auction.bidHistory.length,
      status: auction.status
    });
    
    // Allow deletion but warn if auction has bids
    if (auction.bidHistory.length > 0) {
      console.log(`⚠️ Deleting auction with ${auction.bidHistory.length} bids: ${auction._id}`);
    }
    
    await Auction.findByIdAndDelete(req.params.id);
    
    console.log('✅ Auction deleted successfully:', req.params.id);
    
    res.json({
      success: true,
      message: 'Auction deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete auction error:', error.message);
    next(error);
  }
};


// Place a bid on an auction
export const placeBid = async (req, res, next) => {
  try {
    const { bidder, amount, customerEmail } = req.body;
    const shopDomain = req.shopDomain; // Get from store middleware
    
    if (!shopDomain) {
      throw new AppError('Store domain is required', 400);
    }
    
    // Input sanitization and validation
    const sanitizedBidder = bidder?.trim();
    const sanitizedAmount = parseFloat(amount);
    
    // Basic validation
    if (!sanitizedBidder || sanitizedBidder.length === 0) {
      throw new AppError('Bidder name is required', 400);
    }
    
    if (sanitizedBidder.length > 100) {
      throw new AppError('Bidder name must be 100 characters or less', 400);
    }
    
    if (!amount || isNaN(sanitizedAmount) || sanitizedAmount <= 0) {
      throw new AppError('Valid bid amount is required', 400);
    }
    
    const auction = await Auction.findOne({ 
      _id: req.params.id, 
      shopDomain: shopDomain 
    });
    
    if (!auction) {
      throw new AppError('Auction not found', 404);
    }
    
    // Validate auction is active using real-time status
    const realTimeStatus = computeAuctionStatus(auction);
    console.log('🎯 Bid placement debug:', {
      auctionId: req.params.id,
      databaseStatus: auction.status,
      realTimeStatus: realTimeStatus,
      startTime: auction.startTime,
      endTime: auction.endTime,
      currentTime: new Date(),
      bidder: sanitizedBidder,
      amount: sanitizedAmount
    });
    
    if (realTimeStatus !== 'active') {
      throw new AppError(`Auction is not active (current status: ${realTimeStatus})`, 400);
    }
    
    // Validate auction time
    const now = new Date();
    if (now < auction.startTime || now > auction.endTime) {
      throw new AppError('Auction is not currently active', 400);
    }
    
    // Validate bid amount
    const minBid = auction.currentBid > 0 ? auction.currentBid + 1 : auction.startingBid;
    if (sanitizedAmount < minBid) {
      if (auction.currentBid > 0) {
        throw new AppError(`Bid must be higher than current bid ($${auction.currentBid})`, 400);
      } else {
        throw new AppError(`Bid must be at least the starting bid ($${auction.startingBid})`, 400);
      }
    }
    
    // Temporarily update auction status to 'active' if real-time status is 'active'
    // This allows the addBid method to work properly
    const originalStatus = auction.status;
    if (realTimeStatus === 'active' && auction.status !== 'active') {
      auction.status = 'active';
      await auction.save();
    }
    
    try {
      // Add the bid with customer email
      await auction.addBid(sanitizedBidder, sanitizedAmount, customerEmail);
    } catch (error) {
      // Restore original status if bid fails
      if (originalStatus !== auction.status) {
        auction.status = originalStatus;
        await auction.save();
      }
      throw error;
    }
    
    // Refresh auction data
    const updatedAuction = await Auction.findById(req.params.id);
    
    // Check if bid matches buy now price
    let auctionEnded = false;
    if (amount >= auction.buyNowPrice) {
      updatedAuction.status = 'ended';
      updatedAuction.endTime = new Date(); // End immediately
      await updatedAuction.save();
      auctionEnded = true;
    }
    
    // Send email notifications
    try {
      // Send bid confirmation to the bidder
      await emailService.sendBidConfirmation(
        customerEmail || `${bidder.toLowerCase().replace(/\s+/g, '')}@example.com`, // Use customer email or demo email
        bidder,
        updatedAuction,
        amount
      );

      // Send outbid notification to previous highest bidder
      if (updatedAuction.bidHistory.length > 1) {
        const previousBid = updatedAuction.bidHistory[updatedAuction.bidHistory.length - 2];
        if (previousBid.bidder !== bidder && previousBid.customerEmail) {
          await emailService.sendOutbidNotification(
            previousBid.customerEmail, // Use actual customer email
            previousBid.bidder,
            updatedAuction,
            amount
          );
        }
      }

      // Send auction won notification if buy now
      if (auctionEnded) {
        await emailService.sendAuctionWonNotification(
          customerEmail || `${bidder.toLowerCase().replace(/\s+/g, '')}@example.com`, // Use customer email or demo email
          bidder,
          updatedAuction,
          amount
        );

        // Send admin notification
        await emailService.sendAdminNotification(
          'Auction Won via Buy Now',
          `Auction "${updatedAuction.productData?.title || 'Unknown Product'}" was won by ${bidder} for $${amount}`,
          updatedAuction
        );
      }

      console.log('✅ Email notifications sent successfully');
    } catch (emailError) {
      console.error('⚠️ Email notification error (non-critical):', emailError);
      // Don't fail the bid placement if email fails
    }

    // Broadcast real-time update to all clients watching this auction
    const io = req.app.get('io');
    if (io) {
      const bidUpdateData = {
        auctionId: req.params.id,
        currentBid: updatedAuction.currentBid,
        bidHistory: updatedAuction.bidHistory,
        bidder: bidder,
        amount: amount,
        timestamp: new Date().toISOString(),
        auctionEnded: auctionEnded,
        winner: auctionEnded ? bidder : null,
        productTitle: updatedAuction.productData?.title || 'Unknown Product'
      };

      // Send to auction-specific room
      io.to(`auction-${req.params.id}`).emit('bid-update', bidUpdateData);
      
      // Also broadcast globally to ensure all clients receive updates
      io.emit('bid-update', bidUpdateData);

      // Send to admin room for admin notifications
      io.to('admin-room').emit('admin-notification', {
        type: auctionEnded ? 'auction-ended' : 'new-bid',
        message: auctionEnded 
          ? `Auction "${updatedAuction.productData?.title || 'Unknown Product'}" ended with winning bid of $${amount} by ${bidder}`
          : `New bid of $${amount} placed on "${updatedAuction.productData?.title || 'Unknown Product'}" by ${bidder}`,
        auctionId: req.params.id,
        timestamp: new Date().toISOString(),
        data: {
          productTitle: updatedAuction.productData?.title,
          currentBid: updatedAuction.currentBid,
          bidCount: updatedAuction.bidHistory?.length || 0
        }
      });

      // Send global auction update to all connected clients
      io.emit('auction-updated', {
        auctionId: req.params.id,
        status: updatedAuction.status,
        currentBid: updatedAuction.currentBid,
        productTitle: updatedAuction.productData?.title,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Bid placed successfully',
      data: updatedAuction
    });
  } catch (error) {
    next(error);
  }
};


// Get auction statistics
export const buyNow = async (req, res, next) => {
  try {
    const { bidder, customerEmail } = req.body;
    const shopDomain = req.shopDomain; // Get from store middleware
    
    if (!shopDomain) {
      throw new AppError('Store domain is required', 400);
    }
    
    if (!bidder || !bidder.trim()) {
      throw new AppError('Bidder name is required', 400);
    }
    
    const auction = await Auction.findOne({ 
      _id: req.params.id, 
      shopDomain: shopDomain 
    });
    if (!auction) {
      throw new AppError('Auction not found', 404);
    }
    
    // Validate auction is active using real-time status
    const realTimeStatus = computeAuctionStatus(auction);
    if (realTimeStatus !== 'active') {
      throw new AppError(`Auction is not active (current status: ${realTimeStatus})`, 400);
    }
    
    const now = new Date();
    if (now < auction.startTime || now > auction.endTime) {
      throw new AppError('Auction is not currently active', 400);
    }
    
    // Temporarily update auction status to 'active' if real-time status is 'active'
    // This allows the addBid method to work properly
    const originalStatus = auction.status;
    if (realTimeStatus === 'active' && auction.status !== 'active') {
      auction.status = 'active';
      await auction.save();
    }
    
    try {
      // Add the buy now bid with customer email
      await auction.addBid(bidder.trim(), auction.buyNowPrice, customerEmail);
    } catch (error) {
      // Restore original status if bid fails
      if (originalStatus !== auction.status) {
        auction.status = originalStatus;
        await auction.save();
      }
      throw error;
    }
    
    // End the auction immediately
    auction.status = 'ended';
    auction.endTime = new Date();
    await auction.save();
    
    // Send email notifications
    try {
      // Send auction won notification to the buyer
      await emailService.sendAuctionWonNotification(
        customerEmail || `${bidder.toLowerCase().replace(/\s+/g, '')}@example.com`, // Use customer email or demo email
        bidder.trim(),
        auction,
        auction.buyNowPrice
      );

      // Send outbid notification to previous highest bidder (if any)
      if (auction.bidHistory.length > 1) {
        const previousBid = auction.bidHistory[auction.bidHistory.length - 2];
        if (previousBid.bidder !== bidder.trim() && previousBid.customerEmail) {
          await emailService.sendOutbidNotification(
            previousBid.customerEmail, // Use actual customer email
            previousBid.bidder,
            auction,
            auction.buyNowPrice
          );
        }
      }

      // Send admin notification
      await emailService.sendAdminNotification(
        'Auction Won via Buy Now',
        `Auction "${auction.productData?.title || 'Unknown Product'}" was won by ${bidder.trim()} for $${auction.buyNowPrice}`,
        auction
      );

      console.log('✅ Buy now email notifications sent successfully');
    } catch (emailError) {
      console.error('⚠️ Buy now email notification error (non-critical):', emailError);
      // Don't fail the buy now if email fails
    }
    
    // Broadcast real-time update to all clients watching this auction
    const io = req.app.get('io');
    if (io) {
      const buyNowData = {
        auctionId: req.params.id,
        currentBid: auction.buyNowPrice,
        bidHistory: auction.bidHistory,
        bidder: bidder.trim(),
        amount: auction.buyNowPrice,
        timestamp: new Date().toISOString(),
        auctionEnded: true,
        winner: bidder.trim(),
        buyNow: true,
        productTitle: auction.productData?.title || 'Unknown Product'
      };

      // Send to auction-specific room
      io.to(`auction-${req.params.id}`).emit('bid-update', buyNowData);
      
      // Also broadcast globally to ensure all clients receive updates
      io.emit('bid-update', buyNowData);
    }
    
    res.json({
      success: true,
      message: 'Buy now successful! Auction ended.',
      data: auction
    });
  } catch (error) {
    next(error);
  }
};


// Refresh Shopify product data for an auction
export const refreshProductData = async (req, res, next) => {
  try {
    const auction = await Auction.findById(req.params.id);
    
    if (!auction) {
      throw new AppError('Auction not found', 404);
    }
    
    // Fetch fresh product data from Shopify
    let productData = null;
    try {
      productData = await getShopifyService().getProduct(auction.shopifyProductId);
    } catch (shopifyError) {
      throw new AppError(`Failed to fetch Shopify product: ${shopifyError.message}`, 400);
    }
    
    // Update auction with fresh product data
    auction.productData = productData;
    const updatedAuction = await auction.save();
    
    res.json({
      success: true,
      message: 'Product data refreshed successfully',
      data: updatedAuction
    });
  } catch (error) {
    next(error);
  }
};


// Refresh product data for multiple auctions
export const refreshAllProductData = async (req, res, next) => {
  try {
    const auctions = await Auction.find({});
    const results = [];
    
    for (const auction of auctions) {
      try {
        const productData = await getShopifyService().getProduct(auction.shopifyProductId);
        auction.productData = productData;
        await auction.save();
        results.push({ auctionId: auction._id, success: true });
      } catch (error) {
        results.push({ 
          auctionId: auction._id, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Product data refresh completed',
      data: results
    });
  } catch (error) {
    next(error);
  }
};


// Get auctions with fresh product data
export const getAuctionsWithProductData = async (req, res, next) => {
  try {
    const { status, shopifyProductId, page = 1, limit = 10, refresh = false } = req.query;
    
    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (shopifyProductId) filter.shopifyProductId = shopifyProductId;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let auctions = await Auction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // If refresh is requested, fetch fresh product data
    if (refresh === 'true') {
      for (let auction of auctions) {
        try {
          const productData = await getShopifyService().getProduct(auction.shopifyProductId);
          auction.productData = productData;
          
          // Update in database
          await Auction.findByIdAndUpdate(auction._id, { productData });
        } catch (error) {
          console.warn(`Failed to refresh product data for auction ${auction._id}:`, error.message);
        }
      }
    }
    
    const total = await Auction.countDocuments(filter);
    
    res.json({
      success: true,
      data: auctions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    next(error);
  }
};


export const getAuctionStats = async (req, res, next) => {
  try {
    const shopDomain = req.shopDomain; // Get from store middleware
    
    if (!shopDomain) {
      throw new AppError('Store domain is required', 400);
    }
    
    // Get all auctions for this store and compute real-time status
    const allAuctions = await Auction.find({ shopDomain: shopDomain });
    
    const totalAuctions = allAuctions.length;
    const pendingAuctions = allAuctions.filter(auction => computeAuctionStatus(auction) === 'pending').length;
    const activeAuctions = allAuctions.filter(auction => computeAuctionStatus(auction) === 'active').length;
    const endedAuctions = allAuctions.filter(auction => computeAuctionStatus(auction) === 'ended').length;
    const closedAuctions = allAuctions.filter(auction => computeAuctionStatus(auction) === 'closed').length;
    
    // Calculate total bids across all auctions for this store
    const totalBids = allAuctions.reduce((sum, auction) => sum + (auction.bidHistory?.length || 0), 0);
    
    res.json({
      success: true,
      data: {
        totalAuctions,
        pendingAuctions,
        activeAuctions,
        endedAuctions,
        closedAuctions,
        totalBids,
        statusBreakdown: [
          { _id: 'pending', count: pendingAuctions, totalBids: allAuctions.filter(auction => computeAuctionStatus(auction) === 'pending').reduce((sum, a) => sum + (a.bidHistory?.length || 0), 0) },
          { _id: 'active', count: activeAuctions, totalBids: allAuctions.filter(auction => computeAuctionStatus(auction) === 'active').reduce((sum, a) => sum + (a.bidHistory?.length || 0), 0) },
          { _id: 'ended', count: endedAuctions, totalBids: allAuctions.filter(auction => computeAuctionStatus(auction) === 'ended').reduce((sum, a) => sum + (a.bidHistory?.length || 0), 0) },
          { _id: 'closed', count: closedAuctions, totalBids: allAuctions.filter(auction => computeAuctionStatus(auction) === 'closed').reduce((sum, a) => sum + (a.bidHistory?.length || 0), 0) }
        ]
      }
    });
  } catch (error) {
    next(error);
  }
};


// Relist auction (reactivate ended auction without bids)
export const relistAuction = async (req, res, next) => {
  try {
    const auction = await Auction.findById(req.params.id);
    
    if (!auction) {
      throw new AppError('Auction not found', 404);
    }
    
    // Check if auction can be relisted (closed or ended without bids)
    if (auction.status !== 'closed' && auction.status !== 'ended') {
      throw new AppError('Only closed or ended auctions can be relisted', 400);
    }
    
    // Check if auction has bids (cannot relist if there were bidders/buyers)
    if (auction.bidHistory && auction.bidHistory.length > 0) {
      throw new AppError('Cannot relist auction that has bids or buyers', 400);
    }
    
    // Validate that end time is after start time
    if (new Date(req.body.endTime) <= new Date(req.body.startTime)) {
      throw new AppError('End time must be after start time', 400);
    }
    
    // Determine the correct status based on start time
    const newStartTime = new Date(req.body.startTime);
    const now = new Date();
    const newStatus = newStartTime > now ? 'pending' : 'active';
    
    // Update auction with new data and reactivate
    const updatedAuction = await Auction.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        status: newStatus,
        bidHistory: [], // Reset bid history
        currentBid: 0 // Reset current bid to 0 (no bids yet)
      },
      { new: true, runValidators: false }
    );
    
    res.json({
      success: true,
      message: 'Auction relisted successfully',
      data: updatedAuction
    });
    
  } catch (error) {
    next(error);
  }
};

// Get auction details page (renders HTML page for individual auction)
export const getAuctionDetailsPage = async (req, res, next) => {
  try {
    console.log('🔍 getAuctionDetailsPage called with:', {
      auctionId: req.params.id,
      shopDomain: req.shopDomain,
      query: req.query
    });
    
    const auction = await Auction.findById(req.params.id);
    
    if (!auction) {
      console.log('❌ Auction not found:', req.params.id);
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Auction Not Found</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; }
            .error { color: #dc3545; }
          </style>
        </head>
        <body>
          <h1 class="error">Auction Not Found</h1>
          <p>The auction you're looking for doesn't exist or has been removed.</p>
        </body>
        </html>
      `);
    }
    
    const shopDomain = req.shopDomain;
    if (!shopDomain) {
      console.log('❌ No shop domain found in request');
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Store Required</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; }
            .error { color: #dc3545; }
          </style>
        </head>
        <body>
          <h1 class="error">Store Required</h1>
          <p>Shop domain is required to view this auction.</p>
        </body>
        </html>
      `);
    }
    
    const productTitle = auction.productData?.title || 'Auction Item';
    console.log('✅ Auction found:', {
      id: auction._id,
      title: productTitle,
      shopDomain: shopDomain
    });
    
    // Render the auction details page
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Auction: ${productTitle}</title>
        <link rel="stylesheet" href="/apps/bidly/assets/bidly-widget.css">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
          }
          
          .auction-details-page {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
          }
          
          .auction-details-container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0;
            min-height: 600px;
          }
          
          .auction-details-header {
            display: none; /* Hide the header for cleaner look */
          }
          
          .auction-details-body {
            padding: 0;
          }
          
          #bidly-auction-detail-page {
            min-height: 600px;
          }
          
          .auction-details-full {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0;
            min-height: 600px;
          }
          
          .auction-details-image {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
            position: relative;
          }
          
          .auction-main-image {
            max-width: 100%;
            max-height: 500px;
            object-fit: cover;
            border-radius: 15px;
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease;
          }
          
          .auction-main-image:hover {
            transform: scale(1.05);
          }
          
          .auction-details-info {
            padding: 50px 40px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          
          .auction-title {
            font-size: 2.8rem;
            font-weight: 800;
            color: #2c3e50;
            margin-bottom: 20px;
            line-height: 1.2;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .product-description {
            margin: 30px 0;
            padding: 25px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            border-left: 5px solid #667eea;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
          }
          
          .product-description h3 {
            font-size: 1.4rem;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
          }
          
          .product-description h3::before {
            content: "📝";
            margin-right: 10px;
            font-size: 1.2rem;
          }
          
          .product-description .description-content {
            color: #495057;
            line-height: 1.8;
            max-height: 200px;
            overflow-y: auto;
            padding: 15px;
            background: white;
            border-radius: 10px;
            border: 1px solid #e9ecef;
            font-size: 1rem;
          }
          
          .auction-price-section {
            margin: 30px 0;
            padding: 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 20px;
            color: white;
            position: relative;
            overflow: hidden;
          }
          
          .auction-price-section::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: float 6s ease-in-out infinite;
          }
          
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
          }
          
          .auction-price {
            position: relative;
            z-index: 2;
          }
          
          .price-label {
            font-size: 1.2rem;
            font-weight: 600;
            opacity: 0.9;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .price-amount {
            font-size: 3.5rem;
            font-weight: 900;
            margin-bottom: 15px;
            text-shadow: 0 4px 8px rgba(0,0,0,0.3);
            line-height: 1;
          }
          
          .starting-price {
            font-size: 1.3rem;
            opacity: 0.8;
            font-weight: 500;
          }
          
          .auction-timer {
            font-size: 1.8rem;
            font-weight: 700;
            color: #e74c3c;
            text-align: center;
            margin: 25px 0;
            padding: 20px;
            background: linear-gradient(135deg, #fff5f5 0%, #ffe6e6 100%);
            border: 3px solid #e74c3c;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(231, 76, 60, 0.2);
            position: relative;
            overflow: hidden;
          }
          
          .auction-timer::before {
            content: '⏰';
            margin-right: 10px;
            font-size: 1.5rem;
          }
          
          .auction-status {
            text-align: center;
            padding: 15px 30px;
            border-radius: 50px;
            font-weight: 700;
            font-size: 1.2rem;
            margin: 25px 0;
            text-transform: uppercase;
            letter-spacing: 2px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
          }
          
          .status-active {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
          }
          
          .status-pending {
            background: linear-gradient(135deg, #ffc107 0%, #ff8c00 100%);
            color: white;
          }
          
          .status-ended {
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            color: white;
          }
          
          .status-closed {
            background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
            color: white;
          }
          
          .auction-bidding-section {
            margin: 30px 0;
            padding: 30px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 20px;
            border: 1px solid #dee2e6;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
          }
          
          .bid-form {
            display: flex;
            gap: 20px;
            align-items: center;
            flex-wrap: wrap;
            margin-bottom: 20px;
          }
          
          .bid-input {
            flex: 1;
            min-width: 250px;
            padding: 18px 25px;
            border: 3px solid #dee2e6;
            border-radius: 15px;
            font-size: 1.2rem;
            font-weight: 600;
            transition: all 0.3s ease;
            background: white;
          }
          
          .bid-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 5px rgba(102, 126, 234, 0.1);
            transform: translateY(-2px);
          }
          
          .bid-button {
            padding: 18px 35px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 15px;
            font-size: 1.2rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
          }
          
          .bid-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
          }
          
          .bid-button:disabled {
            background: #6c757d;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
          }
          
          .buy-now-button {
            padding: 18px 35px;
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            border: none;
            border-radius: 15px;
            font-size: 1.2rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-left: 20px;
            box-shadow: 0 5px 15px rgba(40, 167, 69, 0.3);
          }
          
          .buy-now-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 25px rgba(40, 167, 69, 0.4);
          }
          
          .auction-bid-history {
            margin: 30px 0;
            padding: 30px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 20px;
            border: 1px solid #dee2e6;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
          }
          
          .bid-history-title {
            font-size: 1.8rem;
            font-weight: 800;
            margin: 0 0 25px 0;
            color: #2c3e50;
            display: flex;
            align-items: center;
          }
          
          .bid-history-title::before {
            content: "📊";
            margin-right: 15px;
            font-size: 1.5rem;
          }
          
          .bid-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 25px;
            margin: 15px 0;
            background: white;
            border-radius: 15px;
            border-left: 5px solid #667eea;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
            transition: transform 0.3s ease;
          }
          
          .bid-item:hover {
            transform: translateX(5px);
          }
          
          .bid-amount {
            font-size: 1.5rem;
            font-weight: 800;
            color: #28a745;
          }
          
          .bid-bidder {
            font-weight: 700;
            color: #495057;
            font-size: 1.1rem;
          }
          
          .bid-time {
            font-size: 1rem;
            color: #6c757d;
            font-weight: 500;
          }
          
          .customer-auth {
            position: fixed;
            top: 30px;
            right: 30px;
            z-index: 1000;
          }
          
          .auth-form {
            background: white;
            padding: 30px;
            border-radius: 20px;
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
            border: 1px solid #e9ecef;
            min-width: 350px;
            backdrop-filter: blur(10px);
          }
          
          .auth-form h3 {
            margin: 0 0 20px 0;
            color: #2c3e50;
            font-size: 1.5rem;
            font-weight: 800;
            text-align: center;
          }
          
          .form-group {
            margin-bottom: 20px;
          }
          
          .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 700;
            color: #495057;
            font-size: 1rem;
          }
          
          .form-group input {
            width: 100%;
            padding: 15px 20px;
            border: 3px solid #dee2e6;
            border-radius: 12px;
            font-size: 1.1rem;
            transition: all 0.3s ease;
            background: #f8f9fa;
          }
          
          .form-group input:focus {
            outline: none;
            border-color: #667eea;
            background: white;
            box-shadow: 0 0 0 5px rgba(102, 126, 234, 0.1);
          }
          
          .auth-buttons {
            display: flex;
            gap: 15px;
            margin-top: 20px;
          }
          
          .auth-button {
            flex: 1;
            padding: 15px 25px;
            border: none;
            border-radius: 12px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 1.1rem;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .login-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
          }
          
          .logout-button {
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            color: white;
            box-shadow: 0 5px 15px rgba(220, 53, 69, 0.3);
          }
          
          .auth-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
          }
          
          .bidly-loading {
            text-align: center;
            padding: 80px 20px;
            color: #6c757d;
          }
          
          .bidly-spinner {
            width: 50px;
            height: 50px;
            border: 5px solid #f3f3f3;
            border-top: 5px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 30px;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          /* Responsive Design */
          @media (max-width: 768px) {
            .auction-details-full {
              grid-template-columns: 1fr;
            }
            
            .auction-details-info {
              padding: 30px 20px;
            }
            
            .auction-title {
              font-size: 2.2rem;
            }
            
            .price-amount {
              font-size: 2.8rem;
            }
            
            .bid-form {
              flex-direction: column;
            }
            
            .bid-input {
              min-width: 100%;
            }
            
            .customer-auth {
              position: static;
              margin-bottom: 20px;
            }
            
            .auth-form {
              min-width: auto;
              width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="auction-details-page">
          <div class="auction-details-container">
            <div class="auction-details-header">
              <h1>Auction Details</h1>
              <div class="auction-details-meta">
                <span class="auction-id">Auction ID: ${auction._id}</span>
                <span class="product-id">Product ID: ${auction.shopifyProductId}</span>
              </div>
            </div>
            <div class="auction-details-body">
              <div id="bidly-auction-detail-page" 
                   data-auction-id="${auction._id}" 
                   data-product-id="${auction.shopifyProductId}"
                   data-shop="${shopDomain}">
                <div class="bidly-loading">
                  <div class="bidly-spinner"></div>
                  <p>Loading auction details...</p>
                </div>
                
              </div>
            </div>
          </div>
        </div>
        
        <script src="/apps/bidly/assets/bidly-widget.js?v=2021&t=${Date.now()}&r=${Math.random()}"></script>
        <script>
          console.log('🔥 PRODUCT PAGE SCRIPT LOADING...');
          console.log('🔥 PRODUCT PAGE - Loading widget with cache busting v2021');
          
          // Debug auction data directly in HTML
          console.log('🔍 AUCTION DATA IN HTML:', {
            auctionId: '${auction._id}',
            productId: '${auction.shopifyProductId}',
            hasProductData: ${auction.productData ? 'true' : 'false'},
            productData: ${JSON.stringify(auction.productData)},
            hasDescription: ${auction.productData?.description ? 'true' : 'false'},
            description: ${auction.productData?.description ? `'${auction.productData.description.substring(0, 100)}...'` : 'null'},
            descriptionLength: ${auction.productData?.description?.length || 0}
          });
          
          // Pass auction data to JavaScript
          window.auctionDataFromHTML = ${JSON.stringify(auction)};
          console.log('✅ Auction data passed to JavaScript:', window.auctionDataFromHTML);
          console.log('✅ Description in HTML data:', window.auctionDataFromHTML.productData?.description?.substring(0, 100) + '...');
          
          // Test if script is running
          setTimeout(() => {
            console.log('🔥 SCRIPT TIMEOUT TEST - Widget exists:', !!window.BidlyAuctionWidget);
            console.log('🔥 PRODUCT PAGE - Widget version check:', window.BidlyAuctionWidget ? 'v2021 loaded' : 'not loaded');
          }, 1000);
          
          document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 Product page DOM loaded');
            
            const auctionId = document.getElementById('bidly-auction-detail-page').dataset.auctionId;
            const productId = document.getElementById('bidly-auction-detail-page').dataset.productId;
            const shopDomain = document.getElementById('bidly-auction-detail-page').dataset.shop;
            
            console.log('📊 Product page data:', { auctionId, productId, shopDomain });
            console.log('🔍 Widget check:', { 
              widgetExists: !!window.BidlyAuctionWidget,
              loadSingleAuctionPageExists: !!(window.BidlyAuctionWidget && window.BidlyAuctionWidget.loadSingleAuctionPage)
            });
            
            if (window.BidlyAuctionWidget && window.BidlyAuctionWidget.loadSingleAuctionPage) {
              console.log('✅ Calling loadSingleAuctionPage');
              // Load the specific auction
              window.BidlyAuctionWidget.loadSingleAuctionPage(auctionId, productId, shopDomain);
            } else {
              console.error('❌ BidlyAuctionWidget not found or loadSingleAuctionPage missing');
              if (window.BidlyAuctionWidget && window.BidlyAuctionWidget.debug) {
                window.BidlyAuctionWidget.debug();
              }
              document.getElementById('bidly-auction-detail-page').innerHTML = 
                '<div class="error">Error: Auction widget not loaded properly</div>';
            }
          });
          
          // Also try immediate execution
          console.log('🔥 IMMEDIATE EXECUTION TEST');
          if (window.BidlyAuctionWidget) {
            console.log('🔥 Widget found immediately');
          } else {
            console.log('🔥 Widget not found immediately, waiting...');
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error loading auction details page:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; }
          .error { color: #dc3545; }
        </style>
      </head>
      <body>
        <h1 class="error">Error Loading Auction</h1>
        <p>There was an error loading the auction details. Please try again later.</p>
      </body>
      </html>
    `);
  }
};


