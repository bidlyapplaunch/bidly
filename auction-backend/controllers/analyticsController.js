import Auction from '../models/Auction.js';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';

// Get comprehensive analytics
export const getAnalytics = async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;
    
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

    // Basic auction statistics
    const totalAuctions = await Auction.countDocuments();
    const activeAuctions = await Auction.countDocuments({ status: 'active' });
    const endedAuctions = await Auction.countDocuments({ status: 'ended' });
    const pendingAuctions = await Auction.countDocuments({ status: 'pending' });

    // Revenue analytics
    const auctionsWithBids = await Auction.find({
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
    const dailyStats = await getDailyStats(startDate, now);
    
    // Top performing auctions
    const topAuctions = await Auction.find({
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
      ended: endedAuctions
    };

    // Recent activity
    const recentAuctions = await Auction.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('shopifyProductId productData status currentBid createdAt');

    res.json({
      success: true,
      data: {
        summary: {
          totalAuctions,
          activeAuctions,
          endedAuctions,
          pendingAuctions,
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
        recentActivity: recentAuctions,
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
    
    const now = new Date();
    const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Revenue by status
    const revenueByStatus = await Auction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          currentBid: { $gt: 0 }
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
          createdAt: { $gte: startDate },
          currentBid: { $gt: 0 }
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
async function getDailyStats(startDate, endDate) {
  const dailyStats = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayStart = new Date(currentDate);
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    const dayAuctions = await Auction.find({
      createdAt: { $gte: dayStart, $lte: dayEnd }
    });
    
    const dayRevenue = dayAuctions.reduce((sum, auction) => {
      return sum + (auction.currentBid || 0);
    }, 0);
    
    const dayBids = dayAuctions.reduce((sum, auction) => {
      return sum + (auction.bidHistory?.length || 0);
    }, 0);
    
    dailyStats.push({
      date: currentDate.toISOString().split('T')[0],
      auctions: dayAuctions.length,
      revenue: dayRevenue,
      bids: dayBids
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dailyStats;
}
