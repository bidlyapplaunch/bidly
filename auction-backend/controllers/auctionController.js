import Auction from '../models/Auction.js';
import { AppError } from '../middleware/errorHandler.js';

// Create a new auction
export const createAuction = async (req, res, next) => {
  try {
    const auction = new Auction({
      ...req.body,
      currentBid: 0 // Ensure currentBid starts at 0
    });
    const savedAuction = await auction.save();
    
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
    
    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (shopifyProductId) filter.shopifyProductId = shopifyProductId;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const auctions = await Auction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
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

// Get single auction by ID
export const getAuctionById = async (req, res, next) => {
  try {
    const auction = await Auction.findById(req.params.id);
    
    if (!auction) {
      throw new AppError('Auction not found', 404);
    }
    
    res.json({
      success: true,
      data: auction
    });
  } catch (error) {
    next(error);
  }
};

// Update auction
export const updateAuction = async (req, res, next) => {
  try {
    const auction = await Auction.findById(req.params.id);
    
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
    const auction = await Auction.findById(req.params.id);
    
    if (!auction) {
      throw new AppError('Auction not found', 404);
    }
    
    // Prevent deletion if auction has bids
    if (auction.bidHistory.length > 0) {
      throw new AppError('Cannot delete auction with existing bids', 400);
    }
    
    await Auction.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Auction deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Place a bid on an auction
export const placeBid = async (req, res, next) => {
  try {
    const auction = await Auction.findById(req.params.id);
    
    if (!auction) {
      throw new AppError('Auction not found', 404);
    }
    
    const { bidder, amount } = req.body;
    
    // Validate auction is active
    if (auction.status !== 'active') {
      throw new AppError('Auction is not active', 400);
    }
    
    // Validate auction time
    const now = new Date();
    if (now < auction.startTime || now > auction.endTime) {
      throw new AppError('Auction is not currently active', 400);
    }
    
    // Validate bid amount
    const minBid = auction.currentBid > 0 ? auction.currentBid + 1 : auction.startingBid;
    if (amount < minBid) {
      if (auction.currentBid > 0) {
        throw new AppError(`Bid must be higher than current bid (${auction.currentBid})`, 400);
      } else {
        throw new AppError(`Bid must be at least the starting bid (${auction.startingBid})`, 400);
      }
    }
    
    // Add the bid
    await auction.addBid(bidder, amount);
    
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
    
    // Broadcast real-time update to all clients watching this auction
    const io = req.app.get('io');
    if (io) {
      io.to(`auction-${req.params.id}`).emit('bid-update', {
        auctionId: req.params.id,
        currentBid: updatedAuction.currentBid,
        bidHistory: updatedAuction.bidHistory,
        bidder: bidder,
        amount: amount,
        timestamp: new Date().toISOString(),
        auctionEnded: auctionEnded,
        winner: auctionEnded ? bidder : null
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
    const { bidder } = req.body;
    
    if (!bidder || !bidder.trim()) {
      throw new AppError('Bidder name is required', 400);
    }
    
    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      throw new AppError('Auction not found', 404);
    }
    
    if (auction.status !== 'active') {
      throw new AppError('Auction is not active', 400);
    }
    
    const now = new Date();
    if (now < auction.startTime || now > auction.endTime) {
      throw new AppError('Auction is not currently active', 400);
    }
    
    // Add the buy now bid
    await auction.addBid(bidder.trim(), auction.buyNowPrice);
    
    // End the auction immediately
    auction.status = 'ended';
    auction.endTime = new Date();
    await auction.save();
    
    // Broadcast real-time update to all clients watching this auction
    const io = req.app.get('io');
    if (io) {
      io.to(`auction-${req.params.id}`).emit('bid-update', {
        auctionId: req.params.id,
        currentBid: auction.buyNowPrice,
        bidHistory: auction.bidHistory,
        bidder: bidder.trim(),
        amount: auction.buyNowPrice,
        timestamp: new Date().toISOString(),
        auctionEnded: true,
        winner: bidder.trim(),
        buyNow: true
      });
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

export const getAuctionStats = async (req, res, next) => {
  try {
    const stats = await Auction.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalBids: { $sum: { $size: '$bidHistory' } },
          avgBids: { $avg: { $size: '$bidHistory' } }
        }
      }
    ]);
    
    const totalAuctions = await Auction.countDocuments();
    const pendingAuctions = await Auction.countDocuments({ status: 'pending' });
    const activeAuctions = await Auction.countDocuments({ status: 'active' });
    const endedAuctions = await Auction.countDocuments({ status: 'ended' });
    const closedAuctions = await Auction.countDocuments({ status: 'closed' });
    
    res.json({
      success: true,
      data: {
        totalAuctions,
        pendingAuctions,
        activeAuctions,
        endedAuctions,
        closedAuctions,
        statusBreakdown: stats
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
