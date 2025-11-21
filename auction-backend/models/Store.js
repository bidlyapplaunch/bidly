import mongoose from 'mongoose';

/**
 * Store Model
 * This model stores information about each Shopify store that installs your app
 * Each store has its own access token and configuration
 */
const storeSchema = new mongoose.Schema({
  // Shopify store identification
  shopDomain: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    // Remove protocol and trailing slashes for consistency
    set: (value) => value.replace(/^https?:\/\//, '').replace(/\/$/, '')
  },
  
  // Shopify store ID (from shop info API)
  shopifyStoreId: {
    type: Number,
    required: true,
    unique: true
  },
  
  // Store basic information
  storeName: {
    type: String,
    required: true,
    trim: true
  },
  
  storeEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  
  // Store configuration
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  
  timezone: {
    type: String,
    required: true,
    default: 'UTC'
  },
  
  // Store's primary language (from Shopify Admin API)
  primaryLanguage: {
    type: String,
    default: 'en',
    enum: ['en', 'pl', 'de', 'es', 'fr', 'it', 'nl', 'ar', 'ja', 'ko']
  },
  
  planName: {
    type: String,
    required: true
  },

  // App subscription plan tracking
  plan: {
    type: String,
    enum: ['free', 'basic', 'pro', 'enterprise'],
    default: 'free'
  },

  onboardingComplete: {
    type: Boolean,
    default: false
  },

  pendingPlan: {
    type: String,
    enum: ['basic', 'pro', 'enterprise', null],
    default: null
  },

  planActiveAt: {
    type: Date
  },

  trialEndsAt: {
    type: Date
  },
  
  // OAuth and authentication
  accessToken: {
    type: String,
    required: true,
    // Don't include in JSON responses for security
    select: false
  },
  
  scope: {
    type: String,
    required: true
  },
  
  // Installation and status tracking
  isInstalled: {
    type: Boolean,
    default: true
  },
  
  installedAt: {
    type: Date,
    default: Date.now
  },
  
  lastAccessAt: {
    type: Date,
    default: Date.now
  },
  
  // App-specific settings
  settings: {
    // Auction-specific settings for this store
    defaultAuctionDuration: {
      type: Number,
      default: 7 // days
    },
    
    autoApproveAuctions: {
      type: Boolean,
      default: false
    },
    
    emailNotifications: {
      type: Boolean,
      default: true
    },
    
    // Store-specific branding
    customBranding: {
      logoUrl: String,
      primaryColor: {
        type: String,
        default: '#008060'
      },
      secondaryColor: {
        type: String,
        default: '#ffffff'
      }
    }
  },
  
  // Webhook subscriptions (for future use)
  webhooks: [{
    topic: String,
    address: String,
    format: {
      type: String,
      default: 'json'
    },
    webhookId: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Usage statistics
  stats: {
    totalAuctions: {
      type: Number,
      default: 0
    },
    
    totalBids: {
      type: Number,
      default: 0
    },
    
    totalRevenue: {
      type: Number,
      default: 0
    },
    
    lastAuctionCreated: Date,
    lastBidPlaced: Date
  },

  // Known custom domains for storefront access (e.g., true-nordic.com)
  knownDomains: {
    type: [String],
    default: []
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  toJSON: { 
    // Transform the document when converting to JSON
    transform: function(doc, ret) {
      // Remove sensitive fields from JSON output
      delete ret.accessToken;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for better query performance
storeSchema.index({ shopDomain: 1 });
storeSchema.index({ shopifyStoreId: 1 });
storeSchema.index({ isInstalled: 1 });
storeSchema.index({ lastAccessAt: 1 });

/**
 * Instance Methods
 */

// Update last access time when store is accessed
storeSchema.methods.updateLastAccess = function() {
  this.lastAccessAt = new Date();
  return this.save();
};

// Check if store has required permissions
storeSchema.methods.hasPermission = function(requiredScope) {
  const scopes = this.scope.split(',');
  return scopes.includes(requiredScope);
};

// Get store's access token (with security logging)
storeSchema.methods.getAccessToken = function() {
  console.log(`🔐 Accessing token for store: ${this.shopDomain}`);
  return this.accessToken;
};

/**
 * Static Methods
 */

// Find store by domain (case-insensitive)
storeSchema.statics.findByDomain = function(domain) {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
  return this.findOne({ shopDomain: cleanDomain }).select('+accessToken');
};

// Find active stores only
storeSchema.statics.findActive = function() {
  return this.find({ isInstalled: true });
};

// Get store statistics
storeSchema.statics.getStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalStores: { $sum: 1 },
        activeStores: {
          $sum: { $cond: [{ $eq: ['$isInstalled', true] }, 1, 0] }
        },
        totalAuctions: { $sum: '$stats.totalAuctions' },
        totalBids: { $sum: '$stats.totalBids' },
        totalRevenue: { $sum: '$stats.totalRevenue' }
      }
    }
  ]);
};

/**
 * Pre-save middleware
 */
storeSchema.pre('save', function(next) {
  // Ensure shopDomain is properly formatted
  if (this.isModified('shopDomain')) {
    this.shopDomain = this.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
  }
  
  // Update lastAccessAt on any modification
  this.lastAccessAt = new Date();
  
  next();
});

/**
 * Post-save middleware
 */
storeSchema.post('save', function(doc) {
  console.log(`💾 Store saved: ${doc.shopDomain} (${doc.storeName})`);
});

// Create and export the model
const Store = mongoose.model('Store', storeSchema);

export default Store;
