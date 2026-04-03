# Multi-App Setup Guide

## Current Architecture

The backend identifies which Shopify app to use via **environment variables**:

- `SHOPIFY_API_KEY` (Client ID from Shopify Partners)
- `SHOPIFY_API_SECRET` (Client Secret from Shopify Partners)

These are set at the **deployment level** (Render), so **one backend = one Shopify app**.

## Using Same Codebase for Multiple Apps

You have 3 options:

### Option 1: Update Environment Variables (Swap Between Apps)

If you want to switch which app the backend uses:

1. **Get new app credentials:**
   - Go to Shopify Partners → Your new app
   - Copy **Client ID** (API Key) and **Client Secret** (API Secret)

2. **Update Render environment variables:**
   - Go to Render Dashboard → Your backend service
   - Environment → Edit variables:
     ```
     SHOPIFY_API_KEY=<new_app_client_id>
     SHOPIFY_API_SECRET=<new_app_client_secret>
     ```
   - Save and redeploy

3. **Update `shopify.app.bidly.toml`:**
   ```toml
   client_id = "<new_app_client_id>"
   ```

**Note:** This will make the backend work with the NEW app, but stores using the OLD app will lose access.

### Option 2: Separate Backend Deployment (Recommended for Production)

Deploy a separate backend instance for each Shopify app:

1. **Create new Render backend service:**
   - Duplicate your existing backend service
   - Or create a new one from the same GitHub repo

2. **Set unique environment variables:**
   ```
   SHOPIFY_API_KEY=<new_app_client_id>
   SHOPIFY_API_SECRET=<new_app_client_secret>
   ```

3. **Update new app's configuration:**
   - In `shopify.app.bidly.toml`, set `client_id` to match
   - Update redirect URLs to point to new backend URL

### Option 3: Multi-App Support (Advanced)

Modify the codebase to support multiple apps by:
- Storing app credentials in database (per store)
- Dynamically selecting credentials based on shop domain
- This requires significant code changes

## Current Configuration Files

- `shopify.app.bidly.toml` - Has `client_id = "4d6fd182c13268701d61dc45f76c735e"`
- Backend reads from `SHOPIFY_API_KEY` environment variable
- **These must match for OAuth to work**

## Quick Check

To see which app your backend is currently configured for:

1. Check Render environment variables → `SHOPIFY_API_KEY`
2. Check `shopify.app.bidly.toml` → `client_id`
3. They should match the Client ID from Shopify Partners

## For Your Current Situation

Since you created a new app in a new store:

1. **Get the new app's Client ID and Secret** from Shopify Partners
2. **Update Render environment variables** with new credentials
3. **Update `shopify.app.bidly.toml`** with new `client_id`
4. **Redeploy both backend and admin** (if needed)

The backend will then use the new app's credentials for all OAuth requests.

