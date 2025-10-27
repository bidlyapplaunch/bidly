import express from 'express';
import winnerProcessingService from '../services/winnerProcessingService.js';
import scheduledJobsService from '../services/scheduledJobsService.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { extractShopDomain } from '../middleware/storeMiddleware.js';

const router = express.Router();

/**
 * @route POST /api/winner/process/:auctionId
 * @desc Process winner for a specific auction
 * @access Private (Admin)
 */
router.post('/process/:auctionId', requireAuth, extractShopDomain, async (req, res, next) => {
    try {
        const { auctionId } = req.params;
        const shopDomain = req.shopDomain;

        if (!shopDomain) {
            return next(new AppError('Shop domain is required', 400));
        }

        await winnerProcessingService.processAuctionWinner(auctionId, shopDomain);

        res.json({
            success: true,
            message: 'Winner processing completed successfully'
        });

    } catch (error) {
        next(error);
    }
});

/**
 * @route POST /api/winner/process-all
 * @desc Process all ended auctions for a store
 * @access Private (Admin)
 */
router.post('/process-all', requireAuth, extractShopDomain, async (req, res, next) => {
    try {
        const shopDomain = req.shopDomain;

        if (!shopDomain) {
            return next(new AppError('Shop domain is required', 400));
        }

        await winnerProcessingService.processAllEndedAuctions(shopDomain);

        res.json({
            success: true,
            message: 'All ended auctions processed successfully'
        });

    } catch (error) {
        next(error);
    }
});

/**
 * @route POST /api/winner/manual/:auctionId
 * @desc Manually trigger winner processing (bypasses duplicate check)
 * @access Private (Admin)
 */
router.post('/manual/:auctionId', requireAuth, extractShopDomain, async (req, res, next) => {
    try {
        const { auctionId } = req.params;
        const shopDomain = req.shopDomain;

        if (!shopDomain) {
            return next(new AppError('Shop domain is required', 400));
        }

        await scheduledJobsService.processWinnerManually(auctionId, shopDomain);

        res.json({
            success: true,
            message: 'Manual winner processing completed successfully'
        });

    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/winner/status
 * @desc Get scheduled jobs status
 * @access Private (Admin)
 */
router.get('/status', requireAuth, (req, res) => {
    const status = scheduledJobsService.getStatus();
    
    res.json({
        success: true,
        data: status
    });
});

/**
 * @route POST /api/winner/start-jobs
 * @desc Start scheduled jobs
 * @access Private (Admin)
 */
router.post('/start-jobs', requireAuth, (req, res) => {
    try {
        scheduledJobsService.start();
        
        res.json({
            success: true,
            message: 'Scheduled jobs started successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to start scheduled jobs',
            error: error.message
        });
    }
});

/**
 * @route POST /api/winner/stop-jobs
 * @desc Stop scheduled jobs
 * @access Private (Admin)
 */
router.post('/stop-jobs', requireAuth, (req, res) => {
    try {
        scheduledJobsService.stop();
        
        res.json({
            success: true,
            message: 'Scheduled jobs stopped successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to stop scheduled jobs',
            error: error.message
        });
    }
});

export default router;
