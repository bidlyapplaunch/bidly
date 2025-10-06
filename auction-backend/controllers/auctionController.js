import Auction from '../models/Auction.js';
import { AppError } from '../middleware/errorHandler.js';

// Create a new auction
export const createAuction = async (req, res, next) => {
  try {
    const auction = new Auction(req.body);
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
      const restrictedFields = ['startingBid', 'startTime', 'endTime'];
      for (const field of restrictedFields) {
        if (req.body[field] !== undefined) {
          throw new AppError(`Cannot update ${field} after bids have been placed`, 400);
        }
      }
    }
    
    // Update allowed fields
    const allowedUpdates = ['startTime', 'endTime', 'startingBid', 'buyNowPrice', 'status'];
    const updates = {};
    
    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    
    const updatedAuction = await Auction.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
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
    const minBid = auction.currentBid > 0 ? auction.currentBid : auction.startingBid;
    if (amount <= minBid) {
      throw new AppError(`Bid must be higher than current bid (${minBid})`, 400);
    }
    
    // Add the bid
    await auction.addBid(bidder, amount);
    
    // Refresh auction data
    const updatedAuction = await Auction.findById(req.params.id);
    
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
    const activeAuctions = await Auction.countDocuments({ status: 'active' });
    const closedAuctions = await Auction.countDocuments({ status: 'closed' });
    
    res.json({
      success: true,
      data: {
        totalAuctions,
        activeAuctions,
        closedAuctions,
        statusBreakdown: stats
      }
    });
  } catch (error) {
    next(error);
  }
};
