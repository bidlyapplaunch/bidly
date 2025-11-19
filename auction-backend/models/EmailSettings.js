import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: true
    },
    subject: {
      type: String,
      trim: true,
      default: ''
    },
    html: {
      type: String,
      default: ''
    }
  },
  { _id: false }
);

const emailSettingsSchema = new mongoose.Schema(
  {
    shopDomain: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
      set: (value = '') => value.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
    },
    enabled: {
      type: Boolean,
      default: true
    },
    useCustomSmtp: {
      type: Boolean,
      default: false
    },
    smtp: {
      host: { type: String, trim: true },
      port: { type: Number },
      secure: { type: Boolean },
      user: { type: String, trim: true },
      pass: { type: String },
      fromName: { type: String, trim: true },
      fromEmail: { type: String, trim: true }
    },
    templates: {
      bidConfirmation: { type: templateSchema, default: () => ({}) },
      outbidNotification: { type: templateSchema, default: () => ({}) },
      winnerNotification: { type: templateSchema, default: () => ({}) },
      auctionEndingSoon: { type: templateSchema, default: () => ({}) },
      adminNotification: { type: templateSchema, default: () => ({}) }
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    minimize: false
  }
);

emailSettingsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const EmailSettings = mongoose.model('EmailSettings', emailSettingsSchema);

export default EmailSettings;

