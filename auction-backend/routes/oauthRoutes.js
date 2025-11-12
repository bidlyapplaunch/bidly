import express from 'express';
import {
  handleCustomAppInstall,
  initiateOAuth,
  handleOAuthCallback,
  handleUninstall,
  getCurrentStore,
  checkInstallationStatus
} from '../controllers/oauthController.js';

const router = express.Router();

/**
 * OAuth Routes for Shopify App Installation
 * These routes handle the complete OAuth flow for your Shopify app
 */

// Custom App Installation
// GET /auth/shopify/install-custom?client_id=...&signature=...&permanent_domain=...
// This handles custom app installation from Shopify admin
router.get('/install-custom', handleCustomAppInstall);

// OAuth Installation Flow
// GET /auth/shopify/install?shop=store.myshopify.com
// This initiates the OAuth flow by redirecting to Shopify
router.get('/install', initiateOAuth);

// OAuth Callback
// GET /auth/shopify/callback?code=...&state=...&shop=...
// This handles the callback from Shopify after store owner approves the app
router.get('/callback', handleOAuthCallback);

// Store Information
// GET /auth/shopify/store?shop=store.myshopify.com
// This returns information about the current store
router.get('/store', getCurrentStore);

// Installation Status Check
// GET /auth/shopify/status?shop=store.myshopify.com
// This checks if a store has completed the OAuth installation
router.get('/status', checkInstallationStatus);

// Webhook Routes
// POST /webhooks/shopify/uninstall
// This handles the uninstall webhook from Shopify
router.post('/uninstall', handleUninstall);
router.post('/uninstalled', handleUninstall);

export default router;
