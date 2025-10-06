# Bidly Auction Backend

A Node.js + Express backend for a Shopify auction app using MongoDB. This API provides complete auction management functionality with bid validation and real-time updates.

## Features

- **Auction Management**: Create, read, update, and delete auctions
- **Bid System**: Place bids with automatic validation
- **Data Validation**: Comprehensive input validation and error handling
- **MongoDB Integration**: Optimized queries with proper indexing
- **Security**: Helmet, CORS, and input sanitization
- **Pagination**: Efficient data retrieval with pagination support

## API Endpoints

### Auctions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auctions` | Create a new auction |
| GET | `/api/auctions` | Get all auctions (with pagination) |
| GET | `/api/auctions/:id` | Get single auction by ID |
| PUT | `/api/auctions/:id` | Update auction |
| DELETE | `/api/auctions/:id` | Delete auction |
| POST | `/api/auctions/:id/bid` | Place a bid on auction |
| GET | `/api/auctions/stats` | Get auction statistics |

### Query Parameters

- `status`: Filter by auction status (active/closed)
- `shopifyProductId`: Filter by Shopify product ID
- `page`: Page number for pagination (default: 1)
- `limit`: Items per page (default: 10)

## Data Models

### Auction Schema

```javascript
{
  shopifyProductId: String,    // Required, indexed
  startTime: Date,             // Required, indexed
  endTime: Date,               // Required, indexed, must be > startTime
  startingBid: Number,         // Required, min: 0
  currentBid: Number,          // Default: 0, min: 0
  buyNowPrice: Number,         // Optional, min: 0
  status: String,              // Enum: ['active', 'closed'], default: 'active'
  bidHistory: [Bid],          // Array of bid objects
  createdAt: Date,             // Auto-generated
  updatedAt: Date              // Auto-updated
}
```

### Bid Schema

```javascript
{
  bidder: String,              // Required, trimmed
  amount: Number,              // Required, min: 0
  timestamp: Date              // Auto-generated
}
```

## Installation

1. **Install dependencies:**
   ```bash
   cd auction-backend
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   # Edit .env with your MongoDB connection string
   ```

3. **Start MongoDB:**
   ```bash
   # Local MongoDB
   mongod
   
   # Or use MongoDB Atlas (update MONGODB_URI in .env)
   ```

4. **Run the server:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Usage Examples

### Create Auction

```bash
curl -X POST http://localhost:5000/api/auctions \
  -H "Content-Type: application/json" \
  -d '{
    "shopifyProductId": "prod_123",
    "startTime": "2024-01-15T10:00:00Z",
    "endTime": "2024-01-20T18:00:00Z",
    "startingBid": 100,
    "buyNowPrice": 500
  }'
```

### Place Bid

```bash
curl -X POST http://localhost:5000/api/auctions/AUCTION_ID/bid \
  -H "Content-Type: application/json" \
  -d '{
    "bidder": "john_doe",
    "amount": 150
  }'
```

### Get All Auctions

```bash
curl "http://localhost:5000/api/auctions?status=active&page=1&limit=5"
```

## Validation Rules

### Auction Creation
- `shopifyProductId`: Required, non-empty string
- `startTime`: Required, valid ISO 8601 date, must be in future
- `endTime`: Required, valid ISO 8601 date, must be after startTime
- `startingBid`: Required, positive number
- `buyNowPrice`: Optional, positive number

### Bid Placement
- `bidder`: Required, 1-100 characters
- `amount`: Required, positive number, must be higher than current bid
- Auction must be active and within time bounds

### Update Restrictions
- Cannot update `startingBid`, `startTime`, or `endTime` after bids are placed
- Cannot delete auctions with existing bids

## Error Handling

The API returns consistent error responses:

```javascript
{
  "success": false,
  "message": "Error description",
  "errors": [...] // For validation errors
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `404`: Not Found
- `500`: Internal Server Error

## Database Indexes

Optimized for common queries:
- `shopifyProductId` + `status`
- `endTime` + `status`
- Individual indexes on `shopifyProductId`, `startTime`, `endTime`, `status`

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use MongoDB Atlas or secure MongoDB instance
3. Configure proper CORS origins
4. Set up monitoring and logging
5. Use environment variables for all configuration
