import Auction from '../models/Auction.js';
import { AppError } from '../middleware/errorHandler.js';
import getShopifyService from '../services/shopifyService.js';
import emailService from '../services/emailService.js';
// import ProductDuplicationService from '../services/productDuplicationService.js';

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

// Helper function to update product metafields for auction widget
const updateProductMetafields = async (auction, shopDomain) => {
  try {
    if (!auction.shopifyProductId || !shopDomain) {
      return;
    }

    const auctionData = {
      auctionId: auction._id,
      status: computeAuctionStatus(auction),
      currentBid: auction.currentBid || 0,
      startingBid: auction.startingBid,
      reservePrice: auction.reservePrice || 0,
      endTime: auction.endTime,
      bidCount: auction.bidHistory?.length || 0,
      buyNowPrice: auction.buyNowPrice || 0
    };

    // Update metafields via API call
    const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:5000'}/api/metafields/products/${auction.shopifyProductId}/auction-metafields`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'temp-token'}`
      },
      body: JSON.stringify({
        shop: shopDomain,
        auctionData
      })
    });

    if (!response.ok) {
      console.warn('Failed to update product metafields:', await response.text());
    }
  } catch (error) {
    console.warn('Error updating product metafields:', error.message);
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
    
    // Update product metafields for auction widget (temporarily disabled)
    // await updateProductMetafields(savedAuction, shopDomain);
    
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
    
    // Update product metafields for auction widget (temporarily disabled)
    // await updateProductMetafields(updatedAuction, shopDomain);
    
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

// Get all auctions page (HTML) - Main auction listing
export const getAllAuctionsPage = async (req, res, next) => {
  try {
    const shopDomain = req.query.shop;
    
    if (!shopDomain) {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Error</h1>
            <p>Shop domain is required</p>
          </body>
        </html>
      `);
    }

    // Get all active auctions for this shop
    const auctions = await Auction.find({ 
      shopDomain: shopDomain,
      status: { $in: ['active', 'pending'] }
    }).sort({ createdAt: -1 });

    // Compute real-time status for each auction
    const auctionsWithRealTimeStatus = auctions.map(auction => ({
      ...auction.toObject(),
      status: computeAuctionStatus(auction)
    }));

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Live Auctions - ${shopDomain}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }
          
          .auction-listing-page {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          
          .auction-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          
          .auction-header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 700;
          }
          
          .auction-header p {
            font-size: 1.1rem;
            opacity: 0.9;
          }
          
          .auction-stats {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-top: 20px;
            flex-wrap: wrap;
          }
          
          .stat-item {
            text-align: center;
            padding: 15px 25px;
            background: rgba(255,255,255,0.2);
            border-radius: 8px;
            backdrop-filter: blur(10px);
          }
          
          .stat-number {
            font-size: 2rem;
            font-weight: 700;
            display: block;
          }
          
          .stat-label {
            font-size: 0.9rem;
            opacity: 0.8;
          }
          
          .auction-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 25px;
            padding: 30px;
            background: #f8f9fa;
          }
          
          .auction-card {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            border: 1px solid #e9ecef;
          }
          
          .auction-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 35px rgba(0,0,0,0.15);
          }
          
          .auction-image {
            width: 100%;
            height: 200px;
            object-fit: cover;
            background: #f8f9fa;
          }
          
          .auction-content {
            padding: 20px;
          }
          
          .auction-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 10px;
            line-height: 1.4;
          }
          
          .auction-price {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
          }
          
          .current-bid {
            font-size: 1.5rem;
            font-weight: 700;
            color: #27ae60;
          }
          
          .starting-bid {
            font-size: 0.9rem;
            color: #6c757d;
          }
          
          .auction-timer {
            background: #fff3cd;
            color: #856404;
            padding: 8px 12px;
            border-radius: 6px;
            font-weight: 600;
            text-align: center;
            margin-bottom: 15px;
            border-left: 4px solid #ffc107;
          }
          
          .auction-status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 15px;
          }
          
          .status-active {
            background: #d4edda;
            color: #155724;
          }
          
          .status-pending {
            background: #fff3cd;
            color: #856404;
          }
          
          .bid-section {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
          }
          
          .bid-input {
            flex: 1;
            padding: 10px 12px;
            border: 2px solid #e9ecef;
            border-radius: 6px;
            font-size: 1rem;
            transition: border-color 0.3s ease;
          }
          
          .bid-input:focus {
            outline: none;
            border-color: #667eea;
          }
          
          .bid-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          
          .bid-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
          }
          
          .bid-button:disabled {
            background: #6c757d;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
          }
          
          .buy-now-button {
            background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            transition: all 0.3s ease;
          }
          
          .buy-now-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(39, 174, 96, 0.4);
          }
          
          .bid-history {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 15px;
            margin-top: 15px;
          }
          
          .bid-history h4 {
            font-size: 0.9rem;
            color: #6c757d;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .bid-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 10px;
            margin: 3px 0;
            background: #f8f9fa;
            border-radius: 4px;
            border-left: 3px solid #28a745;
          }
          
          .bid-amount {
            font-size: 1rem;
            font-weight: 600;
            color: #28a745;
          }
          
          .bid-bidder {
            font-weight: 500;
            color: #333;
            font-size: 0.9rem;
          }
          
          .bid-time {
            font-size: 0.8rem;
            color: #6c757d;
            font-weight: 400;
          }
          
          .customer-auth {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            z-index: 1000;
            min-width: 200px;
          }
          
          .customer-info {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
          }
          
          .customer-name {
            font-weight: 600;
            color: #2c3e50;
          }
          
          .logout-button {
            background: #e74c3c;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 0.8rem;
            cursor: pointer;
            transition: background 0.3s ease;
          }
          
          .logout-button:hover {
            background: #c0392b;
          }
          
          .login-form {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          
          .login-input {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 0.9rem;
          }
          
          .login-button {
            background: #3498db;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background 0.3s ease;
          }
          
          .login-button:hover {
            background: #2980b9;
          }
          
          .no-auctions {
            text-align: center;
            padding: 60px 20px;
            color: #6c757d;
          }
          
          .no-auctions h3 {
            font-size: 1.5rem;
            margin-bottom: 10px;
          }
          
          .no-auctions p {
            font-size: 1rem;
          }
          
          @media (max-width: 768px) {
            .auction-grid {
              grid-template-columns: 1fr;
              padding: 20px;
            }
            
            .auction-header h1 {
              font-size: 2rem;
            }
            
            .auction-stats {
              gap: 15px;
            }
            
            .customer-auth {
              position: relative;
              top: auto;
              right: auto;
              margin: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="auction-listing-page">
          <div class="auction-header">
            <h1>🎯 Live Auctions</h1>
            <p>Bid on amazing products and win great deals!</p>
            
            <div class="auction-stats">
              <div class="stat-item">
                <span class="stat-number" id="total-auctions">${auctionsWithRealTimeStatus.length}</span>
                <span class="stat-label">Active Auctions</span>
              </div>
              <div class="stat-item">
                <span class="stat-number" id="total-bids">${auctionsWithRealTimeStatus.reduce((sum, auction) => sum + auction.bidHistory.length, 0)}</span>
                <span class="stat-label">Total Bids</span>
              </div>
              <div class="stat-item">
                <span class="stat-number" id="active-bidders">${new Set(auctionsWithRealTimeStatus.flatMap(auction => auction.bidHistory.map(bid => bid.bidder))).size}</span>
                <span class="stat-label">Active Bidders</span>
              </div>
            </div>
          </div>
          
          <div class="auction-grid" id="auction-grid">
            ${auctionsWithRealTimeStatus.length === 0 ? `
              <div class="no-auctions">
                <h3>No Active Auctions</h3>
                <p>Check back later for new auctions!</p>
              </div>
            ` : auctionsWithRealTimeStatus.map(auction => `
              <div class="auction-card" data-auction-id="${auction._id}">
                <img src="${auction.productData?.image?.src || '/placeholder-image.jpg'}" 
                     alt="${auction.productData?.title || 'Auction Item'}" 
                     class="auction-image"
                     onerror="this.src='/placeholder-image.jpg'">
                
                <div class="auction-content">
                  <h3 class="auction-title">${auction.productData?.title || 'Auction Item'}</h3>
                  
                  <div class="auction-price">
                    <span class="current-bid">$${auction.currentBid || auction.startingBid}</span>
                    <span class="starting-bid">Starting: $${auction.startingBid}</span>
                  </div>
                  
                  <div class="auction-timer" data-end-time="${auction.endTime}">
                    ${auction.status === 'active' ? 'Loading...' : 'Pending'}
                  </div>
                  
                  <div class="auction-status status-${auction.status}">
                    ${auction.status}
                  </div>
                  
                  <div class="bid-section">
                    <input type="number" 
                           class="bid-input" 
                           placeholder="Min: $${auction.currentBid > 0 ? auction.currentBid + 1 : auction.startingBid}"
                           min="${auction.currentBid > 0 ? auction.currentBid + 1 : auction.startingBid}"
                           step="1">
                    <button class="bid-button" 
                            onclick="placeBid('${auction._id}', this)"
                            ${auction.status !== 'active' ? 'disabled' : ''}>
                      Place Bid
                    </button>
                  </div>
                  
                  ${auction.buyNowPrice ? `
                    <button class="buy-now-button" 
                            onclick="buyNow('${auction._id}')"
                            ${auction.status !== 'active' ? 'disabled' : ''}>
                      Buy Now - $${auction.buyNowPrice}
                    </button>
                  ` : ''}
                  
                  <div class="bid-history">
                    <h4>Recent Bids</h4>
                    <div class="bid-history-list">
                      ${auction.bidHistory.slice(-3).reverse().map(bid => `
                        <div class="bid-item">
                          <span class="bid-amount">$${bid.amount}</span>
                          <span class="bid-bidder">${bid.bidder}</span>
                          <span class="bid-time">${new Date(bid.timestamp).toLocaleTimeString()}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="customer-auth" id="customer-auth">
          <div class="customer-info" id="customer-info" style="display: none;">
            <span class="customer-name" id="customer-name"></span>
            <button class="logout-button" onclick="logout()">Logout</button>
          </div>
          
          <div class="login-form" id="login-form">
            <input type="text" id="bidder-name" placeholder="Your Name" class="login-input">
            <input type="email" id="bidder-email" placeholder="Your Email" class="login-input">
            <button class="login-button" onclick="login()">Login to Bid</button>
          </div>
        </div>
        
        <script>
          // Auction data for JavaScript
          window.auctionData = ${JSON.stringify(auctionsWithRealTimeStatus)};
          window.shopDomain = '${shopDomain}';
          
          // Customer authentication
          let currentCustomer = null;
          
          function initializeCustomerAuth() {
            const savedCustomer = sessionStorage.getItem('bidly-customer');
            if (savedCustomer) {
              currentCustomer = JSON.parse(savedCustomer);
              showCustomerInfo();
            }
          }
          
          function showCustomerInfo() {
            document.getElementById('customer-info').style.display = 'flex';
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('customer-name').textContent = currentCustomer.name;
          }
          
          function showLoginForm() {
            document.getElementById('customer-info').style.display = 'none';
            document.getElementById('login-form').style.display = 'flex';
          }
          
          function login() {
            const name = document.getElementById('bidder-name').value.trim();
            const email = document.getElementById('bidder-email').value.trim();
            
            if (!name || !email) {
              alert('Please enter both name and email');
              return;
            }
            
            currentCustomer = { name, email };
            sessionStorage.setItem('bidly-customer', JSON.stringify(currentCustomer));
            showCustomerInfo();
          }
          
          function logout() {
            currentCustomer = null;
            sessionStorage.removeItem('bidly-customer');
            showLoginForm();
          }
          
          // Timer updates
          function updateTimers() {
            const timers = document.querySelectorAll('.auction-timer[data-end-time]');
            const now = new Date();
            
            timers.forEach(timer => {
              const endTime = new Date(timer.dataset.endTime);
              const diff = endTime - now;
              
              if (diff <= 0) {
                timer.textContent = 'Auction Ended';
                timer.style.background = '#f8d7da';
                timer.style.color = '#721c24';
                timer.style.borderLeftColor = '#e74c3c';
              } else {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                
                timer.textContent = \`\${hours}h \${minutes}m \${seconds}s\`;
              }
            });
          }
          
          // Place bid function
          async function placeBid(auctionId, button) {
            if (!currentCustomer) {
              alert('Please login to place a bid');
              return;
            }
            
            const card = button.closest('.auction-card');
            const input = card.querySelector('.bid-input');
            const amount = parseFloat(input.value);
            
            if (!amount || amount <= 0) {
              alert('Please enter a valid bid amount');
              return;
            }
            
            button.disabled = true;
            button.textContent = 'Placing Bid...';
            
            try {
              const response = await fetch(\`/apps/bidly/api/auctions/\${auctionId}/bid?shop=\${window.shopDomain}\`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  bidder: currentCustomer.name,
                  amount: amount,
                  customerEmail: currentCustomer.email
                })
              });
              
              const result = await response.json();
              
              if (result.success) {
                alert('Bid placed successfully!');
                location.reload(); // Refresh to show updated data
              } else {
                alert('Error: ' + result.message);
              }
            } catch (error) {
              alert('Error placing bid: ' + error.message);
            } finally {
              button.disabled = false;
              button.textContent = 'Place Bid';
            }
          }
          
          // Buy now function
          async function buyNow(auctionId) {
            if (!currentCustomer) {
              alert('Please login to buy now');
              return;
            }
            
            if (!confirm('Are you sure you want to buy this item now?')) {
              return;
            }
            
            try {
              const response = await fetch(\`/apps/bidly/api/auctions/\${auctionId}/buy-now?shop=\${window.shopDomain}\`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  bidder: currentCustomer.name,
                  customerEmail: currentCustomer.email
                })
              });
              
              const result = await response.json();
              
              if (result.success) {
                alert('Purchase successful! You won the auction!');
                location.reload();
              } else {
                alert('Error: ' + result.message);
              }
            } catch (error) {
              alert('Error: ' + error.message);
            }
          }
          
          // Initialize page
          document.addEventListener('DOMContentLoaded', function() {
            initializeCustomerAuth();
            updateTimers();
            setInterval(updateTimers, 1000);
          });
        </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Error rendering auction listing page:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Error</h1>
          <p>Failed to load auctions. Please try again later.</p>
        </body>
      </html>
    `);
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa;
            color: #333;
            line-height: 1.4;
            min-height: 100vh;
          }
          
          .auction-details-page {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }
          
          .auction-details-container {
            flex: 1;
            display: flex;
            background: white;
            margin: 10px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          
          .auction-details-header {
            display: none;
          }
          
          .auction-details-body {
            padding: 0;
            flex: 1;
          }
          
          #bidly-auction-detail-page {
            min-height: 100%;
            display: flex;
            flex-direction: column;
          }
          
          .auction-details-full {
            display: grid;
            grid-template-columns: 1fr 1fr;
            min-height: 500px;
            gap: 0;
          }
          
          .auction-details-image {
            background: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            position: relative;
          }
          
          .auction-main-image {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          
          .auction-details-info {
            padding: 20px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 100%;
            overflow-y: auto;
          }
          
          .auction-title {
            font-size: 1.8rem;
            font-weight: 700;
            color: #333;
            margin-bottom: 15px;
            line-height: 1.2;
          }
          
          .product-description {
            margin: 10px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
            border-left: 3px solid #007bff;
            max-height: 120px;
            overflow-y: auto;
          }
          
          .product-description h3 {
            font-size: 1rem;
            font-weight: 600;
            color: #333;
            margin-bottom: 8px;
          }
          
          .product-description .description-content {
            color: #666;
            line-height: 1.5;
            font-size: 0.9rem;
          }
          
          .product-description-full {
            margin: 10px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
            border-left: 3px solid #007bff;
            max-height: 200px;
            overflow-y: auto;
          }
          
          .product-description-full h3 {
            font-size: 1rem;
            font-weight: 600;
            color: #333;
            margin-bottom: 8px;
          }
          
          .product-description-full .description-content {
            color: #666;
            line-height: 1.5;
            font-size: 0.9rem;
          }
          
          .auction-price-section {
            margin: 10px 0;
            padding: 15px;
            background: #007bff;
            border-radius: 6px;
            color: white;
          }
          
          .auction-price {
            display: flex;
            flex-direction: column;
          }
          
          .price-label {
            font-size: 0.8rem;
            font-weight: 500;
            opacity: 0.9;
            margin-bottom: 3px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .price-amount {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 5px;
            line-height: 1;
          }
          
          .starting-price {
            font-size: 0.9rem;
            opacity: 0.8;
            font-weight: 400;
          }
          
          .auction-timer {
            font-size: 1.1rem;
            font-weight: 600;
            color: #dc3545;
            text-align: center;
            margin: 10px 0;
            padding: 10px;
            background: #fff5f5;
            border: 2px solid #dc3545;
            border-radius: 6px;
          }
          
          .auction-status {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 15px;
            font-weight: 600;
            font-size: 0.8rem;
            margin: 8px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .status-active {
            background: #d4edda;
            color: #155724;
          }
          
          .status-pending {
            background: #fff3cd;
            color: #856404;
          }
          
          .status-ended {
            background: #f8d7da;
            color: #721c24;
          }
          
          .status-closed {
            background: #d1ecf1;
            color: #0c5460;
          }
          
          .auction-bidding-section {
            margin: 10px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
          }
          
          .bid-form {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
            margin-bottom: 10px;
          }
          
          .bid-input {
            flex: 1;
            min-width: 150px;
            padding: 10px 12px;
            border: 2px solid #dee2e6;
            border-radius: 4px;
            font-size: 0.9rem;
            font-weight: 500;
            transition: border-color 0.2s ease;
            background: white;
          }
          
          .bid-input:focus {
            outline: none;
            border-color: #007bff;
          }
          
          .bid-button {
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s ease;
          }
          
          .bid-button:hover {
            background: #0056b3;
          }
          
          .bid-button:disabled {
            background: #6c757d;
            cursor: not-allowed;
          }
          
          .buy-now-button {
            padding: 10px 20px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s ease;
            margin-left: 10px;
          }
          
          .buy-now-button:hover {
            background: #1e7e34;
          }
          
          .auction-bid-history {
            margin: 8px 0;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 4px;
            overflow: visible;
          }
          
          .bid-history-title {
            font-size: 1rem;
            font-weight: 600;
            margin: 0 0 6px 0;
            color: #333;
          }
          
          .bid-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 10px;
            margin: 3px 0;
            background: #f8f9fa;
            border-radius: 4px;
            border-left: 3px solid #28a745;
          }
          
          .bid-amount {
            font-size: 1rem;
            font-weight: 600;
            color: #28a745;
          }
          
          .bid-bidder {
            font-weight: 500;
            color: #333;
            font-size: 0.9rem;
          }
          
          .bid-time {
            font-size: 0.8rem;
            color: #6c757d;
            font-weight: 400;
          }
          
          .customer-auth {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
          }
          
          .auth-form {
            background: white;
            padding: 15px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border: 1px solid #dee2e6;
            min-width: 280px;
          }
          
          .auth-form h3 {
            margin: 0 0 10px 0;
            color: #333;
            font-size: 1.1rem;
            font-weight: 600;
            text-align: center;
          }
          
          .form-group {
            margin-bottom: 10px;
          }
          
          .form-group label {
            display: block;
            margin-bottom: 3px;
            font-weight: 500;
            color: #495057;
            font-size: 0.8rem;
          }
          
          .form-group input {
            width: 100%;
            padding: 8px 10px;
            border: 2px solid #dee2e6;
            border-radius: 4px;
            font-size: 0.9rem;
            transition: border-color 0.2s ease;
            background: #f8f9fa;
          }
          
          .form-group input:focus {
            outline: none;
            border-color: #007bff;
            background: white;
          }
          
          .auth-buttons {
            display: flex;
            gap: 8px;
            margin-top: 10px;
          }
          
          .auth-button {
            flex: 1;
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s ease;
            font-size: 0.8rem;
          }
          
          .login-button {
            background: #007bff;
            color: white;
          }
          
          .logout-button {
            background: #dc3545;
            color: white;
          }
          
          .auth-button:hover {
            opacity: 0.9;
          }
          
          .bidly-loading {
            text-align: center;
            padding: 40px 20px;
            color: #6c757d;
          }
          
          .bidly-spinner {
            width: 30px;
            height: 30px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          /* Responsive Design */
          @media (max-width: 768px) {
            .auction-details-full {
              grid-template-columns: 1fr;
              grid-template-rows: auto 1fr;
            }
            
            .auction-details-image {
              padding: 15px;
            }
            
            .auction-main-image {
              max-height: 200px;
            }
            
            .auction-details-info {
              padding: 15px;
            }
            
            .auction-title {
              font-size: 1.5rem;
            }
            
            .price-amount {
              font-size: 1.8rem;
            }
            
            .bid-form {
              flex-direction: column;
            }
            
            .bid-input {
              min-width: 100%;
            }
            
            .customer-auth {
              position: static;
              margin-bottom: 15px;
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


