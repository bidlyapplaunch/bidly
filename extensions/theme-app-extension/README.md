# Bidly Theme App Extension

This Shopify Theme App Extension allows customers to view and bid on auctions directly within their store's theme.

## Features

- **Auction List Block**: Display multiple auctions in a grid layout
- **Single Auction Block**: Show detailed view of a specific auction
- **Featured Auction Block**: Prominently display a single auction with enhanced styling
- **Real-time Bidding**: Place bids directly from the theme
- **Customer Authentication**: Simple name/email login for bidding
- **Responsive Design**: Works on all device sizes
- **App Proxy Integration**: Secure API calls via Shopify's app proxy

## Installation

1. **Deploy the extension** to your Shopify app
2. **Configure App Proxy** in your Shopify Partner Dashboard:
   - Subpath prefix: `bidly`
   - Subpath: `/apps/bidly`
   - URL: `https://your-backend-url.com/apps/bidly`

3. **Add blocks to your theme** via the Theme Editor:
   - Go to your store's Theme Editor
   - Add sections and select the Bidly blocks
   - Configure settings for each block

## Available Blocks

### 1. Auction List Block
- **Purpose**: Display multiple auctions in a grid
- **Settings**:
  - Section Title
  - Maximum auctions to display (1-20)
  - Show ended auctions (checkbox)
  - Sort by (newest, ending soon, highest bid)

### 2. Single Auction Block
- **Purpose**: Display detailed view of one auction
- **Settings**:
  - Auction ID (required)
  - Section Title
  - Show bid history (checkbox)
  - Show buy now button (checkbox)

### 3. Featured Auction Block
- **Purpose**: Prominently display one auction
- **Settings**:
  - Featured Auction ID (required)
  - Section Title
  - Show buy now button (checkbox)
  - Display style (gradient, minimal)

## API Endpoints

The extension uses these App Proxy endpoints:

- `GET /apps/bidly/api/auctions` - Get all auctions
- `GET /apps/bidly/api/auctions/:id` - Get single auction
- `POST /apps/bidly/api/auctions/:id/bid` - Place bid
- `POST /apps/bidly/api/auctions/:id/buy-now` - Buy now
- `GET /apps/bidly/health` - Health check

## Usage Examples

### Basic Auction List
```liquid
{% section 'auction-list' %}
```

### Single Auction
```liquid
{% section 'auction-single' %}
```

### Featured Auction
```liquid
{% section 'auction-featured' %}
```

## Customization

### CSS Variables
You can override the default styling by adding CSS variables to your theme:

```css
:root {
  --bidly-primary-color: #2c5aa0;
  --bidly-secondary-color: #28a745;
  --bidly-error-color: #dc3545;
  --bidly-border-radius: 8px;
  --bidly-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

### JavaScript Events
The widget fires custom events you can listen to:

```javascript
// Listen for bid placed
document.addEventListener('bidly:bid-placed', function(event) {
  console.log('Bid placed:', event.detail);
});

// Listen for auction updated
document.addEventListener('bidly:auction-updated', function(event) {
  console.log('Auction updated:', event.detail);
});
```

## Security

- All API calls go through Shopify's App Proxy for security
- Customer data is handled securely with session storage
- CORS is properly configured for theme integration
- Input validation on all forms

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Troubleshooting

### Common Issues

1. **Auctions not loading**
   - Check App Proxy configuration
   - Verify backend is running
   - Check browser console for errors

2. **Bidding not working**
   - Ensure customer is logged in
   - Check network connectivity
   - Verify auction is active

3. **Styling issues**
   - Check for CSS conflicts
   - Verify theme compatibility
   - Test on different devices

### Debug Mode

Enable debug mode by adding `?bidly_debug=1` to your store URL to see console logs.

## Support

For technical support, please contact your app developer or check the documentation.

## Changelog

### v1.0.0
- Initial release
- Auction list, single, and featured blocks
- Real-time bidding functionality
- Customer authentication
- Responsive design
