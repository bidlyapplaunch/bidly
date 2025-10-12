# Bidly Customer Frontend

A React-based customer-facing auction page for Shopify auctions with real-time bidding functionality.

## Features

### 🏷️ **Auction Display**
- **Active Auctions Only** - Shows only auctions that are currently accepting bids
- **Product Information** - Displays Shopify product ID and details
- **Product Images** - Placeholder for Shopify product images (ready for integration)
- **Auction Status** - Shows active/pending/closed status with color coding

### ⏰ **Countdown Timer**
- **Real-time Countdown** - Updates every second showing time remaining
- **Multiple Formats** - Shows days, hours, minutes, seconds
- **Auto-expiration** - Automatically shows "Auction Ended" when time runs out
- **Visual Indicators** - Color-coded badges for time status

### 💰 **Bidding System**
- **Current Highest Bid** - Shows the current winning bid amount
- **Starting Bid** - Displays the minimum bid amount
- **Buy Now Price** - Optional instant purchase price
- **Bid Form** - Easy-to-use form for placing bids
- **Quick Bid Buttons** - One-click bidding for common amounts
- **Bid Validation** - Ensures bids meet minimum requirements

### 🔄 **Real-time Updates**
- **WebSocket Connection** - Live connection to backend
- **Instant Bid Updates** - See new bids immediately
- **Toast Notifications** - Notifications when others place bids
- **Live Status Updates** - Auction status changes in real-time

### 📱 **User Interface**
- **Shopify Polaris Design** - Consistent with Shopify's design system
- **Responsive Layout** - Works on desktop and mobile
- **Modal Details** - Detailed auction view with bid history
- **Loading States** - Spinners and loading indicators
- **Error Handling** - Clear error messages and validation

## Components

### `AuctionCard`
- Main auction display component
- Shows product info, current bid, countdown timer
- Handles bid placement and modal opening

### `CountdownTimer`
- Real-time countdown to auction end
- Auto-updates every second
- Shows expired state when time runs out

### `BidForm`
- Form for placing new bids
- Validation and quick bid buttons
- Loading states during bid submission

## API Integration

### Backend API
- **GET /api/auctions?status=active** - Fetch active auctions
- **GET /api/auctions/:id** - Get specific auction details
- **POST /api/auctions/:id/bid** - Place a bid on an auction

### WebSocket Events
- **join-auction** - Join auction room for real-time updates
- **leave-auction** - Leave auction room
- **bid-update** - Receive real-time bid updates

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Access the App**
   - Open http://localhost:3002
   - Make sure backend is running on port 5000

## Environment Setup

- **Backend API**: http://localhost:5000/api
- **WebSocket Server**: http://localhost:5000
- **Frontend Port**: 3002

## Future Enhancements

- **Shopify Product API Integration** - Fetch real product images and details
- **User Authentication** - Login system for bidders
- **Bid History** - Detailed bid tracking and analytics
- **Push Notifications** - Browser notifications for bid updates
- **Mobile App** - React Native version for mobile devices

## Tech Stack

- **React 18** - Frontend framework
- **Shopify Polaris** - UI component library
- **Socket.IO Client** - Real-time WebSocket communication
- **Axios** - HTTP client for API requests
- **Vite** - Build tool and development server
