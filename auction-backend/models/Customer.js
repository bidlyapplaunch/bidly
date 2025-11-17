import mongoose from 'mongoose';
import generateRandomName from '../utils/generateRandomName.js';

const INVALID_NAME_TOKENS = new Set(['', ' ', 'undefined', 'null', 'na', 'n/a']);

const hasMeaningfulValue = (value) =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  !INVALID_NAME_TOKENS.has(value.trim().toLowerCase());

const isDefaultCustomerLastName = (value) =>
  typeof value === 'string' && value.trim().toLowerCase() === 'customer';

const normalizeFirstNameInput = (value) => {
  if (typeof value === 'undefined') return undefined;
  if (!hasMeaningfulValue(value)) return null;
  return value.trim();
};

const normalizeLastNameInput = (value) => {
  if (typeof value === 'undefined') return undefined;
  if (!hasMeaningfulValue(value) || isDefaultCustomerLastName(value)) return null;
  return value.trim();
};

const normalizeDisplayNameInput = (value) => {
  if (typeof value === 'undefined') return undefined;
  if (!hasMeaningfulValue(value)) return null;
  return value.trim();
};

const resolveDisplayName = ({ firstName, lastName, displayName, existingDisplayName }) => {
  if (typeof displayName !== 'undefined') {
    if (displayName) {
      return displayName;
    }
    return null;
  }

  const combined = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (combined) {
    return combined;
  }

  if (hasMeaningfulValue(existingDisplayName)) {
    return existingDisplayName.trim();
  }

  return generateRandomName();
};

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
    lowercase: true,
    trim: true
  },
  
  firstName: {
    type: String,
    trim: true,
    default: null
  },
  
  lastName: {
    type: String,
    trim: true,
    default: null
  },

  displayName: {
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
customerSchema.index({ email: 1, shopDomain: 1 }, { unique: true }); // Email must be unique per shop
customerSchema.index({ shopifyId: 1, shopDomain: 1 });
customerSchema.index({ isTemp: 1, shopDomain: 1 });

// Virtual for full name
customerSchema.virtual('fullName').get(function() {
  if (hasMeaningfulValue(this.displayName)) {
    return this.displayName.trim();
  }
  return [this.firstName, this.lastName].filter(Boolean).join(' ').trim();
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
  const {
    email,
    firstName,
    lastName,
    displayName,
    shopifyId,
    isTemp = false
  } = customerData;

  if (!email) {
    throw new Error('Email is required to create or update a customer');
  }

  let customer = await this.findOne({
    email: email.toLowerCase(),
    shopDomain
  });

  const normalizedFirst = normalizeFirstNameInput(firstName);
  const normalizedLast = normalizeLastNameInput(lastName);
  const normalizedDisplay = normalizeDisplayNameInput(displayName);

  if (customer) {
    let shouldSave = false;

    if (typeof normalizedFirst !== 'undefined' && normalizedFirst !== customer.firstName) {
      customer.firstName = normalizedFirst;
      shouldSave = true;
    }

    if (typeof normalizedLast !== 'undefined' && normalizedLast !== customer.lastName) {
      customer.lastName = normalizedLast;
      shouldSave = true;
    }

    const candidateFirst =
      typeof normalizedFirst !== 'undefined' ? normalizedFirst : customer.firstName;
    const candidateLast =
      typeof normalizedLast !== 'undefined' ? normalizedLast : customer.lastName;

    const nextDisplayName = resolveDisplayName({
      firstName: candidateFirst,
      lastName: candidateLast,
      displayName: normalizedDisplay,
      existingDisplayName: customer.displayName
    });

    if (nextDisplayName !== customer.displayName) {
      customer.displayName = nextDisplayName;
      shouldSave = true;
    }

    customer.lastLoginAt = new Date();

    if (shopifyId && !customer.shopifyId) {
      customer.shopifyId = shopifyId;
      customer.isTemp = false;
      shouldSave = true;
    }

    if (typeof isTemp !== 'undefined' && customer.isTemp !== isTemp) {
      customer.isTemp = !!isTemp;
      shouldSave = true;
    }

    if (shouldSave) {
      await customer.save();
    }

    return customer;
  }

  const firstValue = typeof normalizedFirst === 'undefined' ? null : normalizedFirst;
  const lastValue = typeof normalizedLast === 'undefined' ? null : normalizedLast;
  const displayValue = resolveDisplayName({
    firstName: firstValue,
    lastName: lastValue,
    displayName: normalizedDisplay,
    existingDisplayName: null
  });

  customer = new this({
    email: email.toLowerCase(),
    firstName: firstValue,
    lastName: lastValue,
    displayName: displayValue,
    shopifyId: shopifyId || null,
    isTemp,
    shopDomain,
    lastLoginAt: new Date()
  });

  await customer.save();
  return customer;
};

export default mongoose.model('Customer', customerSchema);
