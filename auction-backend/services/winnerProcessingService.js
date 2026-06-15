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

    buildIdempotencyKey(action, auctionId, shopDomain) {
        const cleanAction = (action || 'op').toString().toLowerCase();
        const cleanAuctionId = auctionId ? auctionId.toString() : 'unknown';
        const cleanShop = (shopDomain || 'shop').toString().replace(/[^a-z0-9\-]/gi, '').toLowerCase() || 'shop';
        return `bidly-${cleanAction}-${cleanAuctionId}-${cleanShop}`;
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
                // Check why it was skipped
                const existingAuction = await Auction.findById(auctionId);
                if (existingAuction) {
                    console.log(`⚠️ Winner processing skipped for auction ${auctionId}`);
                    console.log(`   Status: ${existingAuction.status}, WinnerProcessed: ${existingAuction.winnerProcessed}, Lock: ${existingAuction.winnerProcessingLock}`);
                    if (existingAuction.status !== 'ended') {
                        console.log(`   ⚠️ Auction status is '${existingAuction.status}' but should be 'ended'`);
                    }
                    if (existingAuction.winnerProcessed) {
                        console.log(`   ℹ️ Auction already processed`);
                    }
                    if (existingAuction.winnerProcessingLock) {
                        console.log(`   ⚠️ Auction is locked - might be stuck. Lock should clear on completion or error.`);
                    }
                } else {
                    console.log(`⚠️ Auction ${auctionId} not found`);
                }
                return;
            }
            
            // 2. Determine winner
            const winner = this.determineWinner(claimedAuction);
            
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
            
            // CRITICAL: Use winner.amount from bidHistory, NOT currentBid which may be stale
            const winningBidAmount = winner.amount;
            console.log(`🏆 Winner determined: ${winner.bidder} with bid amount: $${winningBidAmount}`);
            console.log(`📊 Auction currentBid: $${claimedAuction.currentBid}, Winner amount from bidHistory: $${winner.amount}`);
            
            if (!winningBidAmount || winningBidAmount <= 0) {
                throw new Error(`Invalid winning bid amount: $${winningBidAmount}. Winner: ${JSON.stringify(winner)}`);
            }
            
            // 3. Check reserve price (use winningBidAmount, not currentBid)
            const reservePrice = claimedAuction.reservePrice || 0;
            
            if (reservePrice > 0 && winningBidAmount < reservePrice) {
                // Reserve price not met - mark auction as reserve_not_met
                console.log(`⚠️ Reserve price not met for auction ${auctionId}. Reserve: $${reservePrice}, Winning bid: $${winningBidAmount}`);
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
                // Use winningBidAmount (already validated above) - this is the CORRECT winning bid from bidHistory
                console.log(`💰 Creating product with winning bid amount: $${winningBidAmount}`);
                
                try {
                    privateProduct = await shopifyGraphQLService.createPrivateProductForWinner(
                        shopDomain,
                        store.accessToken,
                        originalProduct,
                        enrichedWinner,
                        winningBidAmount
                    );

                    const duplicatedProductId = privateProduct.productId.includes('gid://')
                        ? privateProduct.productId.split('/').pop()
                        : privateProduct.productId;

                    // Persist the private product info IMMEDIATELY so retries reuse it
                    // This prevents duplicate product creation on retry
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
                    
                    console.log(`✅ Private product created and saved: ${privateProduct.productId}`);
                } catch (productError) {
                    console.error(`❌ Failed to create private product for auction ${auctionId}:`, productError.message);
                    // Release lock and throw to prevent infinite retries
                    await Auction.findByIdAndUpdate(auctionId, {
                        $set: {
                            winnerProcessingLock: false,
                            updatedAt: new Date()
                        }
                    });
                    throw productError;
                }
            } else {
                // Existing product found - verify its price matches the winning bid
                // If price doesn't match, we need to update it because Shopify uses variant price for draft orders
                console.log(`ℹ️ Existing private product found - verifying price matches winning bid $${winningBidAmount}...`);
                
                const duplicatedProductId = claimedAuction.duplicatedProductId || (
                    privateProduct.productId.includes('gid://')
                        ? privateProduct.productId.split('/').pop()
                        : privateProduct.productId
                );
                
                try {
                    // Get current product variant price
                    const shopifyService = getShopifyService();
                    const productDetails = await shopifyGraphQLService.getProduct(shopDomain, store.accessToken, duplicatedProductId);
                    const currentVariantPrice = parseFloat(productDetails.product.variants.edges[0]?.node?.price || 0);
                    
                    if (Math.abs(currentVariantPrice - winningBidAmount) > 0.01) {
                        console.log(`⚠️ Product variant price is $${currentVariantPrice}, but winning bid is $${winningBidAmount}. Updating variant price...`);
                        
                        // Update variant price to match winning bid
                        const priceUpdateResult = await shopifyGraphQLService.updateProductVariantPrices(
                            shopDomain,
                            store.accessToken,
                            privateProduct.productId,
                            productDetails.product.variants.edges,
                            winningBidAmount
                        );
                        
                        const failedUpdates = priceUpdateResult.variantUpdates.filter(v => !v.success);
                        if (failedUpdates.length > 0) {
                            console.error(`❌ Failed to update variant price:`, failedUpdates);
                            throw new Error(`Failed to update product variant price to winning bid amount: ${failedUpdates.map(v => v.error).join('; ')}`);
                        }
                        
                        console.log(`✅ Product variant price updated to $${winningBidAmount}`);
                    } else {
                        console.log(`✅ Product variant price ($${currentVariantPrice}) already matches winning bid`);
                    }
                } catch (priceCheckError) {
                    console.error(`❌ Error verifying/updating product price:`, priceCheckError.message);
                    // Don't fail completely - try creating draft order anyway, but log the issue
                    console.warn(`⚠️ Continuing with draft order creation despite price check failure`);
                }
                
                // Ensure duplicatedProductId is populated for downstream logic
                if (!claimedAuction.duplicatedProductId) {
                    claimedAuction.duplicatedProductId = duplicatedProductId;
                }
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
            let invoiceSent = Boolean(claimedAuction.invoiceSent);
            
            // winningBidAmount is already validated above - use it directly
            console.log(`💰 Creating draft order with winning bid amount: $${winningBidAmount} (from bidHistory)`);
            
            // NEVER reuse existing draft orders - they may have wrong prices
            // Always create a fresh one with the correct price
            try {
                const draftOrderKey = this.buildIdempotencyKey('draft-order', claimedAuction._id, shopDomain);
                console.log(`📦 Creating draft order for auction ${auctionId} with CORRECT price $${winningBidAmount}...`);
                draftOrder = await shopifyService.createDraftOrder(
                    shopDomain,
                    shopifyCustomer.id.toString(),
                    duplicatedProductId,
                    winningBidAmount, // This is the validated winning bid from bidHistory
                    `Generated automatically by Bidly Auction App for auction #${auctionId}`,
                    {
                        idempotencyKey: draftOrderKey,
                        maxAttempts: 3
                    }
                );
                    
                    // Save draft order ID immediately to prevent duplicate creation on retry
                    await Auction.findByIdAndUpdate(auctionId, {
                        $set: {
                            draftOrderId: draftOrder.id.toString(),
                            updatedAt: new Date()
                        }
                    });
                    claimedAuction.draftOrderId = draftOrder.id.toString();
                    console.log(`✅ Draft order created and saved: ${draftOrder.id}`);
                } catch (draftOrderError) {
                    console.error(`❌ Failed to create draft order for auction ${auctionId}:`, draftOrderError.message);
                    // Release lock and throw to prevent infinite retries
                    await Auction.findByIdAndUpdate(auctionId, {
                        $set: {
                            winnerProcessingLock: false,
                            updatedAt: new Date()
                        }
                    });
                    throw new Error(`Failed to create draft order: ${draftOrderError.message}`);
                }

            if (!invoiceSent) {
                const invoiceSubject = `Congratulations! You Won the Auction for ${privateProduct.productTitle || claimedAuction.productTitle || 'the auction item'}`;
                const invoiceMessage = `Congratulations! You have successfully won the auction. You have 30 minutes to claim your win, or the second highest bidder will receive the win instead.`;
                const invoiceKey = this.buildIdempotencyKey('invoice', claimedAuction._id, shopDomain);

                await shopifyService.sendDraftOrderInvoice(
                    shopDomain,
                    draftOrder.id.toString(),
                    invoiceSubject,
                    invoiceMessage,
                    {
                        idempotencyKey: invoiceKey,
                        maxAttempts: 2
                    }
                );
                invoiceSent = true;
            } else {
                console.log(`ℹ️ Invoice already marked as sent for auction ${auctionId}, skipping resend.`);
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
                // Release the lock but also count the attempt. After MAX_PROCESSING_ATTEMPTS
                // consecutive failures, mark the auction 'failed' so the 5-minute cron stops
                // retrying the same broken auction forever (e.g. a deleted source product). (SVC-18)
                const MAX_PROCESSING_ATTEMPTS = 5;
                const updated = await Auction.findByIdAndUpdate(auctionId, {
                    $set: {
                        winnerProcessingLock: false,
                        processingError: error.message,
                        updatedAt: new Date()
                    },
                    $inc: { processingAttempts: 1 }
                }, { new: true });

                if (updated && (updated.processingAttempts || 0) >= MAX_PROCESSING_ATTEMPTS) {
                    console.error(`❌ Auction ${auctionId} has failed winner processing ${updated.processingAttempts} times — marking as failed to stop retries.`);
                    await this.markAuctionAsFailed(auctionId, error.message);
                }
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
            const currency = store?.currency || auction?.currency || 'USD';
            const formattedBid =
                winner.amount !== undefined && winner.amount !== null
                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(winner.amount))
                    : '';

            await emailService.sendWinnerNotification({
                shopDomain: auction.shopDomain,
                to: winner.bidderEmail,
                templateData: {
                    display_name: winner.bidder,
                    auction_title: privateProduct.productTitle || auction.productTitle || 'the auction item',
                    product_title: privateProduct.productTitle || auction.productTitle || 'the auction item',
                    winning_bid: formattedBid,
                    current_bid: formattedBid,
                    auction_end_time: auction.endTime ? new Date(auction.endTime).toLocaleString() : '',
                    store_name: store?.storeName || winner.shopDomain
                }
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

            let processedCount = 0;
            for (const auction of endedAuctions) {
                try {
                    await this.processAuctionWinner(auction._id, shopDomain);
                    processedCount++;
                } catch (error) {
                    console.error(`Failed to process auction ${auction._id}:`, error);
                    // Continue with other auctions
                }
            }

            console.log(`✅ Batch processing completed for ${shopDomain} (${processedCount}/${endedAuctions.length})`);

            // Return a real count so the scheduled cron can report accurately (SVC-11)
            return processedCount;
        } catch (error) {
            console.error('Error in batch processing:', error);
            throw error;
        }
    }
}

export default new WinnerProcessingService();
