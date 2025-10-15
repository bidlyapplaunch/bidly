import express from 'express';
import {
  generateAppBridgeToken,
  verifyAppBridgeToken,
  getAppConfig,
  debugStoreStatus
} from '../controllers/appBridgeController.js';

const router = express.Router();

// Test endpoint to verify routes are working
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'App Bridge routes are working',
    timestamp: new Date().toISOString()
  });
});

// App Bridge configuration endpoint
router.get('/config', getAppConfig);

// Debug endpoint to check store status
router.get('/debug', debugStoreStatus);

// App Bridge authentication endpoints
router.get('/token', generateAppBridgeToken);
router.post('/verify', verifyAppBridgeToken);

export default router;
