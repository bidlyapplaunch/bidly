# Cloudflare DNS Setup Guide for Render.com

## Overview
This guide will help you set up a custom domain with Cloudflare DNS to fix Shopify's DNS resolution issues.

## Prerequisites
- A domain name (buy one if you don't have it)
- Render.com account (you already have this)
- Shopify Partner Dashboard access

## Step 1: Get a Domain (If You Don't Have One)

### Option A: Buy from Cloudflare (Recommended)
1. Go to https://www.cloudflare.com/products/registrar/
2. Search for your desired domain (e.g., `bidlyapp.com`)
3. Add to cart and purchase
4. Domain will automatically be added to Cloudflare

### Option B: Buy from Other Registrar
- Namecheap, Google Domains, GoDaddy, etc.
- You'll transfer DNS management to Cloudflare in Step 2

### Option C: Use Existing Domain
- If you already have a domain, proceed to Step 2

## Step 2: Add Domain to Cloudflare

1. **Sign up/Login to Cloudflare**
   - Go to https://dash.cloudflare.com/sign-up
   - Create free account or login

2. **Add Your Domain**
   - Click "Add a Site" or "Add Site"
   - Enter your domain (e.g., `bidlyapp.com`)
   - Click "Add site"

3. **Select Plan**
   - Choose **FREE plan** (sufficient for DNS)
   - Click "Continue"

4. **Review DNS Records**
   - Cloudflare will scan existing DNS records
   - Review and click "Continue"

5. **Update Nameservers**
   - Cloudflare will show you 2 nameservers (e.g., `alice.ns.cloudflare.com` and `bob.ns.cloudflare.com`)
   - **If domain is at Cloudflare**: Already done, skip to Step 3
   - **If domain is elsewhere**: 
     - Go to your domain registrar (where you bought it)
     - Find "DNS Management" or "Nameservers"
     - Replace existing nameservers with Cloudflare's
     - Save changes
     - Wait 5-30 minutes for propagation

## Step 3: Configure DNS Records in Cloudflare

1. **Go to DNS Settings**
   - In Cloudflare dashboard, click your domain
   - Click "DNS" in left sidebar
   - Click "Records"

2. **Add CNAME Record for Backend**
   - Click "Add record"
   - **Type**: CNAME
   - **Name**: `bidly-backend` (or `api`, or `backend` - your choice)
   - **Target**: `bidly-auction-backend.onrender.com`
   - **Proxy status**: 🟠 Proxied (orange cloud) - **IMPORTANT: Enable proxy**
   - **TTL**: Auto
   - Click "Save"

3. **Verify Record**
   - You should see: `bidly-backend.yourdomain.com` → `bidly-auction-backend.onrender.com`
   - Status should show orange cloud (proxied)

## Step 4: Configure Render.com

1. **Go to Render.com Dashboard**
   - Select your `bidly-auction-backend` service
   - Click "Settings" tab

2. **Add Custom Domain**
   - Scroll to "Custom Domains" section
   - Click "Add Custom Domain"
   - Enter: `bidly-backend.yourdomain.com` (match the CNAME you created)
   - Click "Add"

3. **Verify Domain**
   - Render.com will verify DNS
   - Wait 1-5 minutes for verification
   - Status should show "Verified"

4. **SSL Certificate**
   - Render.com will automatically provision SSL certificate
   - Wait 5-10 minutes for SSL to be active
   - Check "SSL" section - should show "Active"

## Step 5: Update Shopify Partner Dashboard

### For First App (bidly-app-17 / client_id: 698a2d663b3718b47b794bfbd6835ef4)

1. **Go to Partner Dashboard**
   - https://partners.shopify.com
   - Navigate to: Apps → Bidly → App setup

2. **Update App URL**
   - **App URL**: `https://bidly-backend.yourdomain.com`
   - Remove trailing slash if present

3. **Update Redirect URLs**
   - **Redirect URLs**: `https://bidly-backend.yourdomain.com/auth/shopify/callback`
   - Remove old Render.com URL if present

4. **Update App Proxy URL**
   - **URL**: `https://bidly-backend.yourdomain.com/apps/bidly`
   - **Subpath**: `bidly`
   - **Prefix**: `apps`

5. **Update Webhook URLs**
   - **Privacy compliance webhooks**:
     - Customers redact: `https://bidly-backend.yourdomain.com`
     - Customers data request: `https://bidly-backend.yourdomain.com`
     - Shop redact: `https://bidly-backend.yourdomain.com`

6. **Save Changes**

### For Second App (if applicable)
- Repeat steps 1-6 with the second app's settings

## Step 6: Update Environment Variables

### On Render.com

1. **Go to Environment Tab**
   - Select your service
   - Click "Environment" tab

2. **Update Variables**
   - **SHOPIFY_APP_URL**: `https://bidly-backend.yourdomain.com`
   - **APP_URL**: `https://bidly-backend.yourdomain.com`
   - Update any other URLs that reference the old domain

3. **Redeploy Service**
   - After updating environment variables, redeploy:
   - Click "Manual Deploy" → "Deploy latest commit"
   - Or push a new commit to trigger auto-deploy

## Step 7: Update TOML Configuration Files

Update your Shopify app configuration files:

### shopify.app.bidly.toml
```toml
application_url = "https://bidly-backend.yourdomain.com"

[auth]
redirect_urls = [
  "https://bidly-backend.yourdomain.com/auth/shopify/callback"
]

[app_proxy]
url = "https://bidly-backend.yourdomain.com/apps/bidly"

[[webhooks.subscriptions]]
uri = "https://bidly-backend.yourdomain.com"
```

### shopify.app.second.toml (if applicable)
- Update similarly with your custom domain

## Step 8: Deploy Updated Configuration

```bash
# Deploy first app
shopify app deploy --config shopify.app.bidly.toml --force

# Deploy second app (if applicable)
shopify app deploy --config shopify.app.second.toml --force
```

## Step 9: Verify Everything Works

1. **Test DNS Resolution**
   ```bash
   nslookup bidly-backend.yourdomain.com 8.8.8.8
   ```
   - Should resolve to Cloudflare IPs

2. **Test HTTPS**
   - Open: `https://bidly-backend.yourdomain.com`
   - Should load your app
   - Should show valid SSL certificate

3. **Test from Shopify Admin**
   - Go to Shopify Admin → Apps → Your App
   - Should load without DNS errors

4. **Check Cloudflare Dashboard**
   - Go to Cloudflare → Your Domain → Overview
   - Should show traffic flowing
   - Check for any errors

## Step 10: Contact Shopify Support

After setup is complete:

1. **Wait 24-48 hours** for DNS propagation
2. **Contact Shopify Support**:
   - "I've migrated to a custom domain with Cloudflare DNS"
   - "New App URL: https://bidly-backend.yourdomain.com"
   - "Please retest DNS resolution"
   - "DNS should now resolve correctly from all locations"

## Troubleshooting

### DNS Not Resolving
- Wait 24-48 hours for full propagation
- Check Cloudflare DNS records are correct
- Verify nameservers are updated at registrar

### SSL Certificate Issues
- Wait 10-15 minutes for SSL provisioning
- Check Render.com SSL status
- Verify domain is verified in Render.com

### App Not Loading
- Check Render.com service is running
- Verify environment variables are updated
- Check Render.com logs for errors
- Verify CNAME record is correct

### Cloudflare Proxy Issues
- If having issues, temporarily disable proxy (gray cloud)
- Test if app loads without proxy
- Re-enable proxy once working

## Benefits of Cloudflare

✅ **Better DNS Reliability**: More reliable than Render.com's DNS
✅ **Global Propagation**: Faster DNS propagation worldwide
✅ **Free SSL**: Automatic SSL certificates
✅ **DDoS Protection**: Built-in protection
✅ **CDN Benefits**: Faster loading times
✅ **Analytics**: See traffic and performance metrics

## Cost

- **Cloudflare**: FREE (for DNS and basic features)
- **Domain**: ~$10-15/year (one-time purchase)
- **Total**: ~$10-15/year (very affordable!)

## Summary Checklist

- [ ] Get/buy domain
- [ ] Add domain to Cloudflare
- [ ] Update nameservers (if needed)
- [ ] Create CNAME record in Cloudflare
- [ ] Add custom domain in Render.com
- [ ] Update Shopify Partner Dashboard URLs
- [ ] Update environment variables in Render.com
- [ ] Update TOML configuration files
- [ ] Deploy updated configuration
- [ ] Test DNS resolution
- [ ] Test HTTPS access
- [ ] Test from Shopify Admin
- [ ] Contact Shopify support to retest

This setup will solve your DNS issues permanently! 🎉


