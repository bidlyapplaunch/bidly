# Store-to-Backend Routing Setup

This document explains how the admin frontend and customer widget automatically route to the correct backend based on the shop domain.

## Overview

The system now supports **multiple Shopify apps with different backend deployments**. Both the admin frontend and customer widget automatically detect which backend to use based on the shop domain.

## How It Works

1. **Store-to-Backend Mapping**: Each shop domain is mapped to its backend URL in configuration files
2. **Automatic Detection**: The code detects the shop domain and uses the appropriate backend
3. **Fallback**: If no mapping exists, it uses the default backend

## Configuration Files

### Admin Frontend

**File:** `auction-admin/src/config/backendConfig.js`

```javascript
const STORE_BACKEND_MAP = {
  'store1.myshopify.com': 'https://bidly-auction-backend.onrender.com',
  'store2.myshopify.com': 'https://bidly-auction-backend-2.onrender.com',
};

const DEFAULT_BACKEND = 'https://bidly-auction-backend.onrender.com';
```

### Customer Widget

**File:** `extensions/theme-app-extension/assets/backendConfig.js`

Same structure as admin config, but loads in the browser on product pages.

## Adding a New Store

When you deploy a new backend for a new Shopify app:

1. **Deploy the new backend** on Render (or your hosting platform)
2. **Update both config files**:
   - `auction-admin/src/config/backendConfig.js`
   - `extensions/theme-app-extension/assets/backendConfig.js`
3. **Add the mapping**:
   ```javascript
   'newstore.myshopify.com': 'https://new-backend-url.onrender.com'
   ```
4. **Redeploy the admin frontend** (if needed)
5. **Redeploy the Shopify extension** (the backendConfig.js will be included automatically)

## Updated Files

### Admin Frontend
- ✅ `auction-admin/src/config/backendConfig.js` (new)
- ✅ `auction-admin/src/services/api.js` - Uses dynamic backend URL
- ✅ `auction-admin/src/services/socket.js` - Uses dynamic backend URL
- ✅ `auction-admin/src/components/OAuthSetup.jsx` - Uses dynamic backend URL

### Customer Widget
- ✅ `extensions/theme-app-extension/assets/backendConfig.js` (new)
- ✅ `extensions/theme-app-extension/assets/auction-app-embed.js` - Uses dynamic backend URL
- ✅ `extensions/theme-app-extension/assets/bidly-hybrid-login.js` - Uses dynamic backend URL
- ✅ `extensions/theme-app-extension/assets/auction-widget-simple.js` - Uses dynamic backend URL
- ✅ `extensions/theme-app-extension/blocks/auction-app-embed.liquid` - Includes backendConfig.js

## How to Use

### For Developers

1. **Add a store mapping** in both config files
2. The system automatically uses the correct backend for that store
3. No code changes needed in individual components

### Example

If you have:
- Store 1: `store1.myshopify.com` → Backend 1: `https://backend1.onrender.com`
- Store 2: `store2.myshopify.com` → Backend 2: `https://backend2.onrender.com`

When a user from Store 1 opens the admin panel:
- Admin detects `store1.myshopify.com`
- Routes all API calls to `https://backend1.onrender.com/api`
- Connects Socket.io to `https://backend1.onrender.com`

When a customer views a product on Store 2:
- Widget detects `store2.myshopify.com`
- Routes all API calls to `https://backend2.onrender.com/api`
- Connects Socket.io to `https://backend2.onrender.com`

## Benefits

✅ **Single admin deployment** - One admin frontend works with multiple backends  
✅ **Single widget deployment** - One widget works with multiple backends  
✅ **Easy to add new stores** - Just update the mapping  
✅ **Automatic routing** - No manual configuration needed per store  
✅ **Backward compatible** - Falls back to default if no mapping exists

## Notes

- The default backend is used for stores not in the mapping
- Shop domain detection is case-insensitive
- The system cleans shop domains (removes protocol, trailing slashes)
- All routing happens automatically based on the shop domain

