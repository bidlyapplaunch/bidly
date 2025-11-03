# Setting Up a Second Backend for a New Shopify App

## When You Need This

Create a separate backend deployment if:
- You want **both apps** to work simultaneously
- Different stores will install different apps
- You need to keep the original app working while testing the new one

## Steps to Create New Backend Deployment

### 1. Create New Render Backend Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository (same repo as existing backend)
4. Configure:
   - **Name**: `bidly-auction-backend-2` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `cd auction-backend && npm install`
   - **Start Command**: `cd auction-backend && npm start`
   - **Root Directory**: Leave blank or set to `auction-backend`

### 2. Set Environment Variables

In the new backend service, set these environment variables:

```
# Same as original
MONGODB_URI=<your_mongodb_uri>
PORT=5000
NODE_ENV=production

# NEW APP CREDENTIALS (from Shopify Partners)
SHOPIFY_API_KEY=<new_app_client_id>
SHOPIFY_API_SECRET=<new_app_client_secret>
SHOPIFY_REDIRECT_URI=https://<new-backend-url>.onrender.com/auth/shopify/callback

# Other variables
APP_URL=https://<new-backend-url>.onrender.com
JWT_SECRET=<generate_new_jwt_secret>
```

### 3. Update New App Configuration

1. **Update `shopify.app.bidly.toml`:**
   ```toml
   client_id = "<new_app_client_id>"
   application_url = "https://<new-backend-url>.onrender.com"
   
   [auth]
   redirect_urls = [
     "https://<new-backend-url>.onrender.com/auth/shopify/callback"
   ]
   ```

2. **Or create a separate config file** (e.g., `shopify.app.newstore.toml`)

### 4. Update Redirect URLs in Shopify Partners

For your **new app** in Shopify Partners:

1. Go to **App setup** → **URLs**
2. Set:
   - **App URL**: `https://<new-backend-url>.onrender.com`
   - **Allowed redirection URLs**: 
     ```
     https://<new-backend-url>.onrender.com/auth/shopify/callback
     ```

### 5. Update Frontend/Admin Configuration

If you're deploying a separate admin frontend for the new app:

1. Update admin frontend to point to new backend URL
2. Or use environment variables to switch between backends

## Alternative: Single Backend with App Selection

If you want to keep using one backend but switch between apps:

1. **Option A**: Update environment variables when needed (breaks other app temporarily)
2. **Option B**: Add code to support multiple apps dynamically (more complex)

## Verification

After deployment:

1. Check new backend is running: `https://<new-backend-url>.onrender.com/health`
2. Try OAuth install: `https://<new-backend-url>.onrender.com/auth/shopify/install?shop=your-store.myshopify.com`
3. Verify credentials match between:
   - Render environment variables
   - Shopify Partners dashboard
   - `shopify.app.bidly.toml` (or new config file)

## Summary

- **One backend = One Shopify app** (via environment variables)
- **Two apps = Two backends** (if you need both working simultaneously)
- **Same codebase, different deployments, different credentials**

