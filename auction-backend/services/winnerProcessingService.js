import Auction from '../models/Auction.js';
import Store from '../models/Store.js';
import Customer from '../models/Customer.js';
import shopifyGraphQLService from './shopifyGraphQLService.js';
import emailService from './emailService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Auction Winner Processing Service
 * Handles the complete workflow when an auction ends
 */
class WinnerProcessingService {
    constructor() {
        this.isProcessing = new Set(); // Prevent duplicate processing
    }

    /**
     * Process auction winner - main entry point
     */
    async processAuctionWinner(auctionId, shopDomain) {
        const processingKey = `${auctionId}-${shopDomain}`;
        
        if (this.isProcessing.has(processingKey)) {
            console.log(`⏳ Winner processing already in progress for auction ${auctionId}`);
            return;
        }

        this.isProcessing.add(processingKey);

        try {
            console.log(`🏆 Processing winner for auction ${auctionId} in store ${shopDomain}`);

            // 1. Get auction and validate it has ended
            const auction = await this.getEndedAuction(auctionId, shopDomain);
            
            // 2. Determine winner
            const winner = this.determineWinner(auction);
            
            // 3. Check reserve price
            const reservePrice = auction.reservePrice || 0;
            const highestBid = auction.currentBid || 0;
            
            if (reservePrice > 0 && highestBid < reservePrice) {
                // Reserve price not met - mark auction as reserve_not_met
                console.log(`⚠️ Reserve price not met for auction ${auctionId}. Reserve: $${reservePrice}, Highest bid: $${highestBid}`);
                await Auction.findByIdAndUpdate(auctionId, {
                    status: 'reserve_not_met',
                    winner: null,
                    winnerProcessed: true,
                    winnerProcessedAt: new Date()
                });
                console.log(`✅ Auction ${auctionId} marked as reserve_not_met`);
                return;
            }
            
            if (!winner) {
                console.log(`⚠️ No winner found for auction ${auctionId}`);
                return;
            }

            // 3. Get store access token
            const store = await this.getStoreAccessToken(shopDomain);
            
            // 4. Get original product details
            const originalProduct = await this.getOriginalProduct(store, auction.shopifyProductId);
            
            // 5. Create private product for winner
            const privateProduct = await this.createPrivateProductForWinner(
                store, 
                originalProduct, 
                winner, 
                auction.currentBid
            );
            
            // 6. Update auction with winner and private product info
            await this.updateAuctionWithWinner(auction, winner, privateProduct);
            
            // 7. Update customer stats
            await this.updateCustomerStats(winner, auction);
            
            // 8. Send winner notification email
            await this.sendWinnerNotification(winner, auction, privateProduct);
            
            console.log(`✅ Winner processing completed for auction ${auctionId}`);
            
        } catch (error) {
            console.error(`❌ Error processing winner for auction ${auctionId}:`, error);
            
            // Handle specific error types gracefully
            if (error.statusCode === 401) {
                console.error(`⚠️ Skipping auction ${auctionId} due to invalid access token. Store needs to reinstall the app.`);
                // Mark auction as failed but don't throw to prevent blocking other auctions
                await this.markAuctionAsFailed(auctionId, error.message);
                return;
            }
            
            throw error;
        } finally {
            this.isProcessing.delete(processingKey);
        }
    }

    /**
     * Get ended auction and validate
     */
    async getEndedAuction(auctionId, shopDomain) {
        const auction = await Auction.findOne({ 
            _id: auctionId, 
            shopDomain,
            status: 'ended',
            isDeleted: { $ne: true } // Exclude soft-deleted auctions
        });

        if (!auction) {
            throw new AppError('Auction not found or not ended', 404);
        }

        if (auction.winnerProcessed) {
            throw new AppError('Winner already processed for this auction', 400);
        }

        return auction;
    }

    /**
     * Determine the winner from bid history
     */
    determineWinner(auction) {
        if (!auction.bidHistory || auction.bidHistory.length === 0) {
            return null;
        }

        // Sort by amount descending and timestamp ascending (earliest highest bid wins)
        const sortedBids = auction.bidHistory.sort((a, b) => {
            if (b.amount !== a.amount) {
                return b.amount - a.amount;
            }
            return new Date(a.timestamp) - new Date(b.timestamp);
        });

        const winner = sortedBids[0];
        
        return {
            bidder: winner.bidder,
            bidderEmail: winner.bidderEmail || winner.customerEmail,
            amount: winner.amount,
            timestamp: winner.timestamp,
            customerId: winner.customerId
        };
    }

    /**
     * Get store access token
     */
    async getStoreAccessToken(shopDomain) {
        const store = await Store.findOne({ shopDomain }).select('+accessToken');
        
        if (!store) {
            throw new AppError('Store not found', 404);
        }

        if (!store.accessToken) {
            throw new AppError('Store access token not available', 400);
        }

        return {
            domain: shopDomain,
            accessToken: store.accessToken
        };
    }

