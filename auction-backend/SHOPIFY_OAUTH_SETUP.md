# 🚀 Shopify OAuth Setup Guide

This guide will help you set up Shopify OAuth for your Bidly Auction App so that each store can authenticate and access their products.

## 📋 Prerequisites

1. **Shopify Partner Account**: You need a Shopify Partner account to create apps
2. **ngrok Account**: For local development tunneling
3. **MongoDB**: For storing store tokens and data

## 🔧 Step 1: Create a Shopify App

### 1.1 Go to Shopify Partner Dashboard
1. Visit [partners.shopify.com](https://partners.shopify.com)
2. Log in with your Shopify Partner account
3. Click **"Apps"** in the left sidebar
4. Click **"Create app"**

### 1.2 Configure Your App
1. **App name**: `Bidly Auction App` (or your preferred name)
2. **App URL**: `https://your-ngrok-url.ngrok-free.dev`
3. **Allowed redirection URL(s)**: `https://your-ngrok-url.ngrok-free.dev/auth/shopify/callback`

### 1.3 Get Your Credentials
After creating the app, you'll get:
- **API key** (Client ID)
- **API secret key** (Client Secret)

## 🌐 Step 2: Set Up ngrok

### 2.1 Install ngrok
```bash
# Download from https://ngrok.com/download
# Or install via package manager
npm install -g ngrok
```

### 2.2 Start ngrok
```bash
# Start ngrok on your backend port
ngrok http 5000
```

### 2.3 Get Your ngrok URL
Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.dev`)

## ⚙️ Step 3: Configure Environment Variables

### 3.1 Create `.env` file
Create a `.env` file in your `auction-backend` directory:

```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/bidly-auctions

# Server Configuration
PORT=5000
NODE_ENV=development

# Shopify OAuth Configuration
SHOPIFY_API_KEY=your_api_key_from_partner_dashboard
SHOPIFY_API_SECRET=your_api_secret_from_partner_dashboard
SHOPIFY_REDIRECT_URI=https://your-ngrok-url.ngrok-free.dev/auth/shopify/callback

# Email Configuration (for notifications)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### 3.2 Update App URLs in Shopify
1. Go back to your Shopify Partner Dashboard
2. Edit your app
3. Update the **App URL** to your ngrok URL
4. Update the **Allowed redirection URL(s)** to include your callback URL

## 🚀 Step 4: Test the OAuth Flow

### 4.1 Start Your Backend
```bash
cd auction-backend
npm run dev
```

### 4.2 Test Installation
1. Visit: `https://your-ngrok-url.ngrok-free.dev/auth/shopify/install?shop=your-test-store.myshopify.com`
2. You should be redirected to Shopify's OAuth page
3. After approval, you'll be redirected back to your app
4. Check your MongoDB to see the store record created

### 4.3 Test Product Fetching
```bash
# Test the Shopify API with your store
curl "https://your-ngrok-url.ngrok-free.dev/api/shopify/products?shop=your-test-store.myshopify.com&limit=5"
```

## 🔍 Step 5: Verify Everything Works

### 5.1 Check Store Installation
```bash
curl "https://your-ngrok-url.ngrok-free.dev/auth/shopify/status?shop=your-test-store.myshopify.com"
```

### 5.2 Test Product Search
```bash
curl "https://your-ngrok-url.ngrok-free.dev/api/shopify/search?shop=your-test-store.myshopify.com&q=test"
```

### 5.3 Check Service Status
```bash
curl "https://your-ngrok-url.ngrok-free.dev/api/shopify/status?shop=your-test-store.myshopify.com"
```

## 🏗️ Step 6: Update Frontend

### 6.1 Update Admin Frontend
The admin frontend needs to include the shop parameter in all API calls:

```javascript
// In your API calls, add the shop parameter
const response = await api.get(`/api/shopify/products?shop=${shopDomain}`);
```

### 6.2 Update Customer Frontend
The customer frontend should also include the shop parameter for consistency.

## 🔐 Step 7: Security Considerations

### 7.1 HMAC Verification
The OAuth flow includes HMAC verification to ensure requests are from Shopify.

### 7.2 Token Storage
- Access tokens are stored securely in MongoDB
- Tokens are not included in API responses
- Each store has its own isolated token

### 7.3 Webhook Security
- Uninstall webhooks are handled automatically
- Store status is updated when apps are uninstalled

## 🚨 Troubleshooting

### Common Issues

#### 1. "Store not found" Error
- **Cause**: Store hasn't completed OAuth flow
- **Solution**: Visit the install URL first

#### 2. "Invalid HMAC" Error
- **Cause**: Request signature verification failed
- **Solution**: Check your API secret key

#### 3. "Redirect URI mismatch" Error
- **Cause**: Callback URL doesn't match what's configured in Shopify
- **Solution**: Update the redirect URI in your Shopify app settings

#### 4. "Access denied" Error
- **Cause**: Store owner didn't approve the app
- **Solution**: Try the installation flow again

### Debug Commands

```bash
# Check if store is installed
curl "https://your-ngrok-url.ngrok-free.dev/auth/shopify/status?shop=your-store.myshopify.com"

# Test connection
curl "https://your-ngrok-url.ngrok-free.dev/api/shopify/test?shop=your-store.myshopify.com"

# Get service status
curl "https://your-ngrok-url.ngrok-free.dev/api/shopify/status?shop=your-store.myshopify.com"
```

## 📚 API Endpoints

### OAuth Endpoints
- `GET /auth/shopify/install?shop=store.myshopify.com` - Start OAuth flow
- `GET /auth/shopify/callback` - OAuth callback (handled by Shopify)
- `GET /auth/shopify/status?shop=store.myshopify.com` - Check installation status
- `GET /auth/shopify/store?shop=store.myshopify.com` - Get store info

### Shopify API Endpoints (all require `?shop=store.myshopify.com`)
- `GET /api/shopify/products` - Get all products
- `GET /api/shopify/search?q=query` - Search products
- `GET /api/shopify/products/:id` - Get specific product
- `GET /api/shopify/status` - Get service status
- `GET /api/shopify/test` - Test connection

## 🎉 Success!

Once everything is working:
1. ✅ Stores can install your app via OAuth
2. ✅ Each store's access token is stored securely
3. ✅ Your app can fetch products from each store
4. ✅ The auction system works with real Shopify products
5. ✅ Multiple stores can use your app simultaneously

## 🔄 Next Steps

1. **Deploy to Production**: Update your production environment variables
2. **Set Up Webhooks**: Configure additional Shopify webhooks if needed
3. **Monitor Usage**: Track which stores are using your app
4. **Add Features**: Extend the app with more Shopify integrations

---

**Need Help?** Check the console logs for detailed error messages and debug information.
