# Fix OAuth Redirect URI Error

## Error
```
invalid_request: The redirect_uri is not whitelisted
```

## Problem
The redirect URI being sent to Shopify doesn't match what's whitelisted in Shopify Partners for your second app.

## Solution

### Step 1: Verify Environment Variable in Render

For your **second backend** (`bidly-auction-backend-2`), make sure you have:

**Environment Variable:**
```
SHOPIFY_REDIRECT_URI=https://bidly-auction-backend-2.onrender.com/auth/shopify/callback
```

**Important:** 
- Must be exactly this URL (no trailing slash)
- Must use `https://` (not `http://`)
- Must match the backend URL exactly

### Step 2: Whitelist in Shopify Partners

Go to your **second app** in Shopify Partners (Client ID: `de32970476f2ecf20d98f9d9b6994c89`):

1. Go to **App setup** → **URLs**
2. Under **Allowed redirection URLs**, add:
   ```
   https://bidly-auction-backend-2.onrender.com/auth/shopify/callback
   ```
3. **Save** the changes

### Step 3: Verify the Configuration

The redirect URI must match **exactly** in:
- ✅ Render environment variable: `SHOPIFY_REDIRECT_URI`
- ✅ Shopify Partners: Allowed redirection URLs
- ✅ Backend code (should use the env var)

### Step 4: Test

After updating:
1. Save changes in Shopify Partners
2. Wait a few seconds for changes to propagate
3. Try the OAuth flow again from the admin panel

## Common Issues

### Issue 1: Trailing Slash
- ❌ Wrong: `https://bidly-auction-backend-2.onrender.com/auth/shopify/callback/`
- ✅ Correct: `https://bidly-auction-backend-2.onrender.com/auth/shopify/callback`

### Issue 2: HTTP vs HTTPS
- ❌ Wrong: `http://bidly-auction-backend-2.onrender.com/auth/shopify/callback`
- ✅ Correct: `https://bidly-auction-backend-2.onrender.com/auth/shopify/callback`

### Issue 3: Wrong Backend URL
- ❌ Wrong: `https://bidly-auction-backend.onrender.com/auth/shopify/callback` (first backend)
- ✅ Correct: `https://bidly-auction-backend-2.onrender.com/auth/shopify/callback` (second backend)

## Quick Checklist

- [ ] `SHOPIFY_REDIRECT_URI` set in Render for backend-2
- [ ] Redirect URI whitelisted in Shopify Partners for second app
- [ ] No trailing slash
- [ ] Using `https://` (not `http://`)
- [ ] Exact match between Render env var and Shopify Partners

## For Both Backends

**Backend 1** (`bidly-auction-backend`):
- Redirect URI: `https://bidly-auction-backend.onrender.com/auth/shopify/callback`
- App: First app (Client ID: `4d6fd182c13268701d61dc45f76c735e`)

**Backend 2** (`bidly-auction-backend-2`):
- Redirect URI: `https://bidly-auction-backend-2.onrender.com/auth/shopify/callback`
- App: Second app (Client ID: `de32970476f2ecf20d98f9d9b6994c89`)

