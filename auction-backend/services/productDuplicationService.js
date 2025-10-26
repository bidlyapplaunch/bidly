import { getShopifyClient } from './shopifyService.js';

class ProductDuplicationService {
  /**
   * Duplicate a product for auction winner with winning bid price
   * @param {string} shop - Shop domain
   * @param {string} originalProductId - Original product ID
   * @param {number} winningBid - Winning bid amount
   * @param {string} winnerEmail - Winner's email
   * @param {string} winnerName - Winner's name
   * @returns {Object} Duplicated product and private link
   */
  static async duplicateProductForWinner(shop, originalProductId, winningBid, winnerEmail, winnerName) {
    try {
      console.log('🔄 Duplicating product for auction winner:', {
        shop,
        originalProductId,
        winningBid,
        winnerEmail,
        winnerName
      });

      const shopify = getShopifyClient(shop);
      if (!shopify) {
        throw new Error('Shop not found or invalid credentials');
      }

      // Get original product
      const originalProduct = await shopify.product.get(originalProductId);
      if (!originalProduct) {
        throw new Error('Original product not found');
      }

      // Create duplicate product data
      const duplicateData = {
        title: `${originalProduct.title} (Auction Winner - ${winnerName})`,
        body_html: originalProduct.body_html,
        vendor: originalProduct.vendor,
        product_type: originalProduct.product_type,
        tags: [...(originalProduct.tags || []), 'auction-winner', 'private-access'],
        status: 'draft', // Start as draft for private access
        variants: originalProduct.variants.map(variant => ({
          price: winningBid.toString(),
          compare_at_price: variant.compare_at_price,
          sku: variant.sku ? `${variant.sku}-AUCTION-WINNER` : undefined,
          inventory_quantity: 1, // Only 1 available for winner
          inventory_management: 'shopify',
          inventory_policy: 'deny',
          fulfillment_service: 'manual',
          requires_shipping: variant.requires_shipping,
          taxable: variant.taxable,
          weight: variant.weight,
          weight_unit: variant.weight_unit,
          option1: variant.option1,
          option2: variant.option2,
          option3: variant.option3
        })),
        options: originalProduct.options,
        images: originalProduct.images.map(image => ({
          src: image.src,
          alt: image.alt,
          position: image.position
        })),
        metafields: [
          {
            namespace: 'auction_winner',
            key: 'original_product_id',
            value: originalProductId,
            type: 'single_line_text_field'
          },
          {
            namespace: 'auction_winner',
            key: 'winning_bid',
            value: winningBid.toString(),
            type: 'number_decimal'
          },
          {
            namespace: 'auction_winner',
            key: 'winner_email',
            value: winnerEmail,
            type: 'single_line_text_field'
          },
          {
            namespace: 'auction_winner',
            key: 'winner_name',
            value: winnerName,
            type: 'single_line_text_field'
          },
          {
            namespace: 'auction_winner',
            key: 'created_at',
            value: new Date().toISOString(),
            type: 'date_time'
          },
          {
            namespace: 'auction_winner',
            key: 'access_token',
            value: this.generateAccessToken(winnerEmail, originalProductId),
            type: 'single_line_text_field'
          }
        ]
      };

      // Create the duplicate product
      const duplicateProduct = await shopify.product.create(duplicateData);
      
      if (!duplicateProduct) {
        throw new Error('Failed to create duplicate product');
      }

      // Generate private access link
      const privateLink = this.generatePrivateLink(shop, duplicateProduct.id, winnerEmail, originalProductId);

      console.log('✅ Product duplicated successfully:', {
        duplicateProductId: duplicateProduct.id,
        privateLink
      });

      return {
        success: true,
        duplicateProduct,
        privateLink,
        message: 'Product duplicated successfully for auction winner'
      };

    } catch (error) {
      console.error('❌ Error duplicating product for winner:', error);
      throw error;
    }
  }

