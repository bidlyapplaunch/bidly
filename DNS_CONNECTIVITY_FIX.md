# DNS/Connectivity Issue - Fix Checklist

## ✅ Current Status
- ✅ URLs are accessible: Both `bidly-auction-backend.onrender.com` and `bidly-auction-backend-2.onrender.com` return 200 OK
- ✅ DNS resolves correctly
- ⚠️ **Issue**: Shopify Partner Dashboard may have incorrect URL configured

## 🔍 Root Cause
According to Shopify support, the app shows `DNS_PROBE_FINISHED_NXDOMAIN` error, meaning Shopify cannot resolve your app URL. This is a **configuration mismatch**, not a DNS problem.

## 📋 Action Items

### 1. Verify Partner Dashboard Configuration

**For App "Bidly" (client_id: 698a2d663b3718b47b794bfbd6835ef4):**
1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Navigate to: **Apps** → **Bidly** → **App setup**
3. Check **App URL** field - it MUST be exactly:
   ```
   https://bidly-auction-backend.onrender.com
   ```
4. Check **Allowed redirection URL(s)** - should include:
   ```
   https://bidly-auction-backend.onrender.com/auth/shopify/callback
   ```

**For App "Bidly" (client_id: de32970476f2ecf20d98f9b6994c89):**
1. Navigate to: **Apps** → **Bidly** (second app) → **App setup**
2. Check **App URL** field - it MUST be exactly:
   ```
   https://bidly-auction-backend-2.onrender.com
   ```
3. Check **Allowed redirection URL(s)** - should include:
   ```
   https://bidly-auction-backend-2.onrender.com/auth/shopify/callback
   ```

### 2. Common Issues to Check

#### ❌ Typos in Partner Dashboard
- Missing `https://` prefix
- Extra trailing slash: `https://bidly-auction-backend.onrender.com/` (should NOT have trailing slash)
- Wrong domain: `bidly-auction-backend.render.com` (should be `.onrender.com`)
- Missing `s` in `https`

#### ❌ Environment Variable Mismatch
On Render.com, ensure `SHOPIFY_APP_URL` environment variable matches:
- **First app**: `SHOPIFY_APP_URL=https://bidly-auction-backend.onrender.com`
- **Second app**: `SHOPIFY_APP_URL=https://bidly-auction-backend-2.onrender.com`

### 3. Verify Render.com Configuration

**For each Render service:**
1. Go to Render.com dashboard
2. Check **Environment** tab
3. Verify `SHOPIFY_APP_URL` is set correctly (no trailing slash)
4. Verify `APP_URL` matches `SHOPIFY_APP_URL`
5. Check **Logs** tab for any startup errors

### 4. Test URLs Directly

Open these URLs in a browser (outside Shopify):
- ✅ `https://bidly-auction-backend.onrender.com` - Should load your app
- ✅ `https://bidly-auction-backend.onrender.com/auth/shopify/callback` - Should handle OAuth
- ✅ `https://bidly-auction-backend-2.onrender.com` - Should load your app
- ✅ `https://bidly-auction-backend-2.onrender.com/auth/shopify/callback` - Should handle OAuth

### 5. Sync Configuration

After fixing Partner Dashboard:
1. Run: `shopify app deploy --config shopify.app.bidly.toml --force`
2. Run: `shopify app deploy --config shopify.app.second.toml --force`
3. This syncs your TOML files with Partner Dashboard

### 6. Wait for Propagation

After making changes:
- ⏰ Wait up to **48 hours** for DNS changes to propagate
- ⏰ Wait **5-10 minutes** for Partner Dashboard changes to take effect
- 🔄 Clear browser cache and try again

## 🎯 Expected Result

Once the URL matches correctly:
- ✅ App loads in Shopify Admin
- ✅ App Bridge CDN script loads
- ✅ Session tokens generate correctly
- ✅ Embedded app checks pass
- ✅ No more `DNS_PROBE_FINISHED_NXDOMAIN` errors

## 🔧 Quick Fix Command

If you need to update the Partner Dashboard programmatically:

```bash
# For first app
shopify app deploy --config shopify.app.bidly.toml --force

# For second app  
shopify app deploy --config shopify.app.second.toml --force
```

This will sync your TOML configuration with Partner Dashboard.

## 📞 If Still Not Working

1. **Double-check Partner Dashboard** - Take a screenshot of the App URL field
2. **Check Render logs** - Look for any errors during app startup
3. **Test from different network** - Rule out local DNS caching
4. **Contact Shopify Support again** - Provide them with:
   - Exact URL from Partner Dashboard
   - Screenshot of the error
   - Render.com service status


