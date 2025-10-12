# 🧪 **Bidly Auction Platform - Testing Guide**

## 🚀 **Quick Start**

### **1. Start the System**
```bash
# Terminal 1 - Backend (Port 5000)
cd auction-backend
npm start

# Terminal 2 - Admin Dashboard (Port 3001)
cd auction-admin
npm run dev

# Terminal 3 - Customer Frontend (Port 3002)
cd auction-customer
npm run dev
```

### **2. Create Test Accounts**
```bash
# In auction-backend directory
npm run setup-test-accounts
```

**Test Accounts Created:**
- **Admin**: `admin@bidly.com` / `password123`
- **Customer**: `customer@bidly.com` / `password123`
- **Test User**: `test@bidly.com` / `password123`

---

## 🎯 **Core Functionality Tests**

### **Test 1: Admin Dashboard Access**
1. Open `http://localhost:3001`
2. Login with `admin@bidly.com` / `password123`
3. ✅ Verify dashboard loads with statistics
4. ✅ Verify "Create Auction" button is visible

### **Test 2: Create Auction**
1. Click "Create Auction" button
2. Fill in auction details:
   - **Product**: Search and select a Shopify product
   - **Start Time**: Set to current time + 1 minute
   - **End Time**: Set to current time + 1 hour
   - **Starting Bid**: $50
   - **Buy Now Price**: $200 (optional)
3. Click "Save Auction"
4. ✅ Verify auction appears in the auctions list
5. ✅ Verify status shows as "Pending" initially

### **Test 3: Real-Time Bid Updates**
1. Open `http://localhost:3002` (Customer Frontend)
2. Open a second browser window/tab to the same URL
3. Find an active auction and place a bid in the first window
4. ✅ Verify the second window updates immediately without refresh
5. ✅ Verify toast notification appears in both windows

### **Test 4: Email Notifications**
1. Place a bid using `test@bidly.com` credentials
2. ✅ Check email inbox for bid confirmation
3. Place another bid with different amount from another account
4. ✅ Check for outbid notification email

### **Test 5: Buy Now Functionality**
1. Find an auction with "Buy Now" price set
2. Click "Buy Now" button
3. Confirm the purchase
4. ✅ Verify auction ends immediately
5. ✅ Verify winner notification email sent

### **Test 6: Analytics Dashboard**
1. In admin dashboard, click "Analytics" tab
2. ✅ Verify analytics data loads
3. ✅ Verify different time periods work (7d, 30d, 90d, 1y)
4. ✅ Verify revenue metrics display correctly

---

## 🔍 **Edge Case Tests**

### **Test 7: Invalid Bid Handling**
1. Try to place bid lower than current bid
2. ✅ Verify error message appears
3. Try to place bid on ended auction
4. ✅ Verify appropriate error message

### **Test 8: Network Error Handling**
1. Disconnect internet connection
2. Try to place a bid
3. ✅ Verify "No internet connection" error appears
4. Reconnect and verify system recovers

### **Test 9: WebSocket Connection**
1. Check connection status indicator at top of customer page
2. ✅ Should show "🟢 Connected to live updates"
3. If backend restarts, verify reconnection works

### **Test 10: Authentication**
1. Try accessing admin dashboard without login
2. ✅ Should redirect to login page
3. Try accessing with wrong credentials
4. ✅ Should show error message

---

## 🎨 **UI/UX Tests**

### **Test 11: Responsive Design**
1. Test on different screen sizes
2. ✅ Verify tables don't overflow horizontally
3. ✅ Verify buttons and forms are usable on mobile

### **Test 12: Loading States**
1. Place a bid and verify loading spinner appears
2. ✅ Button should show "Placing Bid..." text
3. ✅ Form should be disabled during submission

### **Test 13: Error Messages**
1. Test various error scenarios
2. ✅ Error messages should be clear and helpful
3. ✅ Toast notifications should appear for success/error states

---

## 📊 **Performance Tests**

### **Test 14: Multiple Users**
1. Open 3+ browser windows
2. Have multiple users place bids simultaneously
3. ✅ All windows should update in real-time
4. ✅ No data conflicts or inconsistencies

### **Test 15: Large Data Sets**
1. Create 10+ auctions
2. ✅ Admin dashboard should handle pagination
3. ✅ Customer frontend should load efficiently

---

## 🚨 **Known Issues & Workarounds**

### **Issue 1: Shopify Product Search**
- **Problem**: If Shopify API is not configured, products won't load
- **Workaround**: Use mock products for testing
- **Solution**: Configure Shopify credentials in `.env` file

### **Issue 2: Email Notifications**
- **Problem**: Emails not sending
- **Check**: Verify EMAIL_USER and EMAIL_PASS in `.env`
- **Solution**: Use Gmail app password for authentication

### **Issue 3: WebSocket Connection**
- **Problem**: Real-time updates not working
- **Check**: Verify backend is running on port 5000
- **Solution**: Restart backend server

---

## ✅ **Testing Checklist**

### **Pre-Testing Setup**
- [ ] Backend server running on port 5000
- [ ] Admin dashboard running on port 3001
- [ ] Customer frontend running on port 3002
- [ ] Test accounts created
- [ ] Email credentials configured

### **Core Features**
- [ ] Admin login/logout
- [ ] Create auction
- [ ] Place bid
- [ ] Real-time updates
- [ ] Email notifications
- [ ] Buy now functionality
- [ ] Analytics dashboard

### **Error Handling**
- [ ] Invalid bid amounts
- [ ] Network errors
- [ ] Authentication errors
- [ ] Auction not found errors

### **UI/UX**
- [ ] Loading states
- [ ] Error messages
- [ ] Success notifications
- [ ] Responsive design

---

## 🎉 **Success Criteria**

**The system is ready for MVP testing when:**
- ✅ All core functionality tests pass
- ✅ Real-time updates work between multiple browsers
- ✅ Email notifications are received
- ✅ Error handling provides clear feedback
- ✅ UI is responsive and user-friendly
- ✅ Authentication and authorization work properly

**Total Estimated Testing Time: 30-45 minutes**
