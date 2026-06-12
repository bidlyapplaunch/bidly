import Auction from '../models/Auction.js';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import { computeAuctionStatus } from '../utils/auctionStatus.js';

const normalizeShopDomain = (shop = '') =>
  shop
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

const resolveShopDomain = (req) => {
  if (req.shopDomain) {
    return req.shopDomain;
  }

  const fallback =
    req.query?.shop ||
    req.headers['x-shopify-shop-domain'] ||
    req.body?.shop;

  return fallback ? normalizeShopDomain(fallback) : null;
};

// Get comprehensive analytics
export const getAnalytics = async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;
    const shopDomain = resolveShopDomain(req);

    if (!shopDomain) {
      return next(new AppError('Shop domain is required for analytics', 400));
    }
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const baseFilter = { shopDomain, isDeleted: false };

    // Basic auction statistics — only load the fields needed to compute status counts.
    // (BACKEND-04: previously loaded every auction with full bidHistory/productData into
    // memory. BACKEND-13: status computed via the shared computeAuctionStatus util.)
    const allAuctions = await Auction.find(baseFilter)
      .select('status startTime endTime')
      .lean();

    const totalAuctions = allAuctions.length;
    const activeAuctions = allAuctions.filter(auction => computeAuctionStatus(auction) === 'active').length;
    const endedAuctions = allAuctions.filter(auction => computeAuctionStatus(auction) === 'ended').length;
    const pendingAuctions = allAuctions.filter(auction => computeAuctionStatus(auction) === 'pending').length;
    const closedAuctions = allAuctions.filter(auction => computeAuctionStatus(auction) === 'closed').length;

    // Revenue analytics
    const auctionsWithBids = await Auction.find({
      ...baseFilter,
      currentBid: { $gt: 0 },
      createdAt: { $gte: startDate }
    });

    const totalRevenue = auctionsWithBids.reduce((sum, auction) => {
      return sum + (auction.currentBid || 0);
    }, 0);

    const averageBidAmount = auctionsWithBids.length > 0 
      ? totalRevenue / auctionsWithBids.length 
      : 0;

    // Bid analytics
    const totalBids = auctionsWithBids.reduce((sum, auction) => {
      return sum + (auction.bidHistory?.length || 0);
    }, 0);

    const averageBidsPerAuction = auctionsWithBids.length > 0
      ? totalBids / auctionsWithBids.length
      : 0;

    // Time-based analytics (daily breakdown for the period)
    const dailyStats = await getDailyStats(baseFilter, startDate, now);
    
    // Top performing auctions
    const topAuctions = await Auction.find({
      ...baseFilter,
      status: 'ended',
      currentBid: { $gt: 0 }
    })
    .sort({ currentBid: -1 })
    .limit(10)
    .select('shopifyProductId productData currentBid bidHistory createdAt');

    // User analytics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });

    // Auction success rate
    const auctionsWithAnyBids = await Auction.countDocuments({
      ...baseFilter,
      'bidHistory.0': { $exists: true },
      createdAt: { $gte: startDate }
    });
    
    const successRate = totalAuctions > 0 
      ? (auctionsWithAnyBids / totalAuctions) * 100 
      : 0;

    // Status breakdown
    const statusBreakdown = {
      pending: pendingAuctions,
      active: activeAuctions,
      ended: endedAuctions,
      closed: closedAuctions
    };

    // Recent activity
    const recentAuctions = await Auction.find(baseFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .select('shopifyProductId productData status currentBid createdAt startTime endTime');
    
    // Add computed status to recent auctions
    const recentActivity = recentAuctions.map(auction => ({
      ...auction.toObject(),
      status: computeAuctionStatus(auction)
    }));

    res.json({
      success: true,
      data: {
        summary: {
          totalAuctions,
          activeAuctions,
          endedAuctions,
          pendingAuctions,
          closedAuctions,
          totalUsers,
          activeUsers,
          adminUsers
        },
        revenue: {
          totalRevenue,
          averageBidAmount,
          currency: 'USD'
        },
        bidding: {
          totalBids,
          averageBidsPerAuction,
          successRate: Math.round(successRate * 100) / 100
        },
        dailyStats,
        topAuctions,
        statusBreakdown,
        recentActivity: recentActivity,
        period,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get revenue analytics
export const getRevenueAnalytics = async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;
    const shopDomain = resolveShopDomain(req);

    if (!shopDomain) {
      return next(new AppError('Shop domain is required for analytics', 400));
    }
    
    const now = new Date();
    const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const baseMatch = {
      shopDomain,
      isDeleted: false,
      createdAt: { $gte: startDate },
      currentBid: { $gt: 0 }
    };

    // Revenue by status
    const revenueByStatus = await Auction.aggregate([
      {
        $match: {
          ...baseMatch
        }
      },
      {
        $group: {
          _id: '$status',
          totalRevenue: { $sum: '$currentBid' },
          averageRevenue: { $avg: '$currentBid' },
          auctionCount: { $sum: 1 }
        }
      }
    ]);

    // Monthly revenue trend
    const monthlyRevenue = await Auction.aggregate([
      {
        $match: {
          ...baseMatch
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$currentBid' },
          auctionCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        revenueByStatus,
        monthlyTrend: monthlyRevenue,
        period,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get user analytics
export const getUserAnalytics = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const customerUsers = await User.countDocuments({ role: 'customer' });

    // Recent user registrations
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name email role createdAt lastLogin');

    // User registration trend
    const registrationTrend = await User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalUsers,
          activeUsers,
          adminUsers,
          customerUsers,
          inactiveUsers: totalUsers - activeUsers
        },
        recentUsers,
        registrationTrend,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to get daily statistics
async function getDailyStats(baseFilter, startDate, endDate) {
  // Single aggregation bucketed by day (BACKEND-03). Previously this ran one Auction.find()
  // per day in a while-loop — up to 365 sequential queries (each pulling full documents) for
  // a 1y range, which made the analytics dashboard extremely slow.
  const results = await Auction.aggregate([
    {
      $match: {
        ...baseFilter,
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        auctions: { $sum: 1 },
        revenue: { $sum: { $ifNull: ['$currentBid', 0] } },
        bids: { $sum: { $size: { $ifNull: ['$bidHistory', []] } } }
      }
    }
  ]);

  const byDate = new Map(results.map(r => [r._id, r]));

  // Fill the full day range so days with no activity still appear as zeros.
  const dailyStats = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const key = currentDate.toISOString().split('T')[0];
    const entry = byDate.get(key);
    dailyStats.push({
      date: key,
      auctions: entry?.auctions || 0,
      revenue: entry?.revenue || 0,
      bids: entry?.bids || 0
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dailyStats;
}
