# Shopify Integration for Auction System

This document describes the comprehensive Shopify integration that allows your auction system to fetch and display real product data from your Shopify store.

## 🚀 Features

### ✅ **Product Data Fetching**
- Fetch individual products by ID
- Search products by title, vendor, or tags
- Get all products with pagination
- Validate product existence
- Get product inventory information

### ✅ **Product Data Caching**
- Automatically cache product data when creating auctions
- Store product images, titles, descriptions, prices
- Cache vendor, product type, and tags
- Store variant information and inventory

### ✅ **Real-time Product Updates**
- Refresh product data for individual auctions
- Bulk refresh all auction product data
- Get auctions with fresh product data

### ✅ **Advanced Product Queries**
- Get products by vendor
- Get products by product type
- Get products by tags
- Get product by handle (URL-friendly identifier)
- Product suggestions for autocomplete

## 📁 File Structure

```
auction-backend/
├── services/
│   └── shopifyService.js          # Main Shopify service with all helper functions
├── controllers/
│   ├── auctionController.js       # Updated with product data integration
│   └── shopifyController.js       # New Shopify API endpoints
├── routes/
│   ├── auctionRoutes.js           # Updated with product data routes
│   └── shopifyRoutes.js           # New Shopify routes
├── models/
│   └── Auction.js                 # Updated with productData field
└── server.js                      # Updated with Shopify routes
```

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Shopify Configuration
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_access_token_here
```

### Getting Your Shopify Access Token

1. **From Shopify CLI** (if using existing app):
   ```bash
   shopify app env show
   ```

2. **From Shopify Admin** (if creating new app):
   - Go to Apps > App and sales channel settings
   - Create a private app
   - Generate access token with required scopes

### Required Shopify Scopes

Your Shopify app needs these scopes:
- `read_products` - Read product information
- `read_product_listings` - Read product listings
- `read_inventory` - Read inventory levels (optional)

## 🛠️ API Endpoints

### Auction Endpoints (Updated)

#### Get Auctions with Product Data
```http
GET /api/auctions/with-product-data?refresh=true
```

#### Refresh Product Data for Single Auction
```http
PUT /api/auctions/:id/refresh-product
```

#### Refresh All Product Data
```http
PUT /api/auctions/refresh-all-products
```

### Shopify Endpoints (New)

#### Product Operations
```http
GET /api/shopify/products/search?q=query&limit=10
GET /api/shopify/products/suggestions?q=query&limit=20
GET /api/shopify/products?limit=50&page_info=cursor
GET /api/shopify/products/:productId
GET /api/shopify/products/:productId/validate
GET /api/shopify/products/:productId/inventory
POST /api/shopify/products/batch
```

#### Advanced Product Queries
```http
GET /api/shopify/products/handle/:handle
GET /api/shopify/products/vendor/:vendor?limit=50
GET /api/shopify/products/type/:productType?limit=50
POST /api/shopify/products/tags
```

#### Service Status
```http
GET /api/shopify/status
```

## 📊 Data Structure

### Product Data Format

When you create an auction, the system automatically fetches and caches this product data:

```javascript
{
  "productData": {
    "id": "123456789",
    "title": "Amazing Product",
    "handle": "amazing-product",
    "description": "Product description without HTML tags",
    "price": 29.99,
    "compareAtPrice": 39.99,
    "image": {
      "src": "https://cdn.shopify.com/image.jpg",
      "alt": "Product image",
      "width": 800,
      "height": 600
    },
    "images": [
      {
        "src": "https://cdn.shopify.com/image1.jpg",
        "alt": "Product image 1",
        "width": 800,
        "height": 600
      }
    ],
    "vendor": "Your Brand",
    "productType": "Electronics",
    "tags": ["featured", "sale"],
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "variants": [
      {
        "id": "987654321",
        "title": "Default Title",
        "price": 29.99,
        "compareAtPrice": 39.99,
        "sku": "PROD-001",
        "inventory": 100,
        "available": true
      }
    ]
  }
}
```

## 🎯 Usage Examples

### Frontend Integration

#### Admin Dashboard
```javascript
import { shopifyAPI } from './services/api.js';

