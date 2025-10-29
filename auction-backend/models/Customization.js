import mongoose from 'mongoose';

const customizationSchema = new mongoose.Schema({
    shopDomain: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    primaryColor: {
        type: String,
        required: true,
        default: '#3B82F6', // Default blue
        enum: ['#EF4444', '#3B82F6', '#10B981', '#000000', '#FFFFFF', '#F59E0B', '#6B7280', '#8B5CF6'] // Red, Blue, Green, Black, White, Gold, Silver, Purple
    },
    font: {
        type: String,
        required: true,
        default: 'Poppins',
        enum: ['Poppins', 'Roboto', 'Montserrat', 'Inter']
    },
    template: {
        type: String,
        required: true,
        default: 'Classic',
        enum: ['Classic', 'Modern', 'Minimal', 'Bold']
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

// Update the updatedAt field before saving
customizationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.model('Customization', customizationSchema);
