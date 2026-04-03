# App Configuration Summary

This document summarizes the current configuration for both Shopify apps and their backends.

## App 1 (Default)

### Shopify App
- **Store**: `bidly-2.myshopify.com`
- **Client ID**: (Original app)
- **Backend URL**: `https://bidly-auction-backend.onrender.com`

### Backend Configuration
- **Render Service**: `bidly-auction-backend`
- **Environment Variables**:
  - `SHOPIFY_CLIENT_ID`: (Original app client ID)
  - `SHOPIFY_CLIENT_SECRET`: (Original app secret)
  - `SHOPIFY_REDIRECT_URI`: `https://bidly-auction-backend.onrender.com/auth/shopify/callback`
  - `MONGODB_URI`: (Your MongoDB connection string)
  - `JWT_SECRET`: (Your JWT secret)
  - `APP_URL`: `https://bidly-auction-backend.onrender.com`

---

## App 2 (New)

### Shopify App
- **Store**: `6sb15z-k1.myshopify.com`
- **Client ID**: `de32970476f2ecf20d98f9d9b6994c89`
- **Client Secret**: `shpss_...` (stored in backend environment variables)
- **Backend URL**: `https://bidly-auction-backend-2.onrender.com`

### Backend Configuration
- **Render Service**: `bidly-auction-backend-2`
- **Environment Variables** (to be set in Render):
  ```
  SHOPIFY_CLIENT_ID=de32970476f2ecf20d98f9d9b6994c89
  SHOPIFY_CLIENT_SECRET=<your_client_secret_from_shopify_partners>
  SHOPIFY_REDIRECT_URI=https://bidly-auction-backend-2.onrender.com/auth/shopify/callback
  APP_URL=https://bidly-auction-backend-2.onrender.com
  JWT_SECRET=FHn06Fu/0Jy5BnKJ8cZfOIiqsQrGBW7Daj7Tlz/XXTEIyIal+i/Cm7oQOaD5vYq0GTQCX4ZPcwURT0CnEtUpkw==
  MONGODB_URI=<your_mongodb_uri>
  PORT=5000
  NODE_ENV=production
  ```

### Shopify Partners Configuration
In Shopify Partners dashboard for this app:
- **App URL**: `https://bidly-auction-backend-2.onrender.com`
- **Allowed redirection URLs**: 
  ```
  https://bidly-auction-backend-2.onrender.com/auth/shopify/callback
  ```

---

## Store-to-Backend Mapping

### Admin Frontend Config
**File**: `auction-admin/src/config/backendConfig.js`

```javascript
const STORE_BACKEND_MAP = {
  'bidly-2.myshopify.com': 'https://bidly-auction-backend.onrender.com',
  '6sb15z-k1.myshopify.com': 'https://bidly-auction-backend-2.onrender.com',
};
```

### Customer Widget Config
**File**: `extensions/theme-app-extension/assets/backendConfig.js`

```javascript
const STORE_BACKEND_MAP = {
  'bidly-2.myshopify.com': 'https://bidly-auction-backend.onrender.com',
  '6sb15z-k1.myshopify.com': 'https://bidly-auction-backend-2.onrender.com',
};
```

---

## Next Steps

1. ✅ **Backend configs updated** - Store mappings are configured
2. ⏳ **Deploy second backend** - Create Render service with the environment variables above
3. ⏳ **Update Shopify app config** - Set app URL and redirect URLs in Shopify Partners
4. ⏳ **Test OAuth flow** - Install app in `6sb15z-k1.myshopify.com` store
5. ⏳ **Redeploy extensions** - After backend is live, redeploy Shopify extension to include updated config

---

## Notes

- Both stores will automatically route to their respective backends
- Admin frontend and customer widget share the same deployment
- Each backend is completely independent
- MongoDB can be shared or separate (both work)

