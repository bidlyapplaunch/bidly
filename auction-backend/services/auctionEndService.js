/**
 * Auction End Service
 * Handles auction completion workflow including product duplication and winner notification
 */

import getShopifyService from './shopifyService.js';
import emailService from './emailService.js';

class AuctionEndService {
    /**
     * Process auction end - duplicate product, create draft order, notify winner
     */
    static async processAuctionEnd(auction) {
        try {
            console.log(`🎯 Processing auction end for auction ${auction._id}`);
            
            const { shopDomain, productId, currentBid, bids } = auction;
            
            // Get winner information
            const winner = this.getWinner(bids);
            if (!winner) {
                console.log('❌ No winner found for auction');
                return { success: false, message: 'No winner found' };
            }

            console.log(`🏆 Winner: ${winner.bidderName} (${winner.bidderEmail}) - $${currentBid}`);

            // 1. Duplicate product for winner
            const duplicatedProduct = await this.duplicateProductForWinner(shopDomain, productId, currentBid);
            if (!duplicatedProduct.success) {
                throw new Error(`Failed to duplicate product: ${duplicatedProduct.message}`);
            }

            // 2. Create draft order for winner
            const draftOrder = await this.createDraftOrderForWinner(
                shopDomain, 
                duplicatedProduct.productId, 
                duplicatedProduct.variantId, 
                currentBid, 
                winner
            );
            if (!draftOrder.success) {
                throw new Error(`Failed to create draft order: ${draftOrder.message}`);
            }

            // 3. Send checkout link to winner
            await this.sendWinnerNotification(winner, draftOrder.checkoutUrl, currentBid, auction);

            // 4. Update auction record
            await this.updateAuctionRecord(auction._id, {
                status: 'completed',
                winnerEmail: winner.bidderEmail,
                winnerName: winner.bidderName,
                privateProductId: duplicatedProduct.productId,
                draftOrderId: draftOrder.draftOrderId,
                completedAt: new Date()
            });

            console.log(`✅ Auction end processed successfully for auction ${auction._id}`);
            return { 
                success: true, 
                message: 'Auction end processed successfully',
                winner: winner,
                privateProductId: duplicatedProduct.productId,
                draftOrderId: draftOrder.draftOrderId
            };

        } catch (error) {
            console.error('❌ Error processing auction end:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Get winner from bids (highest bidder)
     */
    static getWinner(bids) {
        if (!bids || bids.length === 0) return null;
        
        // Sort bids by amount descending and get the highest
        const sortedBids = bids.sort((a, b) => b.amount - a.amount);
        const winner = sortedBids[0];
        
        return {
            bidderName: winner.bidderName,
            bidderEmail: winner.bidderEmail,
            bidAmount: winner.amount,
            bidTime: winner.createdAt
        };
    }

    /**
     * Duplicate product for winner using Shopify GraphQL API
     */
    static async duplicateProductForWinner(shopDomain, originalProductId, winningBid) {
        try {
            const shopify = getShopifyService().getClient(shopDomain);
            
            // First, get the original product
            const originalProduct = await shopify.product.get(originalProductId);
            
            // Create new product data
            const newProductData = {
                title: `${originalProduct.title} (Auction Winner)`,
                body_html: originalProduct.body_html,
                vendor: originalProduct.vendor,
                product_type: originalProduct.product_type,
                status: 'draft', // Hidden from public
                tags: [...(originalProduct.tags || []), 'auction-winner', 'private'],
                images: originalProduct.images,
                variants: [{
                    price: winningBid.toString(),
                    compare_at_price: originalProduct.variants[0]?.price || winningBid.toString(),
                    inventory_management: 'shopify',
                    inventory_quantity: 1,
                    requires_shipping: true,
                    taxable: true,
                    weight: originalProduct.variants[0]?.weight || 0,
                    weight_unit: originalProduct.variants[0]?.weight_unit || 'kg'
                }]
            };

            // Create the new product
            const newProduct = await shopify.product.create(newProductData);
            
            console.log(`✅ Product duplicated: ${newProduct.id}`);
            
            return {
                success: true,
                productId: newProduct.id,
                variantId: newProduct.variants[0].id,
                productHandle: newProduct.handle
            };

        } catch (error) {
            console.error('❌ Error duplicating product:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Create draft order for winner using Shopify GraphQL API
     */
    static async createDraftOrderForWinner(shopDomain, productId, variantId, winningBid, winner) {
        try {
            const shopify = getShopifyService().getClient(shopDomain);
            
            // Create draft order
            const draftOrderData = {
                line_items: [{
                    variant_id: variantId,
                    quantity: 1,
                    price: winningBid
                }],
                customer: {
                    email: winner.bidderEmail,
                    first_name: winner.bidderName.split(' ')[0],
                    last_name: winner.bidderName.split(' ').slice(1).join(' ') || ''
                },
                note: `Auction item won for $${winningBid}`,
                tags: ['auction-winner', 'private-sale']
            };

            const draftOrder = await shopify.draftOrder.create(draftOrderData);
            
            // Get checkout URL
            const checkoutUrl = `https://${shopDomain}/checkout/${draftOrder.id}`;
            
            console.log(`✅ Draft order created: ${draftOrder.id}`);
            
            return {
                success: true,
                draftOrderId: draftOrder.id,
                checkoutUrl: checkoutUrl
            };

        } catch (error) {
            console.error('❌ Error creating draft order:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Send winner notification email
     */
    static async sendWinnerNotification(winner, checkoutUrl, winningBid, auction) {
        try {
            const emailData = {
                to: winner.bidderEmail,
                subject: `🎉 Congratulations! You won the auction for $${winningBid}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2c3e50;">🎉 Congratulations! You Won!</h2>
                        
                        <p>Dear ${winner.bidderName},</p>
                        
                        <p>Congratulations! You have won the auction with a bid of <strong>$${winningBid}</strong>!</p>
                        
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">Auction Details:</h3>
                            <p><strong>Product:</strong> ${auction.productTitle || 'Auction Item'}</p>
                            <p><strong>Your Winning Bid:</strong> $${winningBid}</p>
                            <p><strong>Won At:</strong> ${new Date().toLocaleString()}</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${checkoutUrl}" 
                               style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                                Complete Your Purchase
                            </a>
                        </div>
                        
                        <p><strong>Next Steps:</strong></p>
                        <ol>
                            <li>Click the "Complete Your Purchase" button above</li>
                            <li>Complete your checkout process</li>
                            <li>You'll receive a confirmation email once payment is processed</li>
                        </ol>
                        
                        <p style="color: #6c757d; font-size: 14px;">
                            This is a private checkout link created specifically for you as the auction winner. 
                            Please complete your purchase within 7 days.
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
                        <p style="color: #6c757d; font-size: 12px;">
                            If you have any questions, please contact us at support@bidly.com
                        </p>
                    </div>
                `
            };

            await emailService.sendEmail(emailData);
            console.log(`✅ Winner notification sent to ${winner.bidderEmail}`);
            
            return { success: true };

        } catch (error) {
            console.error('❌ Error sending winner notification:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Update auction record with completion details
     */
    static async updateAuctionRecord(auctionId, updateData) {
        try {
            const Auction = (await import('../models/Auction.js')).default;
            await Auction.findByIdAndUpdate(auctionId, updateData);
            console.log(`✅ Auction record updated: ${auctionId}`);
            return { success: true };
        } catch (error) {
            console.error('❌ Error updating auction record:', error);
            return { success: false, message: error.message };
        }
    }
}

export default AuctionEndService;
