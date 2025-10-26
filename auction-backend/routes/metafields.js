import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getShopifyClient } from '../services/shopifyService.js';

const router = express.Router();

// Get metafields for a product
router.get('/products/:productId/metafields', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { shop } = req.query;
    
    if (!shop) {
      return res.status(400).json({ success: false, message: 'Shop parameter is required' });
    }

    const shopify = getShopifyClient(shop);
    if (!shopify) {
      return res.status(400).json({ success: false, message: 'Shop not found or invalid credentials' });
    }

    const metafields = await shopify.metafield.list({
      owner_id: productId,
      owner_resource: 'product'
    });

    res.json({
      success: true,
      data: metafields
    });
  } catch (error) {
    console.error('Error fetching metafields:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch metafields',
      error: error.message 
    });
  }
});

// Set auction metafields for a product
router.post('/products/:productId/auction-metafields', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { shop, auctionData } = req.body;
    
    if (!shop) {
      return res.status(400).json({ success: false, message: 'Shop parameter is required' });
    }

    const shopify = getShopifyClient(shop);
    if (!shopify) {
      return res.status(400).json({ success: false, message: 'Shop not found or invalid credentials' });
    }

    const metafields = [
      {
        namespace: 'auction',
        key: 'is_auction',
        value: 'true',
        type: 'boolean'
      },
      {
        namespace: 'auction',
        key: 'auction_id',
        value: auctionData.auctionId.toString(),
        type: 'single_line_text_field'
      },
      {
        namespace: 'auction',
        key: 'status',
        value: auctionData.status,
        type: 'single_line_text_field'
      },
      {
        namespace: 'auction',
        key: 'current_bid',
        value: auctionData.currentBid.toString(),
        type: 'number_decimal'
      },
      {
        namespace: 'auction',
        key: 'starting_bid',
        value: auctionData.startingBid.toString(),
        type: 'number_decimal'
      },
      {
        namespace: 'auction',
        key: 'reserve_price',
        value: (auctionData.reservePrice || 0).toString(),
        type: 'number_decimal'
      },
      {
        namespace: 'auction',
        key: 'end_time',
        value: auctionData.endTime,
        type: 'date_time'
      },
      {
        namespace: 'auction',
        key: 'bid_count',
        value: (auctionData.bidCount || 0).toString(),
        type: 'number_integer'
      },
      {
        namespace: 'auction',
        key: 'buy_now_price',
        value: (auctionData.buyNowPrice || 0).toString(),
        type: 'number_decimal'
      }
    ];

    const createdMetafields = [];
    
    for (const metafield of metafields) {
      try {
        const created = await shopify.metafield.create({
          owner_id: productId,
          owner_resource: 'product',
          ...metafield
        });
        createdMetafields.push(created);
      } catch (error) {
        console.warn(`Failed to create metafield ${metafield.key}:`, error.message);
        // Try to update existing metafield
        try {
          const existing = await shopify.metafield.list({
            owner_id: productId,
            owner_resource: 'product',
            namespace: metafield.namespace,
            key: metafield.key
          });
          
          if (existing.length > 0) {
            const updated = await shopify.metafield.update(existing[0].id, {
              value: metafield.value
            });
            createdMetafields.push(updated);
          }
        } catch (updateError) {
          console.error(`Failed to update metafield ${metafield.key}:`, updateError.message);
        }
      }
    }

    res.json({
      success: true,
      data: createdMetafields,
      message: 'Auction metafields set successfully'
    });
  } catch (error) {
    console.error('Error setting auction metafields:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to set auction metafields',
      error: error.message 
    });
  }
});

// Update auction metafields
router.put('/products/:productId/auction-metafields', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { shop, updates } = req.body;
    
    if (!shop) {
      return res.status(400).json({ success: false, message: 'Shop parameter is required' });
    }

    const shopify = getShopifyClient(shop);
    if (!shopify) {
      return res.status(400).json({ success: false, message: 'Shop not found or invalid credentials' });
    }

    const updatedMetafields = [];
    
    for (const [key, value] of Object.entries(updates)) {
      try {
        // Find existing metafield
        const existing = await shopify.metafield.list({
          owner_id: productId,
          owner_resource: 'product',
          namespace: 'auction',
          key: key
        });
        
        if (existing.length > 0) {
          const updated = await shopify.metafield.update(existing[0].id, {
            value: value.toString()
          });
          updatedMetafields.push(updated);
        } else {
          // Create new metafield if it doesn't exist
          const created = await shopify.metafield.create({
            owner_id: productId,
            owner_resource: 'product',
            namespace: 'auction',
            key: key,
            value: value.toString(),
            type: key.includes('bid') || key.includes('price') ? 'number_decimal' : 
                  key === 'bid_count' ? 'number_integer' : 'single_line_text_field'
          });
          updatedMetafields.push(created);
        }
      } catch (error) {
        console.error(`Failed to update metafield ${key}:`, error.message);
      }
    }

    res.json({
      success: true,
      data: updatedMetafields,
      message: 'Auction metafields updated successfully'
    });
  } catch (error) {
    console.error('Error updating auction metafields:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update auction metafields',
      error: error.message 
    });
  }
});

// Remove auction metafields (when auction is deleted)
router.delete('/products/:productId/auction-metafields', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { shop } = req.query;
    
    if (!shop) {
      return res.status(400).json({ success: false, message: 'Shop parameter is required' });
    }

    const shopify = getShopifyClient(shop);
    if (!shopify) {
      return res.status(400).json({ success: false, message: 'Shop not found or invalid credentials' });
    }

    // Get all auction metafields for this product
    const metafields = await shopify.metafield.list({
      owner_id: productId,
      owner_resource: 'product',
      namespace: 'auction'
    });

    const deletedMetafields = [];
    
    for (const metafield of metafields) {
      try {
        await shopify.metafield.delete(metafield.id);
        deletedMetafields.push(metafield.id);
      } catch (error) {
        console.error(`Failed to delete metafield ${metafield.key}:`, error.message);
      }
    }

    res.json({
      success: true,
      data: { deletedCount: deletedMetafields.length },
      message: 'Auction metafields removed successfully'
    });
  } catch (error) {
    console.error('Error removing auction metafields:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove auction metafields',
      error: error.message 
    });
  }
});

export default router;
