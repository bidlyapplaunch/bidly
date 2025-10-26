import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  // Shopify customer data
  shopifyId: {
    type: String,
    default: null,
    index: true
  },
  
  // Basic customer info
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Customer type
  isTemp: {
    type: Boolean,
    default: false
  },
  
  // Store association
  shopDomain: {
    type: String,
    required: true,
    index: true
  },
  
  // Bidding history and stats
  bidHistory: [{
    auctionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auction'
    },
    amount: {
      type: Number,
      required: true
    },
    bidTime: {
      type: Date,
      default: Date.now
    },
    isWinning: {
      type: Boolean,
      default: false
    }
  }],
  
  // Auction participation stats
  totalBids: {
    type: Number,
    default: 0
  },
  
  auctionsWon: {
    type: Number,
    default: 0
  },
  
  totalBidAmount: {
    type: Number,
    default: 0
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  lastLoginAt: {
    type: Date,
    default: Date.now
  },
  
  // Shopify customer metafields (for syncing back to Shopify)
  shopifyMetafields: {
    auctionHistory: [{
      auctionId: String,
      productTitle: String,
      bidAmount: Number,
      won: Boolean,
      date: Date
    }],
    totalAuctionsWon: {
      type: Number,
      default: 0
    },
    totalBidAmount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
customerSchema.index({ email: 1, shopDomain: 1 });
customerSchema.index({ shopifyId: 1, shopDomain: 1 });
customerSchema.index({ isTemp: 1, shopDomain: 1 });

// Virtual for full name
customerSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Method to add a bid to customer history
customerSchema.methods.addBid = function(auctionId, amount, isWinning = false) {
  this.bidHistory.push({
    auctionId,
    amount,
    bidTime: new Date(),
    isWinning
  });
  
  this.totalBids += 1;
  this.totalBidAmount += amount;
  
  if (isWinning) {
    this.auctionsWon += 1;
  }
  
  return this.save();
};

// Method to sync with Shopify metafields
customerSchema.methods.syncToShopify = function() {
  if (!this.shopifyId || this.isTemp) {
    return null; // Don't sync temp customers
  }
  
  // This would be called when updating Shopify customer metafields
  return {
    customerId: this.shopifyId,
    metafields: {
      auction_history: JSON.stringify(this.shopifyMetafields.auctionHistory),
      total_auctions_won: this.shopifyMetafields.totalAuctionsWon,
      total_bid_amount: this.shopifyMetafields.totalBidAmount
    }
  };
};

// Static method to find or create customer
customerSchema.statics.findOrCreate = async function(customerData, shopDomain) {
  const { email, firstName, lastName, shopifyId, isTemp = false } = customerData;
  
  // Try to find existing customer
  let customer = await this.findOne({ 
    email: email.toLowerCase(), 
    shopDomain 
  });
  
  if (customer) {
    // Update last login and Shopify ID if provided
    customer.lastLoginAt = new Date();
    if (shopifyId && !customer.shopifyId) {
      customer.shopifyId = shopifyId;
      customer.isTemp = false;
    }
    await customer.save();
    return customer;
  }
  
  // Create new customer
  customer = new this({
    email: email.toLowerCase(),
    firstName,
    lastName,
    shopifyId: shopifyId || null,
    isTemp,
    shopDomain,
    lastLoginAt: new Date()
  });
  
  await customer.save();
  return customer;
};

export default mongoose.model('Customer', customerSchema);
