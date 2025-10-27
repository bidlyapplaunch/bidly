import cron from 'node-cron';
import winnerProcessingService from './winnerProcessingService.js';
import Auction from '../models/Auction.js';
import Store from '../models/Store.js';

/**
 * Scheduled Jobs Service
 * Handles automatic processing of ended auctions and winner fulfillment
 */
class ScheduledJobsService {
    constructor() {
        this.isRunning = false;
        this.jobs = new Map();
    }

    /**
     * Start all scheduled jobs
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️ Scheduled jobs already running');
            return;
        }

        console.log('🚀 Starting scheduled jobs...');

        // Process ended auctions every 5 minutes
        this.scheduleJob('process-ended-auctions', '*/5 * * * *', async () => {
            await this.processEndedAuctions();
        });

        // Update auction statuses every minute
        this.scheduleJob('update-auction-statuses', '* * * * *', async () => {
            await this.updateAuctionStatuses();
        });

        // Clean up old processed auctions daily at 2 AM
        this.scheduleJob('cleanup-old-auctions', '0 2 * * *', async () => {
            await this.cleanupOldAuctions();
        });

        this.isRunning = true;
        console.log('✅ All scheduled jobs started');
    }

    /**
     * Stop all scheduled jobs
     */
    stop() {
        if (!this.isRunning) {
            console.log('⚠️ Scheduled jobs not running');
            return;
        }

        console.log('🛑 Stopping scheduled jobs...');

        this.jobs.forEach((job, name) => {
            job.stop();
            console.log(`⏹️ Stopped job: ${name}`);
        });

        this.jobs.clear();
        this.isRunning = false;
        console.log('✅ All scheduled jobs stopped');
    }

    /**
     * Schedule a cron job
     */
    scheduleJob(name, cronExpression, task) {
        const job = cron.schedule(cronExpression, async () => {
            try {
                console.log(`🔄 Running scheduled job: ${name}`);
                await task();
                console.log(`✅ Completed scheduled job: ${name}`);
            } catch (error) {
                console.error(`❌ Error in scheduled job ${name}:`, error);
            }
        }, {
            scheduled: false // Don't start immediately
        });

        job.start();
        this.jobs.set(name, job);
        console.log(`⏰ Scheduled job '${name}' with expression: ${cronExpression}`);
    }

    /**
     * Process all ended auctions that haven't been processed yet
     */
    async processEndedAuctions() {
        try {
            console.log('🔍 Checking for ended auctions to process...');

            // Get all stores
            const stores = await Store.find({ accessToken: { $exists: true, $ne: null } });
            
            if (stores.length === 0) {
                console.log('⚠️ No stores with valid access tokens found');
                return;
            }

            let totalProcessed = 0;

            for (const store of stores) {
                try {
                    const processed = await winnerProcessingService.processAllEndedAuctions(store.shopDomain);
                    totalProcessed += processed || 0;
                } catch (error) {
                    console.error(`❌ Error processing auctions for store ${store.shopDomain}:`, error);
                }
            }

            if (totalProcessed > 0) {
                console.log(`✅ Processed ${totalProcessed} ended auctions`);
            } else {
                console.log('ℹ️ No ended auctions to process');
            }

        } catch (error) {
            console.error('❌ Error in processEndedAuctions:', error);
        }
    }

    /**
     * Update auction statuses based on current time
     */
    async updateAuctionStatuses() {
        try {
            const now = new Date();
            
            // Update pending auctions to active
            const pendingToActive = await Auction.updateMany(
                {
                    status: 'pending',
                    startTime: { $lte: now },
                    endTime: { $gt: now }
                },
                {
                    $set: { 
                        status: 'active',
                        updatedAt: now
                    }
                }
            );

            // Update active auctions to ended
            const activeToEnded = await Auction.updateMany(
                {
                    status: 'active',
                    endTime: { $lte: now }
                },
                {
                    $set: { 
                        status: 'ended',
                        updatedAt: now
                    }
                }
            );

            if (pendingToActive.modifiedCount > 0) {
                console.log(`🔄 Updated ${pendingToActive.modifiedCount} auctions from pending to active`);
            }

            if (activeToEnded.modifiedCount > 0) {
                console.log(`🔄 Updated ${activeToEnded.modifiedCount} auctions from active to ended`);
            }

        } catch (error) {
            console.error('❌ Error updating auction statuses:', error);
        }
    }

    /**
     * Clean up old processed auctions (older than 30 days)
     */
    async cleanupOldAuctions() {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const result = await Auction.deleteMany({
                status: 'ended',
                winnerProcessed: true,
                winnerProcessedAt: { $lt: thirtyDaysAgo }
            });

            if (result.deletedCount > 0) {
                console.log(`🧹 Cleaned up ${result.deletedCount} old processed auctions`);
            }

        } catch (error) {
            console.error('❌ Error cleaning up old auctions:', error);
        }
    }

    /**
     * Manually trigger winner processing for a specific auction
     */
    async processWinnerManually(auctionId, shopDomain) {
        try {
            console.log(`🔧 Manually processing winner for auction ${auctionId}`);
            await winnerProcessingService.processAuctionWinner(auctionId, shopDomain);
            console.log(`✅ Manual winner processing completed for auction ${auctionId}`);
        } catch (error) {
            console.error(`❌ Error in manual winner processing:`, error);
            throw error;
        }
    }

    /**
     * Get job status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            jobs: Array.from(this.jobs.keys()),
            jobCount: this.jobs.size
        };
    }
}

export default new ScheduledJobsService();
