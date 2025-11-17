import mongoose from 'mongoose';

const bidSchema = new mongoose.Schema({
  bidder: {
    type: String,
    required: true,
    trim: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null
  },
  customerEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const auctionSchema = new mongoose.Schema({
  shopDomain: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  shopifyProductId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  // Cached Shopify product data
  productData: {
    id: String,
    title: String,
    handle: String,
    description: String,
    price: Number,
    compareAtPrice: Number,
    image: {
      src: String,
      alt: String,
      width: Number,
      height: Number
    },
    images: [{
      src: String,
      alt: String,
      width: Number,
      height: Number
    }],
    vendor: String,
    productType: String,
    tags: [String],
    status: String,
    createdAt: Date,
    updatedAt: Date,
    variants: [{
      id: String,
      title: String,
      price: Number,
      compareAtPrice: Number,
      sku: String,
      inventory: Number,
      available: Boolean
    }]
  },
  startTime: {
    type: Date,
    required: true,
    index: true
  },
  endTime: {
    type: Date,
    required: true,
    index: true,
    validate: {
      validator: function(value) {
        return value > this.startTime;
      },
      message: 'End time must be after start time'
    }
  },
  startingBid: {
    type: Number,
    required: true,
    min: 0
  },
  currentBid: {
    type: Number,
    default: 0,
    min: 0
  },
  buyNowPrice: {
    type: Number,
    min: 0
  },
  reservePrice: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'ended', 'closed', 'reserve_not_met'],
    default: 'pending',
    index: true
  },
  // Soft delete fields
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  },
  bidHistory: [bidSchema],
  
  // Winner processing fields
  winner: {
    bidder: String,
    bidderEmail: String,
    amount: Number,
    timestamp: Date,
    customerId: String
  },
  
  privateProduct: {
    productId: String,
    productHandle: String,
    productTitle: String,
    productUrl: String,
    createdAt: Date
  },
  
  // Draft order fields (for Shopify invoice system)
  draftOrderId: {
    type: String,
    default: null
  },
  duplicatedProductId: {
    type: String,
    default: null
  },
  invoiceSent: {
    type: Boolean,
    default: false
  },

  winnerProcessingLock: {
    type: Boolean,
    default: false
  },
  
  winnerProcessed: {
    type: Boolean,
    default: false
  },
  
  winnerProcessedAt: {
    type: Date
  },
  
  // Popcorn auction settings
  popcornEnabled: {
    type: Boolean,
    default: false
  },
  popcornExtendSeconds: {
    type: Number,
    default: 15,
    min: 5,
    max: 300 // Max 5 minutes extension
  },
  popcornTriggerSeconds: {
    type: Number,
    default: 10,
    min: 1,
    max: 60 // Max 1 minute trigger threshold
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
auctionSchema.index({ shopDomain: 1, status: 1 });
// Partial unique index: only enforce uniqueness for non-deleted auctions
// This allows relisting products from soft-deleted auctions
// Note: All documents should have isDeleted field (defaults to false)
auctionSchema.index(
  { shopDomain: 1, shopifyProductId: 1 },
  { 
    unique: true,
    partialFilterExpression: { isDeleted: false }
  }
);
auctionSchema.index({ shopDomain: 1, endTime: 1, status: 1 });

// Virtual for checking if auction is currently active
auctionSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && this.startTime <= now && this.endTime > now;
});

// Method to add a bid
auctionSchema.methods.addBid = function(bidder, amount, customerEmail, customerId = null) {
  if (this.status !== 'active') {
    throw new Error('Auction is not active');
  }
  
  const now = new Date();
  if (now < this.startTime || now > this.endTime) {
    throw new Error('Auction is not currently active');
  }
  
  if (amount <= this.currentBid) {
    throw new Error('Bid amount must be higher than current bid');
  }
  
  const bid = {
    bidder,
    customerEmail,
    amount,
    timestamp: now,
    customerId: customerId || null
  };
  
  this.bidHistory.push(bid);
  this.currentBid = amount;
  this.updatedAt = now;
  
  return this.save();
};

// Method to close auction
auctionSchema.methods.closeAuction = function() {
  this.status = 'closed';
  this.updatedAt = new Date();
  return this.save();
};

// Pre-save middleware to update updatedAt
auctionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Auction', auctionSchema);
