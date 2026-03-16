import mongoose from 'mongoose';

const recipientSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  email: { type: String, required: true },
  displayName: { type: String, default: '' },
  customerName: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending'
  },
  sentAt: { type: Date },
  error: { type: String }
}, { _id: false });

const blastEmailSchema = new mongoose.Schema({
  shopDomain: {
    type: String,
    required: true,
    index: true
  },
  subject: {
    type: String,
    required: true,
    maxlength: 200
  },
  body: {
    type: String,
    required: true,
    maxlength: 512000 // 500KB
  },
  status: {
    type: String,
    enum: ['draft', 'sending', 'completed', 'failed'],
    default: 'draft'
  },
  deliveryMode: {
    type: String,
    enum: ['all', 'trickle'],
    default: 'all'
  },
  trickleConfig: {
    batchSize: { type: Number, default: 50, min: 1, max: 500 },
    intervalMinutes: { type: Number, default: 5, min: 1, max: 60 }
  },
  recipients: [recipientSchema],
  stats: {
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  sentAt: { type: Date }
}, {
  timestamps: true
});

blastEmailSchema.index({ shopDomain: 1, status: 1 });
blastEmailSchema.index({ shopDomain: 1, createdAt: -1 });

const BlastEmail = mongoose.model('BlastEmail', blastEmailSchema);
export default BlastEmail;
