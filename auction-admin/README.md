# Bidly Auction Admin Dashboard

A React admin dashboard built with Shopify Polaris for managing auctions in your Shopify store.

## Features

- **Auction Management**: Create, edit, delete, and view auctions
- **Real-time Data**: Live auction status and bid tracking
- **Shopify Integration**: Connect auctions to Shopify products
- **Advanced Filtering**: Filter auctions by status, product, and more
- **Bid History**: Complete bid tracking with timestamps
- **Responsive Design**: Works on desktop and mobile devices

## Components

### Dashboard
- Overview statistics
- Quick actions
- Auction table with pagination
- Real-time updates

### Auction Table
- Sortable columns
- Advanced filtering
- Bulk actions
- Status indicators

### Auction Form
- Create new auctions
- Edit existing auctions
- Validation and error handling
- Shopify product integration

### Auction Details
- Complete auction information
- Bid history table
- Real-time status updates
- Action buttons

## Setup

1. **Install dependencies:**
   ```bash
   cd auction-admin
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp env.example .env
   # Edit .env with your API URL
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## API Integration

The dashboard connects to the auction backend API with the following endpoints:

- `GET /api/auctions` - List all auctions
- `POST /api/auctions` - Create auction
- `GET /api/auctions/:id` - Get auction details
- `PUT /api/auctions/:id` - Update auction
- `DELETE /api/auctions/:id` - Delete auction
- `POST /api/auctions/:id/bid` - Place bid
- `GET /api/auctions/stats` - Get statistics

## Usage

### Creating Auctions
1. Click "Create Auction" button
2. Select Shopify product
3. Set start and end times
4. Configure starting bid and buy now price
5. Save auction

### Managing Auctions
- View all auctions in the table
- Filter by status or product
- Edit auction details
- Close auctions manually
- Delete auctions (if no bids)

### Monitoring Bids
- View bid history in auction details
- Track current highest bid
- Monitor auction status
- Real-time updates

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Technologies

- **React 18** - UI framework
- **Shopify Polaris** - Design system
- **Vite** - Build tool
- **Axios** - HTTP client
- **date-fns** - Date utilities

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
