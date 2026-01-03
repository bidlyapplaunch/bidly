# Quick Setup for hiiiiiiiiiii.com

## Step 1: Add CNAME Record in Cloudflare

1. **In your Cloudflare DNS page** (where you are now)
2. **Click "Add record"** button
3. **Fill in:**
   - **Type**: `CNAME`
   - **Name**: `bidly-backend` (or `api`, `backend`, `app` - your choice)
   - **Target**: `bidly-auction-backend.onrender.com`
   - **Proxy status**: 🟠 **Proxied** (orange cloud) - **IMPORTANT!**
   - **TTL**: Auto
4. **Click "Save"**

**Result:** You'll have `bidly-backend.hiiiiiiiiiii.com` pointing to your Render.com service

## Step 2: Add Custom Domain in Render.com

1. Go to Render.com dashboard
2. Select your `bidly-auction-backend` service
3. Click "Settings" tab
4. Scroll to "Custom Domains"
5. Click "Add Custom Domain"
6. Enter: `bidly-backend.hiiiiiiiiiii.com`
7. Click "Add"
8. Wait 5-10 minutes for SSL certificate

## Step 3: Update Shopify Partner Dashboard

### App URL
- Change from: `https://bidly-auction-backend.onrender.com`
- Change to: `https://bidly-backend.hiiiiiiiiiii.com`

### Redirect URLs
- Change from: `https://bidly-auction-backend.onrender.com/auth/shopify/callback`
- Change to: `https://bidly-backend.hiiiiiiiiiii.com/auth/shopify/callback`

### App Proxy URL
- Change from: `https://bidly-auction-backend.onrender.com/apps/bidly`
- Change to: `https://bidly-backend.hiiiiiiiiiii.com/apps/bidly`

### Webhook URLs
- Customers redact: `https://bidly-backend.hiiiiiiiiiii.com`
- Customers data request: `https://bidly-backend.hiiiiiiiiiii.com`
- Shop redact: `https://bidly-backend.hiiiiiiiiiii.com`

## Step 4: Update Environment Variables in Render.com

1. Go to Render.com → Your Service → Environment tab
2. Update:
   - `SHOPIFY_APP_URL` = `https://bidly-backend.hiiiiiiiiiii.com`
   - `APP_URL` = `https://bidly-backend.hiiiiiiiiiii.com`
3. Redeploy service

## Step 5: Update TOML Files

I'll help you update the configuration files next!


