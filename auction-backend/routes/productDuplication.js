import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import ProductDuplicationService from '../services/productDuplicationService.js';

const router = express.Router();

// Duplicate product for auction winner
router.post('/duplicate-for-winner', authenticateToken, async (req, res) => {
  try {
    const { shop, originalProductId, winningBid, winnerEmail, winnerName } = req.body;
    
    if (!shop || !originalProductId || !winningBid || !winnerEmail || !winnerName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: shop, originalProductId, winningBid, winnerEmail, winnerName'
      });
    }

    const result = await ProductDuplicationService.duplicateProductForWinner(
      shop,
      originalProductId,
      winningBid,
      winnerEmail,
      winnerName
    );

    res.json(result);
  } catch (error) {
    console.error('Error duplicating product for winner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to duplicate product for winner',
      error: error.message
    });
  }
});

// Get winner's private product
router.get('/winner-product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { shop, token, email } = req.query;
    
    if (!shop || !token || !email) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: shop, token, email'
      });
    }

    const result = await ProductDuplicationService.getWinnerProduct(
      shop,
      productId,
      token,
      email
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(403).json(result);
    }
  } catch (error) {
    console.error('Error getting winner product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get winner product',
      error: error.message
    });
  }
});

// Verify access token
router.post('/verify-access', async (req, res) => {
  try {
    const { token, email, productId } = req.body;
    
    if (!token || !email || !productId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: token, email, productId'
      });
    }

    const isValid = ProductDuplicationService.verifyAccessToken(token, email, productId);
    
    res.json({
      success: true,
      isValid,
      message: isValid ? 'Access token is valid' : 'Access token is invalid'
    });
  } catch (error) {
    console.error('Error verifying access token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify access token',
      error: error.message
    });
  }
});

// Cleanup old winner products (admin only)
router.delete('/cleanup', authenticateToken, async (req, res) => {
  try {
    const { shop } = req.query;
    const { daysOld = 30 } = req.body;
    
    if (!shop) {
      return res.status(400).json({
        success: false,
        message: 'Shop parameter is required'
      });
    }

    const result = await ProductDuplicationService.cleanupOldWinnerProducts(shop, daysOld);
    res.json(result);
  } catch (error) {
    console.error('Error cleaning up old winner products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup old winner products',
      error: error.message
    });
  }
});

export default router;
