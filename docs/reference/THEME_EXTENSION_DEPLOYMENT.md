# Bidly Theme App Extension Deployment Guide

This guide will help you deploy the Bidly Theme App Extension to your Shopify app and configure it for use in store themes.

## Prerequisites

- Shopify Partner account
- Existing Bidly app with backend deployed
- Shopify CLI installed
- Access to your app's codebase

## Step 1: Deploy the Theme Extension

### 1.1 Add Extension to Your App

```bash
# Navigate to your app directory
cd your-bidly-app

# Add the theme extension
shopify app generate extension --type=theme_app_extension

# When prompted, name it "bidly-theme-extension"
```

### 1.2 Copy Extension Files

Copy the files from `extensions/theme-app-extension/` to your app's extension directory:

```bash
# Copy the extension files
cp -r extensions/theme-app-extension/* your-app/extensions/bidly-theme-extension/
```

### 1.3 Deploy the Extension

```bash
# Deploy the extension
shopify app deploy
```

## Step 2: Configure App Proxy

### 2.1 In Shopify Partner Dashboard

1. Go to your app in the Partner Dashboard
2. Navigate to **App setup** → **App proxy**
3. Configure the proxy:
   - **Subpath prefix**: `bidly`
   - **Subpath**: `/apps/bidly`
   - **URL**: `https://bidly-auction-backend.onrender.com/apps/bidly`

### 2.2 Update Backend Configuration

Ensure your backend has the app proxy routes configured (already done in the code):

```javascript
// In your backend server.js
app.use('/apps/bidly', appProxyRoutes);
```

## Step 3: Test the Extension

### 3.1 Install in Development Store

```bash
# Install the app in a development store
shopify app dev
```

### 3.2 Add Blocks to Theme

1. Go to your development store's admin
2. Navigate to **Online Store** → **Themes**
3. Click **Customize** on your theme
4. Add a new section and select one of the Bidly blocks:
   - **Auction List**
   - **Single Auction**
   - **Featured Auction**

### 3.3 Configure Block Settings

For each block, configure:
- **Auction List**: Set max auctions, sort order, etc.
- **Single Auction**: Enter the auction ID to display
- **Featured Auction**: Enter the auction ID to feature

## Step 4: Production Deployment

### 4.1 Deploy to Production

```bash
# Deploy to production
shopify app deploy --force
```

### 4.2 Update App Proxy URL

Update the App Proxy URL in Partner Dashboard to point to your production backend.

### 4.3 Test in Production

1. Install the app in a production store
2. Add the blocks to the theme
3. Test all functionality

## Step 5: Theme Integration

### 5.1 Adding Blocks to Themes

Store owners can add Bidly blocks to their themes in several ways:

#### Via Theme Editor
1. Go to **Online Store** → **Themes**
2. Click **Customize**
3. Add sections and select Bidly blocks

#### Via Theme Code
```liquid
<!-- Add to any template file -->
{% section 'auction-list' %}
{% section 'auction-single' %}
{% section 'auction-featured' %}
```

### 5.2 Customization Options

Store owners can customize:
- Section titles
- Number of auctions to display
- Sort order
- Which auctions to feature
- Display styles

## Step 6: Monitoring and Maintenance

### 6.1 Monitor Usage

- Check Shopify Partner Dashboard for app usage
- Monitor backend logs for API calls
- Track auction engagement metrics

### 6.2 Update Extension

To update the extension:

```bash
# Make changes to extension files
# Then redeploy
shopify app deploy
```

### 6.3 Handle Updates

- Notify store owners of new features
- Provide migration guides if needed
- Test updates in development first

## Troubleshooting

### Common Issues

1. **Extension not appearing in Theme Editor**
   - Check if extension is properly deployed
   - Verify app is installed in the store
   - Check Partner Dashboard configuration

2. **Blocks not loading data**
   - Verify App Proxy configuration
   - Check backend is running
   - Test API endpoints directly

3. **Styling conflicts**
   - Check for CSS conflicts with theme
   - Test on different themes
   - Provide theme-specific overrides

### Debug Mode

Enable debug mode by adding `?bidly_debug=1` to store URLs to see console logs.

## Security Considerations

- All API calls go through Shopify's App Proxy
- Customer data is handled securely
- Input validation on all forms
- CORS properly configured

## Performance Optimization

- Lazy load auction data
- Cache frequently accessed data
- Optimize images and assets
- Minimize JavaScript bundle size

## Support and Documentation

- Provide clear documentation for store owners
- Create video tutorials for theme integration
- Set up support channels for issues
- Maintain changelog for updates

## Next Steps

1. **Analytics Integration**: Add Google Analytics or similar
2. **Advanced Customization**: Allow more theme customization options
3. **Multi-language Support**: Add internationalization
4. **Mobile App Integration**: Consider mobile app features
5. **Advanced Bidding**: Add proxy bidding, auto-bid features

## File Structure

```
extensions/theme-app-extension/
├── shopify.extension.toml          # Extension configuration
├── blocks/
│   ├── auction_list.liquid         # Auction list block
│   ├── auction_single.liquid       # Single auction block
│   └── auction_featured.liquid     # Featured auction block
├── assets/
│   ├── bidly-widget.js            # Main JavaScript
│   └── bidly-widget.css           # Main CSS
└── README.md                      # Documentation
```

## API Reference

### App Proxy Endpoints

- `GET /apps/bidly/api/auctions` - Get all auctions
- `GET /apps/bidly/api/auctions/:id` - Get single auction
- `POST /apps/bidly/api/auctions/:id/bid` - Place bid
- `POST /apps/bidly/api/auctions/:id/buy-now` - Buy now
- `GET /apps/bidly/health` - Health check

### JavaScript API

```javascript
// Initialize widget
window.BidlyAuctionWidget.init(blockId, shopDomain, appProxyUrl);

// Place bid
window.BidlyAuctionWidget.placeBid(auctionId, blockId);

// Buy now
window.BidlyAuctionWidget.buyNow(auctionId, blockId);

// Customer login
window.BidlyAuctionWidget.login(blockId);

// Customer logout
window.BidlyAuctionWidget.logout();
```

This completes the deployment guide for the Bidly Theme App Extension!
