import Auction from '../models/Auction.js';
import Store from '../models/Store.js';
import Customer from '../models/Customer.js';
import shopifyGraphQLService from './shopifyGraphQLService.js';
import getShopifyService from './shopifyService.js';
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
        let claimedAuction = null;
        
        if (this.isProcessing.has(processingKey)) {
            console.log(`⏳ Winner processing already in progress for auction ${auctionId}`);
            return;
        }

        this.isProcessing.add(processingKey);

        try {
            console.log(`🏆 Processing winner for auction ${auctionId} in store ${shopDomain}`);

            // Atomically claim the auction to prevent duplicate processing across instances
            const claimFilter = {
                _id: auctionId,
                shopDomain,
                status: 'ended',
                winnerProcessed: { $ne: true },
                $or: [
                    { winnerProcessingLock: { $exists: false } },
                    { winnerProcessingLock: { $ne: true } }
                ]
            };

            const claimUpdate = {
                $set: {
                    winnerProcessingLock: true,
                    updatedAt: new Date()
                }
            };

            claimedAuction = await Auction.findOneAndUpdate(claimFilter, claimUpdate, { new: true });

            if (!claimedAuction) {
                console.log(`⚠️ Winner processing skipped for auction ${auctionId} – already locked or processed`);
                return;
            }
            
            // 2. Determine winner
            const winner = this.determineWinner(claimedAuction);
            
            // 3. Check reserve price
            const reservePrice = claimedAuction.reservePrice || 0;
            const highestBid = claimedAuction.currentBid || 0;
            
            if (reservePrice > 0 && highestBid < reservePrice) {
                // Reserve price not met - mark auction as reserve_not_met
                console.log(`⚠️ Reserve price not met for auction ${auctionId}. Reserve: $${reservePrice}, Highest bid: $${highestBid}`);
                await Auction.findByIdAndUpdate(auctionId, {
                    status: 'reserve_not_met',
                    winner: null,
                    winnerProcessed: true,
                    winnerProcessedAt: new Date(),
                    winnerProcessingLock: false,
                    updatedAt: new Date()
                });
                console.log(`✅ Auction ${auctionId} marked as reserve_not_met`);
                return;
            }
            
            if (!winner) {
                console.log(`⚠️ No winner found for auction ${auctionId}`);
                await Auction.findByIdAndUpdate(auctionId, {
                    $set: {
                        winnerProcessingLock: false,
                        updatedAt: new Date()
                    }
                });
                return;
            }

            let winnerCustomer = null;
            if (winner.customerId) {
                try {
                    winnerCustomer = await Customer.findOne({ _id: winner.customerId, shopDomain });
                } catch (lookupError) {
                    console.warn(`⚠️ Unable to load winner customer ${winner.customerId}:`, lookupError.message);
                }
            }

            const winnerDisplayName = winnerCustomer?.displayName || winner.bidder;
            const baseAlias = winnerDisplayName?.toLowerCase().replace(/\s+/g, '') || 'bidlywinner';
            const resolvedEmail =
                winner.bidderEmail ||
                winnerCustomer?.email ||
                `${baseAlias}@example.com`;
            const winnerFirstName = winnerCustomer?.firstName || null;
            const winnerLastName = winnerCustomer?.lastName || null;
            const enrichedWinner = {
                ...winner,
                bidder: winnerDisplayName,
                bidderEmail: resolvedEmail,
                customerId: winnerCustomer?._id || winner.customerId || null,
                firstName: winnerFirstName,
                lastName: winnerLastName
            };

            // 3. Get store access token
            const store = await this.getStoreAccessToken(shopDomain);
            
            // 4. Get original product details
            const originalProduct = await this.getOriginalProduct(store, claimedAuction.shopifyProductId);
            
            // 5. Create (or reuse) private product for winner (duplicated product)
            let privateProduct = null;

            if (claimedAuction.privateProduct?.productId) {
                console.log(`ℹ️ Existing private product found for auction ${auctionId}, reusing to avoid duplicate creation.`);
                privateProduct = {
                    productId: claimedAuction.privateProduct.productId,
                    productHandle: claimedAuction.privateProduct.productHandle,
                    productTitle: claimedAuction.privateProduct.productTitle,
                    productUrl: claimedAuction.privateProduct.productUrl
                };
            }

            if (!privateProduct) {
                privateProduct = await this.createPrivateProductForWinner(
                    store,
                    originalProduct,
                    enrichedWinner,
                    claimedAuction.currentBid
                );

                const duplicatedProductId = privateProduct.productId.includes('gid://')
                    ? privateProduct.productId.split('/').pop()
                    : privateProduct.productId;

                // Persist the private product info immediately so retries reuse it
                await Auction.findByIdAndUpdate(auctionId, {
                    $set: {
                        privateProduct: {
                            productId: privateProduct.productId,
                            productHandle: privateProduct.productHandle,
                            productTitle: privateProduct.productTitle,
                            productUrl: privateProduct.productUrl,
                            createdAt: new Date()
                        },
                        duplicatedProductId,
                        updatedAt: new Date()
                    }
                });

                // Reflect the persisted data on the in-memory auction document
                claimedAuction.privateProduct = {
                    productId: privateProduct.productId,
                    productHandle: privateProduct.productHandle,
                    productTitle: privateProduct.productTitle,
                    productUrl: privateProduct.productUrl,
                    createdAt: new Date()
                };
                claimedAuction.duplicatedProductId = duplicatedProductId;
            } else if (!claimedAuction.duplicatedProductId) {
                // Ensure duplicatedProductId is populated for downstream logic
                claimedAuction.duplicatedProductId = privateProduct.productId.includes('gid://')
                    ? privateProduct.productId.split('/').pop()
                    : privateProduct.productId;
            }
            
            // 6. Find or create Shopify customer
            const shopifyService = getShopifyService();
            const shopifyCustomer = await shopifyService.findOrCreateCustomer(
                shopDomain,
                resolvedEmail,
                winnerFirstName || winnerDisplayName,
                winnerLastName || ''
            );
            
            // 7. Extract numeric product ID from GraphQL ID (gid://shopify/Product/123 -> 123)
            const duplicatedProductId = claimedAuction.duplicatedProductId || (
                privateProduct.productId.includes('gid://')
                    ? privateProduct.productId.split('/').pop()
                    : privateProduct.productId
            );
            
            // 8. Create draft order with duplicated product
            let draftOrder = null;
            let invoiceSent = false;
            if (claimedAuction.draftOrderId) {
                console.log(`ℹ️ Existing draft order ${claimedAuction.draftOrderId} found for auction ${auctionId}, skipping creation.`);
                draftOrder = { id: claimedAuction.draftOrderId };
            } else {
                draftOrder = await shopifyService.createDraftOrder(
                    shopDomain,
                    shopifyCustomer.id.toString(),
                    duplicatedProductId,
                    claimedAuction.currentBid,
                    `Generated automatically by Bidly Auction App for auction #${auctionId}`
                );
                
                // 9. Send invoice via Shopify
                const invoiceSubject = `Congratulations! You Won the Auction for ${privateProduct.productTitle || claimedAuction.productTitle || 'the auction item'}`;
                const invoiceMessage = `Congratulations! You have successfully won the auction. You have 30 minutes to claim your win, or the second highest bidder will receive the win instead.`;
                
                await shopifyService.sendDraftOrderInvoice(
                    shopDomain,
                    draftOrder.id.toString(),
                    invoiceSubject,
                    invoiceMessage
                );
                invoiceSent = true;
            }
            
            // 10. Update auction with winner, private product, and draft order info
            await this.updateAuctionWithWinnerAndDraftOrder(
                claimedAuction, 
                enrichedWinner, 
                privateProduct, 
                draftOrder.id.toString(),
                duplicatedProductId,
                invoiceSent
            );
            
            // 11. Update customer stats
            await this.updateCustomerStats(winner, claimedAuction);
            
            // 12. Send winner notification email (only notification, no product link)
            await this.sendWinnerNotification(enrichedWinner, claimedAuction, privateProduct, store);
            
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

            if (claimedAuction) {
                await Auction.findByIdAndUpdate(auctionId, {
                    $set: {
                        winnerProcessingLock: false,
                        updatedAt: new Date()
                    }
                });
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
            customerId: winner.customerId || null
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
     * Update auction with winner information and draft order details
     */
    async updateAuctionWithWinnerAndDraftOrder(auction, winner, privateProduct, draftOrderId, duplicatedProductId, invoiceWasSent = true) {
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

        // Save draft order information
        auction.draftOrderId = draftOrderId;
        auction.duplicatedProductId = duplicatedProductId;
        if (invoiceWasSent) {
            auction.invoiceSent = true;
        }

        auction.winnerProcessed = true;
        auction.winnerProcessedAt = new Date();
        auction.winnerProcessingLock = false;

        await auction.save();
        console.log(`📝 Auction updated with winner information and draft order: ${draftOrderId}`);
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
                    winnerProcessingLock: false,
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
     * Send winner notification email (notification only, invoice sent via Shopify)
     */
    async sendWinnerNotification(winner, auction, privateProduct, store) {
        try {
            const emailData = {
                to: winner.bidderEmail,
                subject: `🎉 Congratulations! You Won the Auction for ${privateProduct.productTitle || auction.productTitle || 'the auction item'}`,
                template: 'auction-winner-notification-only',
                data: {
                    winnerName: winner.bidder,
                    productTitle: privateProduct.productTitle || auction.productTitle || 'the auction item',
                    productImage: auction.productImage,
                    winningBid: winner.amount,
                    auctionEndTime: auction.endTime,
                    storeDomain: auction.shopDomain
                }
            };

            await emailService.sendWinnerNotification(emailData, {
                plan: store?.plan,
                storeName: store?.storeName
            });
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
