import express from 'express';
import {
  generateAppBridgeToken,
  verifyAppBridgeToken,
  getAppConfig,
  debugStoreStatus
} from '../controllers/appBridgeController.js';

const router = express.Router();

// App Bridge configuration endpoint
router.get('/config', getAppConfig);

// Debug endpoint to check store status
router.get('/debug', debugStoreStatus);

// App Bridge authentication endpoints
router.get('/token', generateAppBridgeToken);
router.post('/verify', verifyAppBridgeToken);

export default router;
