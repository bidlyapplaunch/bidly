import mongoose from 'mongoose';

const bidSchema = new mongoose.Schema({
  bidder: {
    type: String,
    required: true,
    trim: true
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
  status: {
    type: String,
    enum: ['pending', 'active', 'ended', 'closed'],
    default: 'pending',
    index: true
  },
  bidHistory: [bidSchema],
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
auctionSchema.index({ shopifyProductId: 1, status: 1 });
auctionSchema.index({ endTime: 1, status: 1 });

// Virtual for checking if auction is currently active
auctionSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && this.startTime <= now && this.endTime > now;
});

// Method to add a bid
auctionSchema.methods.addBid = function(bidder, amount) {
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
    amount,
    timestamp: now
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