  /**
   * Generate a secure access token for the private product
   * @param {string} winnerEmail - Winner's email
   * @param {string} originalProductId - Original product ID
   * @returns {string} Access token
   */
  static generateAccessToken(winnerEmail, originalProductId) {
    const crypto = require('crypto');
    const data = `${winnerEmail}-${originalProductId}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate private access link for the winner
   * @param {string} shop - Shop domain
   * @param {string} productId - Duplicate product ID
   * @param {string} winnerEmail - Winner's email
   * @param {string} originalProductId - Original product ID
   * @returns {string} Private access link
   */
  static generatePrivateLink(shop, productId, winnerEmail, originalProductId) {
    const accessToken = this.generateAccessToken(winnerEmail, originalProductId);
    return `https://${shop}/products/auction-winner-${productId}?token=${accessToken}&email=${encodeURIComponent(winnerEmail)}`;
  }

  /**
   * Verify access token for private product
   * @param {string} token - Access token
   * @param {string} email - User's email
   * @param {string} productId - Product ID
   * @returns {boolean} Is valid access
   */
  static verifyAccessToken(token, email, productId) {
    try {
      // This would need to be implemented with proper token verification
      // For now, we'll use a simple approach
      return token && email && productId;
    } catch (error) {
      console.error('Error verifying access token:', error);
      return false;
    }
  }

  /**
   * Get winner's private product by access token
   * @param {string} shop - Shop domain
   * @param {string} productId - Product ID
   * @param {string} token - Access token
   * @param {string} email - User's email
   * @returns {Object} Product data if access is valid
   */
  static async getWinnerProduct(shop, productId, token, email) {
    try {
      const shopify = getShopifyClient(shop);
      if (!shopify) {
        throw new Error('Shop not found or invalid credentials');
      }

      // Get the product
      const product = await shopify.product.get(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      // Check if it's a winner product
      const winnerMetafield = product.metafields?.find(
        mf => mf.namespace === 'auction_winner' && mf.key === 'access_token'
      );

      if (!winnerMetafield || winnerMetafield.value !== token) {
        throw new Error('Invalid access token');
      }

      // Check winner email
      const winnerEmailMetafield = product.metafields?.find(
        mf => mf.namespace === 'auction_winner' && mf.key === 'winner_email'
      );

      if (!winnerEmailMetafield || winnerEmailMetafield.value !== email) {
        throw new Error('Access denied - email mismatch');
      }

      return {
        success: true,
        product,
        isWinnerProduct: true
      };

    } catch (error) {
      console.error('Error getting winner product:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clean up old winner products (optional cleanup function)
   * @param {string} shop - Shop domain
   * @param {number} daysOld - Days old to clean up
   * @returns {Object} Cleanup results
   */
  static async cleanupOldWinnerProducts(shop, daysOld = 30) {
    try {
      const shopify = getShopifyClient(shop);
      if (!shopify) {
        throw new Error('Shop not found or invalid credentials');
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Get all products with auction_winner metafields
      const products = await shopify.product.list({ limit: 250 });
      const oldWinnerProducts = [];

      for (const product of products) {
        const metafields = await shopify.metafield.list({
          owner_id: product.id,
          owner_resource: 'product',
          namespace: 'auction_winner'
        });

        const createdAtMetafield = metafields.find(
          mf => mf.key === 'created_at'
        );

        if (createdAtMetafield) {
          const createdAt = new Date(createdAtMetafield.value);
          if (createdAt < cutoffDate) {
            oldWinnerProducts.push(product.id);
          }
        }
      }

      // Delete old winner products
      const deletedProducts = [];
      for (const productId of oldWinnerProducts) {
        try {
          await shopify.product.delete(productId);
          deletedProducts.push(productId);
        } catch (error) {
          console.error(`Failed to delete product ${productId}:`, error);
        }
      }

      return {
        success: true,
        deletedCount: deletedProducts.length,
        deletedProducts
      };

    } catch (error) {
      console.error('Error cleaning up old winner products:', error);
      throw error;
    }
  }
}

export default ProductDuplicationService;
