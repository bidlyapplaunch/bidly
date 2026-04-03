# Next Steps - Second Backend Setup

Since your second backend is now live, follow these steps:

## ✅ Step 1: Update Shopify Partners Dashboard

Go to your **second app** in Shopify Partners (`de32970476f2ecf20d98f9d9b6994c89`):

1. **App setup** → **URLs**
   - **App URL**: `https://bidly-auction-backend-2.onrender.com`
   - **Allowed redirection URLs**: 
     ```
     https://bidly-auction-backend-2.onrender.com/auth/shopify/callback
     ```

2. **Save** the changes

---

## ✅ Step 2: Install App in New Store

1. Go to your store: `6sb15z-k1.myshopify.com`
2. Install the app using one of these methods:

   **Option A: Direct Install Link**
   ```
   https://bidly-auction-backend-2.onrender.com/auth/shopify/install?shop=6sb15z-k1.myshopify.com
   ```

   **Option B: Via Shopify Admin**
   - Go to Apps → Custom apps
   - Find your app and click "Install"

3. Complete the OAuth flow (approve permissions)

---

## ✅ Step 3: Redeploy Shopify Extension

The extension needs to be redeployed to include the updated `backendConfig.js` file:

```bash
# Deploy extension for second app
shopify app deploy --config shopify.app.second.toml

# Or if you want to deploy for both apps
shopify app deploy --config shopify.app.toml        # First app
shopify app deploy --config shopify.app.second.toml   # Second app
```

**Important**: This ensures the customer widget (`backendConfig.js`) has the correct store-to-backend mappings.

---

## ✅ Step 4: Verify Everything Works

### Test Admin Panel

1. Open admin panel for `6sb15z-k1.myshopify.com`
2. Check browser console - should see:
   ```
   🔗 Mapped shop "6sb15z-k1.myshopify.com" to backend: https://bidly-auction-backend-2.onrender.com
   ```
3. Try creating an auction - should work with the second backend

### Test Customer Widget

1. Go to a product page in `6sb15z-k1.myshopify.com`
2. Check browser console - should see:
   ```
   🔗 Bidly: Mapped shop "6sb15z-k1.myshopify.com" to backend: https://bidly-auction-backend-2.onrender.com
   ```
3. Create an auction for that product
4. Verify the widget appears and connects to the correct backend

### Test Backend Connection

```bash
# Test health endpoint
curl https://bidly-auction-backend-2.onrender.com/health

# Test OAuth status
curl "https://bidly-auction-backend-2.onrender.com/auth/shopify/status?shop=6sb15z-k1.myshopify.com"
```

---

## ✅ Step 5: Verify Environment Variables

Make sure your second backend has these environment variables set in Render:

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

---

## Troubleshooting

### Issue: "Shop parameter is required"
- Check that the shop domain is correctly passed in the OAuth URL
- Verify backend environment variables are set correctly

### Issue: "App can't be installed on this store"
- Check app distribution settings in Shopify Partners (should be "Unlisted" or "Public")
- Verify the app is not restricted to specific organizations

### Issue: Widget not connecting to correct backend
- Redeploy the extension: `shopify app deploy --config shopify.app.second.toml`
- Check browser console for backend URL being used
- Verify `backendConfig.js` is loaded and has correct mappings

### Issue: Admin panel not routing correctly
- Check browser console for backend URL logs
- Verify `auction-admin/src/config/backendConfig.js` has correct mappings
- Rebuild admin frontend if needed

---

## Quick Checklist

- [ ] Shopify Partners URLs updated
- [ ] App installed in new store (`6sb15z-k1.myshopify.com`)
- [ ] Extension redeployed with updated config
- [ ] Admin panel routes to second backend
- [ ] Customer widget routes to second backend
- [ ] Can create auctions in new store
- [ ] Widget appears on product pages

---

## Summary

After completing these steps:
- ✅ First store (`bidly-2.myshopify.com`) → First backend
- ✅ Second store (`6sb15z-k1.myshopify.com`) → Second backend
- ✅ Both stores use the same admin frontend and customer widget
- ✅ Automatic routing based on shop domain

