import express from 'express';
import {
  generateAppBridgeToken,
  verifyAppBridgeToken,
  getAppConfig
} from '../controllers/appBridgeController.js';

const router = express.Router();

// App Bridge configuration endpoint
router.get('/config', getAppConfig);

// App Bridge authentication endpoints
router.get('/token', generateAppBridgeToken);
router.post('/verify', verifyAppBridgeToken);

export default router;
