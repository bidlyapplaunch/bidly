# Shopify Embedded App Setup Guide

## 🚀 **Overview**

This guide will help you convert your Bidly Auction App into a proper Shopify embedded app using App Bridge.

## 📋 **Prerequisites**

- ✅ Shopify Partner account
- ✅ Development store
- ✅ ngrok running (for local development)
- ✅ All dependencies installed

## 🔧 **Setup Steps**

### **Step 1: Update Environment Variables**

Add these to your `.env` file:

```bash
# App Configuration
APP_URL=https://your-ngrok-url.ngrok-free.dev
JWT_SECRET=your_secure_jwt_secret_here
```

### **Step 2: Update Shopify Partner Dashboard**

1. Go to your Shopify Partner Dashboard
2. Select your app
3. Update the following settings:

**App URL:**
```
https://your-ngrok-url.ngrok-free.dev
```

**Allowed redirection URL(s):**
```
https://your-ngrok-url.ngrok-free.dev/auth/shopify/callback
```

**App Bridge settings:**
- ✅ Enable App Bridge
- ✅ Set App URL to your ngrok URL

### **Step 3: Update shopify.app.toml**

Replace the placeholder values in `shopify.app.toml`:

```toml
name = "bidly-auction-app"
client_id = "your_actual_shopify_api_key"
application_url = "https://your-actual-ngrok-url.ngrok-free.dev"
embedded = true

[auth]
redirect_urls = [
  "https://your-actual-ngrok-url.ngrok-free.dev/auth/shopify/callback"
]

[build]
dev_store_url = "your-actual-dev-store.myshopify.com"
```

### **Step 4: Start Your Services**

1. **Start Backend:**
```bash
cd auction-backend
npm run dev
```

2. **Start Admin Frontend:**
```bash
cd auction-admin
npm run dev
```

3. **Start ngrok:**
```bash
ngrok http 5000
```

### **Step 5: Test the Embedded App**

1. **Install the app in your dev store:**
   - Go to your Shopify Partner Dashboard
   - Click "Test on development store"
   - Or visit: `https://your-ngrok-url.ngrok-free.dev/auth/shopify/install?shop=your-dev-store.myshopify.com`

2. **Verify App Bridge functionality:**
   - The app should load inside the Shopify admin
   - Check browser console for App Bridge initialization messages
   - Verify that toasts appear in Shopify admin interface

## 🧪 **Testing Checklist**

### **OAuth Flow**
- [ ] App installs successfully in dev store
- [ ] OAuth redirects work properly
- [ ] Store data is saved to database
- [ ] Access tokens are stored correctly

### **App Bridge Integration**
- [ ] App loads in Shopify admin iframe
- [ ] App Bridge initializes without errors
- [ ] Shop information displays correctly
- [ ] Navigation works within the app

### **Functionality**
- [ ] Product search works with real Shopify products
- [ ] Auction creation works
- [ ] Bidding functionality works
- [ ] Analytics display correctly
- [ ] Real-time updates work

### **UI/UX**
- [ ] App Bridge toasts appear in Shopify admin
- [ ] Modals work properly in iframe
- [ ] Styling is consistent with Shopify admin
- [ ] Responsive design works

## 🐛 **Troubleshooting**

### **Common Issues**

1. **"App Bridge initialization error"**
   - Check that `SHOPIFY_API_KEY` is correct
   - Verify the shop parameter is in the URL
   - Ensure the store is installed and has access token

2. **"CORS errors"**
   - Verify ngrok URL is correct in all configurations
   - Check that CORS headers are properly set
   - Ensure all services are using the same ngrok URL

3. **"Authentication failed"**
   - Check JWT_SECRET is set
   - Verify App Bridge token generation
   - Ensure OAuth flow completed successfully

4. **"Product search not working"**
   - Verify store has access token
   - Check Shopify API permissions
   - Ensure product data is being fetched correctly

### **Debug Mode**

Enable debug logging by adding to your `.env`:

```bash
DEBUG=app-bridge,oauth,shopify
```

## 🚀 **Production Deployment**

When ready for production:

1. **Update environment variables** with production URLs
2. **Deploy backend** to your hosting service
3. **Deploy frontend** to your hosting service
4. **Update Shopify Partner Dashboard** with production URLs
5. **Test in production environment**

## 📚 **Additional Resources**

- [Shopify App Bridge Documentation](https://shopify.dev/docs/apps/tools/app-bridge)
- [Shopify OAuth Documentation](https://shopify.dev/docs/apps/auth/oauth)
- [Shopify Embedded Apps Guide](https://shopify.dev/docs/apps/tools/app-bridge/getting-started/embedded)

## 🎉 **Success Criteria**

Your app is successfully embedded when:
- ✅ Loads inside Shopify admin iframe
- ✅ OAuth flow works seamlessly
- ✅ All functionality preserved
- ✅ App Bridge components work
- ✅ Real-time updates function
- ✅ Product integration works

---

**Need help?** Check the console logs and ensure all environment variables are correctly set.
