# Shopify App Installation Fix Guide

## Error: "This app can't be installed on this store. Bidly can only be installed on stores that are part of the same organization."

This error occurs when your app is configured as a **Custom App** in Shopify Partners. Custom apps can only be installed on stores that belong to the same organization/partner account.

## Solution

### Option 1: Change App Type to Public/Unlisted (Recommended)

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com/)
2. Navigate to **Apps** → Select your app
3. Go to **App setup** → **App distribution**
4. Change the app type from **Custom app** to:
   - **Public app** (visible in Shopify App Store)
   - **Unlisted app** (installable via direct link, not in App Store)
5. Save changes

### Option 2: Verify App Client ID Configuration

Make sure your backend environment variables match the app in Shopify Partners:

1. In Shopify Partners, go to your app → **App setup** → **Client credentials**
2. Note your **Client ID** (API key)
3. Update your backend environment variables:
   ```
   SHOPIFY_API_KEY=<your_client_id_from_partners>
   SHOPIFY_API_SECRET=<your_client_secret_from_partners>
   ```

### Current Client IDs in Configuration Files

- `shopify.app.toml`: `1f94308027df312cd5f038e7fb75cc16`
- `shopify.app.bidly.toml`: `4d6fd182c13268701d61dc45f76c735e`

**Important**: The backend OAuth service uses `SHOPIFY_API_KEY` environment variable. Make sure it matches the Client ID of the app you want to use.

### Option 3: Add Store to Same Organization

If you must use a Custom app:
1. Ensure the store (`6sb15z-k1.myshopify.com`) is added to your Partner organization
2. Or use a development store created through your Partner account

## Verification Steps

After making changes:

1. Update your backend `.env` file with correct credentials
2. Redeploy the backend service
3. Try installing the app again using:
   ```
   https://bidly-auction-backend.onrender.com/auth/shopify/install?shop=6sb15z-k1.myshopify.com
   ```

## Need Help?

If the error persists:
1. Check Shopify Partners → App → App setup → Check app type
2. Verify Client ID/Secret match between Partners dashboard and backend `.env`
3. Ensure redirect URLs are configured correctly in Partners dashboard

