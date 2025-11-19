import express from 'express';
import { identifyStore } from '../middleware/storeMiddleware.js';
import getShopifyService from '../services/shopifyService.js';

const router = express.Router();
const shopifyService = getShopifyService();

async function getShopifyClient(shopDomain) {
  const { client } = await shopifyService.getStoreClient(shopDomain);
  return client;
}

async function listProductMetafields(client, productId, extraParams = {}) {
  const response = await client.get('/metafields.json', {
    params: {
      owner_id: productId,
      owner_resource: 'product',
      limit: 250,
      ...extraParams
    }
  });
  return response.data?.metafields || [];
}

async function upsertMetafield(client, productId, payload) {
  const existing = await listProductMetafields(client, productId, {
    namespace: 'auction',
    key: payload.key
  });

  if (existing.length > 0) {
    const metafieldId = existing[0].id;
    const response = await client.put(`/metafields/${metafieldId}.json`, {
      metafield: {
        id: metafieldId,
        value: payload.value,
        type: payload.type
      }
    });
    return response.data?.metafield;
  }

  const response = await client.post('/metafields.json', {
    metafield: {
      owner_id: productId,
      owner_resource: 'product',
      namespace: 'auction',
      key: payload.key,
      value: payload.value,
      type: payload.type
    }
  });
  return response.data?.metafield;
}

router.get('/products/:productId/metafields', identifyStore, async (req, res) => {
  try {
    const { productId } = req.params;
    const { shop } = req.query;
    
    if (!shop) {
      return res.status(400).json({ success: false, message: 'Shop parameter is required' });
    }

    const client = await getShopifyClient(shop);
    const metafields = await listProductMetafields(client, productId);

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

router.post('/products/:productId/auction-metafields', identifyStore, async (req, res) => {
  try {
    const { productId } = req.params;
    const { auctionData } = req.body;
    const shopDomain = req.shopDomain || req.query.shop || req.body.shop;
    
    if (!shopDomain) {
      return res.status(400).json({ success: false, message: 'Shop parameter is required' });
    }

    const client = await getShopifyClient(shopDomain);

    const metafields = [
      { key: 'is_auction', value: 'true', type: 'boolean' },
      { key: 'auction_id', value: auctionData.auctionId.toString(), type: 'single_line_text_field' },
      { key: 'status', value: auctionData.status, type: 'single_line_text_field' },
      { key: 'current_bid', value: auctionData.currentBid.toString(), type: 'number_decimal' },
      { key: 'starting_bid', value: auctionData.startingBid.toString(), type: 'number_decimal' },
      { key: 'reserve_price', value: (auctionData.reservePrice || 0).toString(), type: 'number_decimal' },
      { key: 'start_time', value: (auctionData.startTime instanceof Date ? auctionData.startTime.toISOString() : auctionData.startTime), type: 'date_time' },
      { key: 'end_time', value: (auctionData.endTime instanceof Date ? auctionData.endTime.toISOString() : auctionData.endTime), type: 'date_time' },
      { key: 'bid_count', value: (auctionData.bidCount || 0).toString(), type: 'number_integer' },
      { key: 'buy_now_price', value: (auctionData.buyNowPrice || 0).toString(), type: 'number_decimal' }
    ];

    const createdMetafields = [];
    
    for (const metafield of metafields) {
      const result = await upsertMetafield(client, productId, metafield);
      if (result) {
        createdMetafields.push(result);
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

router.put('/products/:productId/auction-metafields', identifyStore, async (req, res) => {
  try {
    const { productId } = req.params;
    const { updates } = req.body;
    const shopDomain = req.shopDomain || req.query.shop || req.body.shop;
    
    if (!shopDomain) {
      return res.status(400).json({ success: false, message: 'Shop parameter is required' });
    }

    const client = await getShopifyClient(shopDomain);

    const updatedMetafields = [];
    
    for (const [key, value] of Object.entries(updates)) {
      try {
        const result = await upsertMetafield(client, productId, {
          key,
          value: value.toString(),
          type: key.includes('bid') || key.includes('price') ? 'number_decimal'
            : key === 'bid_count' ? 'number_integer'
            : key.includes('time') ? 'date_time'
            : 'single_line_text_field'
        });
        if (result) {
          updatedMetafields.push(result);
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

router.delete('/products/:productId/auction-metafields', identifyStore, async (req, res) => {
  try {
    const { productId } = req.params;
    const shopDomain = req.shopDomain || req.query.shop || req.body.shop;
    
    if (!shopDomain) {
      return res.status(400).json({ success: false, message: 'Shop parameter is required' });
    }

    const client = await getShopifyClient(shopDomain);

    const metafields = await listProductMetafields(client, productId, { namespace: 'auction' });
    const deletedMetafields = [];
    
    for (const metafield of metafields) {
      try {
        await client.delete(`/metafields/${metafield.id}.json`);
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