// Search products for auction creation
const products = await shopifyAPI.searchProducts('laptop', 10);

// Get product suggestions for autocomplete
const suggestions = await shopifyAPI.getProductSuggestions('lap', 20);

// Refresh product data for an auction
await auctionAPI.refreshProductData(auctionId);
```

#### Customer Frontend
```javascript
import { shopifyAPI } from './services/api.js';

// Get detailed product information
const product = await shopifyAPI.getProduct(productId);

// Search products
const products = await shopifyAPI.searchProducts('search term', 5);
```

### Backend Usage

#### Creating an Auction with Product Data
```javascript
// The system automatically fetches and caches product data
const auction = await Auction.create({
  shopifyProductId: '123456789',
  startTime: new Date(),
  endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  startingBid: 10,
  buyNowPrice: 50
});
// productData is automatically populated
```

#### Manual Product Data Refresh
```javascript
// Refresh single auction
const updatedAuction = await shopifyService.refreshProductData(auctionId);

// Refresh all auctions
const results = await shopifyService.refreshAllProductData();
```

## 🔄 Automatic Product Data Updates

### When Product Data is Fetched

1. **Auction Creation**: Automatically fetches and caches product data
2. **Manual Refresh**: Via API endpoints or admin dashboard
3. **Bulk Refresh**: Refresh all auctions at once

### Error Handling

- If Shopify is unavailable, auctions can still be created without product data
- Failed product fetches are logged but don't break auction creation
- Product data refresh failures are reported with specific error messages

## 🚨 Error Handling

### Common Errors

1. **Invalid Product ID**: `Product with ID 123 not found`
2. **Shopify Unavailable**: `Failed to fetch product: Network error`
3. **Invalid Access Token**: `401 Unauthorized`
4. **Rate Limiting**: `429 Too Many Requests`

### Error Response Format

```javascript
{
  "success": false,
  "message": "Failed to fetch product 123: Product not found",
  "error": "PRODUCT_NOT_FOUND"
}
```

## 🔧 Troubleshooting

### Product Data Not Loading

1. **Check Shopify credentials**:
   ```bash
   curl http://localhost:5000/api/shopify/status
   ```

2. **Verify product ID exists**:
   ```bash
   curl http://localhost:5000/api/shopify/products/123/validate
   ```

3. **Test direct product fetch**:
   ```bash
   curl http://localhost:5000/api/shopify/products/123
   ```

### Common Issues

1. **Access Token Expired**: Regenerate token in Shopify admin
2. **Wrong Shop Domain**: Ensure domain includes `.myshopify.com`
3. **Insufficient Scopes**: Add required scopes to your Shopify app
4. **Rate Limiting**: Implement retry logic for production use

## 🚀 Production Considerations

### Rate Limiting
- Shopify has API rate limits (40 requests per second)
- Implement exponential backoff for retries
- Consider caching strategies for high-traffic scenarios

### Performance
- Product data is cached in MongoDB for fast access
- Use pagination for large product lists
- Consider background jobs for bulk operations

### Security
- Store access tokens securely
- Use environment variables for configuration
- Implement proper error handling to avoid token exposure

## 📈 Future Enhancements

### Planned Features
- [ ] Real-time product updates via webhooks
- [ ] Product image optimization and CDN integration
- [ ] Advanced product filtering and search
- [ ] Product recommendation engine
- [ ] Inventory synchronization
- [ ] Price change notifications

### Integration Opportunities
- [ ] Shopify webhook integration
- [ ] Product variant management
- [ ] Inventory tracking
- [ ] Order fulfillment integration
- [ ] Customer data synchronization

---

## 🎉 You're All Set!

Your auction system now has full Shopify integration! You can:

✅ **Create auctions** with real product data
✅ **Display product images** and information
✅ **Search products** from your Shopify store
✅ **Refresh product data** when needed
✅ **Handle product updates** automatically

**Next Steps:**
1. Add your Shopify access token to the `.env` file
2. Start your backend server
3. Test the integration with your frontend applications
4. Create your first auction with real product data!

Happy auctioning! 🎯