    /**
     * Get original product details from Shopify
     */
    async getOriginalProduct(store, shopifyProductId) {
        try {
            const productData = await shopifyGraphQLService.getProduct(
                store.domain,
                store.accessToken,
                shopifyProductId
            );

            if (!productData.product) {
                throw new AppError('Original product not found in Shopify', 404);
            }

            return productData.product;
        } catch (error) {
            console.error('Error fetching original product:', error);
            
            // Handle specific error types
            if (error.response?.status === 401) {
                throw new AppError('Invalid or expired Shopify access token. Please reinstall the app.', 401);
            } else if (error.response?.status === 404) {
                throw new AppError('Original product not found in Shopify', 404);
            } else {
                throw new AppError('Failed to fetch original product details', 500);
            }
        }
    }

    /**
     * Create private product for winner
     */
    async createPrivateProductForWinner(store, originalProduct, winner, winningBidAmount) {
        try {
            console.log(`🔄 Creating private product for winner ${winner.bidder}`);
            
            const privateProduct = await shopifyGraphQLService.createPrivateProductForWinner(
                store.domain,
                store.accessToken,
                originalProduct,
                winner,
                winningBidAmount
            );

            console.log(`✅ Private product created: ${privateProduct.productUrl}`);
            return privateProduct;
            
        } catch (error) {
            console.error('Error creating private product:', error);
            throw new AppError('Failed to create private product for winner', 500);
        }
    }

    /**
     * Update auction with winner information
     */
    async updateAuctionWithWinner(auction, winner, privateProduct) {
        auction.winner = {
            bidder: winner.bidder,
            bidderEmail: winner.bidderEmail,
            amount: winner.amount,
            timestamp: winner.timestamp,
            customerId: winner.customerId
        };

        auction.privateProduct = {
            productId: privateProduct.productId,
            productHandle: privateProduct.productHandle,
            productTitle: privateProduct.productTitle,
            productUrl: privateProduct.productUrl,
            createdAt: new Date()
        };

        auction.winnerProcessed = true;
        auction.winnerProcessedAt = new Date();

        await auction.save();
        console.log(`📝 Auction updated with winner information`);
    }

    /**
     * Update customer statistics
     */
    async updateCustomerStats(winner, auction) {
        if (!winner.customerId) {
            console.log('⚠️ No customer ID for winner, skipping stats update');
            return;
        }

        try {
            const customer = await Customer.findById(winner.customerId);
            
            if (customer) {
                // Update customer stats
                customer.auctionsWon += 1;
                customer.totalBidAmount += winner.amount;
                
                // Update bid history to mark this as winning bid
                const bidIndex = customer.bidHistory.findIndex(
                    bid => bid.auctionId.toString() === auction._id.toString() && 
                           bid.amount === winner.amount
                );
                
                if (bidIndex !== -1) {
                    customer.bidHistory[bidIndex].isWinning = true;
                }

                await customer.save();
                console.log(`📊 Customer stats updated for ${customer.fullName}`);
            }
        } catch (error) {
            console.error('Error updating customer stats:', error);
            // Don't throw error as this is not critical
        }
    }

    /**
     * Mark auction as failed due to processing error
     */
    async markAuctionAsFailed(auctionId, errorMessage) {
        try {
            await Auction.findByIdAndUpdate(auctionId, {
                $set: {
                    status: 'failed',
                    winnerProcessed: false,
                    processingError: errorMessage,
                    updatedAt: new Date()
                }
            });
            console.log(`⚠️ Marked auction ${auctionId} as failed: ${errorMessage}`);
        } catch (error) {
            console.error('Error marking auction as failed:', error);
        }
    }

    /**
     * Send winner notification email
     */
    async sendWinnerNotification(winner, auction, privateProduct) {
        try {
            const emailData = {
                to: winner.bidderEmail,
                subject: `🎉 Congratulations! You Won the Auction for ${privateProduct.productTitle || auction.productTitle || 'the auction item'}`,
                template: 'auction-winner',
                data: {
                    winnerName: winner.bidder,
                    productTitle: privateProduct.productTitle || auction.productTitle || 'the auction item',
                    productImage: auction.productImage,
                    winningBid: winner.amount,
                    auctionEndTime: auction.endTime,
                    privateProductUrl: privateProduct.productUrl,
                    productHandle: privateProduct.productHandle,
                    storeDomain: auction.shopDomain
                }
            };

            await emailService.sendWinnerNotification(emailData);
            console.log(`📧 Winner notification sent to ${winner.bidderEmail}`);
            
        } catch (error) {
            console.error('Error sending winner notification:', error);
            // Don't throw error as email is not critical for the main flow
        }
    }

    /**
     * Process all ended auctions (for batch processing)
     */
    async processAllEndedAuctions(shopDomain) {
        try {
            const endedAuctions = await Auction.find({
                shopDomain,
                status: 'ended',
                winnerProcessed: { $ne: true }
            });

            console.log(`🔄 Processing ${endedAuctions.length} ended auctions for ${shopDomain}`);

            for (const auction of endedAuctions) {
                try {
                    await this.processAuctionWinner(auction._id, shopDomain);
                } catch (error) {
                    console.error(`Failed to process auction ${auction._id}:`, error);
                    // Continue with other auctions
                }
            }

            console.log(`✅ Batch processing completed for ${shopDomain}`);
            
        } catch (error) {
            console.error('Error in batch processing:', error);
            throw error;
        }
    }
}

export default new WinnerProcessingService();
