import express from 'express';
import { identifyStore } from '../middleware/storeMiddleware.js';
import Auction from '../models/Auction.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

const normalizeProductId = (value) => {
  if (!value || typeof value !== 'string') return null;
  const stringValue = value.toString().trim();
  if (!stringValue) return null;
  const match = stringValue.match(/Product\/(\d+)/i);
  if (match && match[1]) return match[1];
  if (/^\d+$/.test(stringValue)) return stringValue;
  return null;
};

/**
 * GET /api/chat/monitor
 * List all auctions with chat enabled for the shop, plus their messages.
 * Used by the Chat Monitor admin page.
 */
router.get('/monitor', identifyStore, async (req, res, next) => {
  try {
    const shopDomain = req.shopDomain;
    if (!shopDomain) {
      return next(new AppError('Shop domain is required', 400));
    }

    const chatRooms = req.app.get('chatRooms');
    if (!chatRooms) {
      return res.json({ auctions: [] });
    }

    const auctions = await Auction.find({
      shopDomain,
      chatEnabled: true,
      isDeleted: { $ne: true }
    })
      .select('_id shopifyProductId productData status')
      .lean();

    const result = auctions.map((a) => {
      const productId = normalizeProductId(a.shopifyProductId);
      const messages = productId ? (chatRooms.get(productId) || []) : [];
      return {
        auctionId: a._id.toString(),
        shopifyProductId: a.shopifyProductId,
        productTitle: a.productData?.title || a.shopifyProductId,
        status: a.status,
        messageCount: messages.length,
        messages: messages.map((m) => ({
          id: m.id,
          username: m.username,
          message: m.message,
          timestamp: m.timestamp
        }))
      };
    });

    res.json({ auctions: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/chat/:productId
 * Get messages for a specific product. Verifies product belongs to shop via Auction.
 */
router.get('/:productId', identifyStore, async (req, res, next) => {
  try {
    const shopDomain = req.shopDomain;
    const productId = normalizeProductId(req.params.productId);
    if (!productId || !shopDomain) {
      return next(new AppError('Product ID and shop are required', 400));
    }

    const auction = await Auction.findOne({
      shopifyProductId: productId,
      shopDomain,
      isDeleted: { $ne: true }
    });
    if (!auction) {
      return next(new AppError('Auction not found for this product', 404));
    }

    const chatRooms = req.app.get('chatRooms');
    const messages = chatRooms ? (chatRooms.get(productId) || []) : [];
    res.json({
      productId,
      messages: messages.map((m) => ({
        id: m.id,
        username: m.username,
        message: m.message,
        timestamp: m.timestamp
      }))
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/chat/:productId/:messageId
 * Delete a single message. Must be before DELETE /:productId for correct routing.
 */
router.delete('/:productId/:messageId', identifyStore, async (req, res, next) => {
  try {
    const shopDomain = req.shopDomain;
    const productId = normalizeProductId(req.params.productId);
    const messageId = req.params.messageId;
    if (!productId || !messageId || !shopDomain) {
      return next(new AppError('Product ID, message ID, and shop are required', 400));
    }

    const auction = await Auction.findOne({
      shopifyProductId: productId,
      shopDomain,
      isDeleted: { $ne: true }
    });
    if (!auction) {
      return next(new AppError('Auction not found for this product', 404));
    }

    const chatRooms = req.app.get('chatRooms');
    const messages = chatRooms?.get(productId);
    if (!messages) {
      return res.json({ success: true, deleted: false, message: 'No messages in room' });
    }

    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) {
      return res.json({ success: true, deleted: false, message: 'Message not found' });
    }

    messages.splice(idx, 1);
    const io = req.app.get('io');
    if (io) {
      io.to(`chat-${productId}`).emit('chat-message-deleted', { productId, messageId });
    }
    res.json({ success: true, deleted: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/chat/:productId
 * Clear all messages for a product (no messageId = clear all).
 */
router.delete('/:productId', identifyStore, async (req, res, next) => {
  try {
    const shopDomain = req.shopDomain;
    const productId = normalizeProductId(req.params.productId);
    if (!productId || !shopDomain) {
      return next(new AppError('Product ID and shop are required', 400));
    }

    const auction = await Auction.findOne({
      shopifyProductId: productId,
      shopDomain,
      isDeleted: { $ne: true }
    });
    if (!auction) {
      return next(new AppError('Auction not found for this product', 404));
    }

    const chatRooms = req.app.get('chatRooms');
    if (chatRooms?.has(productId)) {
      const messageIds = chatRooms.get(productId).map((m) => m.id);
      chatRooms.set(productId, []);
      const io = req.app.get('io');
      if (io) {
        io.to(`chat-${productId}`).emit('chat-messages-cleared', { productId, messageIds });
      }
    }
    res.json({ success: true, cleared: true });
  } catch (err) {
    next(err);
  }
});

export default router;
