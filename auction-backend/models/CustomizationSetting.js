import mongoose from 'mongoose';

const COLORS_SCHEMA_DEFINITION = {
  accent: { type: String, required: true },
  text: { type: String, required: true },
  bg_solid: { type: String, required: true },
  bg_gradient_start: { type: String, required: true },
  bg_gradient_end: { type: String, required: true },
  button_bg: { type: String, required: true },
  button_hover: { type: String, required: true },
  button_text: { type: String, required: true },
  border: { type: String, required: true }
};

const colorsSchema = new mongoose.Schema(COLORS_SCHEMA_DEFINITION, {
  _id: false
});

const settingsSchema = new mongoose.Schema({
  template: {
    type: String,
    enum: ['A', 'B', 'C', 'D'],
    required: true,
    default: 'A'
  },
  font: {
    type: String,
    enum: ['Poppins', 'Inter', 'Roboto', 'Lato'],
    required: true,
    default: 'Inter'
  },
  colors: {
    type: colorsSchema,
    required: true
  },
  borderRadius: {
    type: Number,
    enum: [4, 8, 16],
    required: true,
    default: 8
  },
  boxShadow: {
    type: String,
    enum: ['none', 'subtle', 'medium'],
    required: true,
    default: 'subtle'
  },
  gradientEnabled: {
    type: Boolean,
    required: true,
    default: true
  }
}, { _id: false });

const customizationSettingSchema = new mongoose.Schema({
  shop: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['widget', 'marketplace'],
    required: true
  },
  settings: {
    type: settingsSchema,
    required: true
  },
  version: {
    type: Number,
    required: true,
    default: 1
  }
}, {
  timestamps: true
});

customizationSettingSchema.index({ shop: 1, type: 1 }, { unique: true });

// Ensure shop domain format consistency
customizationSettingSchema.pre('save', function(next) {
  if (this.isModified('shop')) {
    this.shop = this.shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
  next();
});

const CustomizationSetting = mongoose.model('CustomizationSetting', customizationSettingSchema);

export default CustomizationSetting;
export { COLORS_SCHEMA_DEFINITION };


