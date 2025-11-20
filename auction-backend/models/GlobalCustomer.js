import mongoose from 'mongoose';

const globalCustomerSchema = new mongoose.Schema({
  // Email is the unique identifier for a real human
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  
  // Canonical name information (from their first registration or most complete data)
  names: {
    first: {
      type: String,
      trim: true,
      default: null
    },
    last: {
      type: String,
      trim: true,
      default: null
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update updatedAt on save
globalCustomerSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('GlobalCustomer', globalCustomerSchema);

