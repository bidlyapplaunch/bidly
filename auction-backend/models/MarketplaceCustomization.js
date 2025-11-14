import mongoose from 'mongoose';

const marketplaceCustomizationSchema = new mongoose.Schema({
    shopDomain: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    gradientEnabled: {
        type: Boolean,
        default: true
    },
    template: {
        type: String,
        required: true,
        default: 'Classic',
        enum: ['Classic', 'Modern', 'Minimal', 'Bold']
    },
    font: {
        type: String,
        required: true,
        default: 'Inter',
        enum: ['Poppins', 'Roboto', 'Montserrat', 'Inter']
    },
    colors: {
        primary: {
            type: String,
            required: true,
            default: '#007bff'
        },
        background: {
            type: String,
            required: true,
            default: '#f5f5f5'
        },
        surface: {
            type: String,
            required: true,
            default: '#ffffff'
        },
        textPrimary: {
            type: String,
            required: true,
            default: '#222222'
        },
        textSecondary: {
            type: String,
            required: true,
            default: '#666666'
        },
        border: {
            type: String,
            required: true,
            default: '#dddddd'
        },
        accent: {
            type: String,
            required: true,
            default: '#00b894'
        },
        success: {
            type: String,
            required: true,
            default: '#00c851'
        },
        error: {
            type: String,
            required: true,
            default: '#ff4444'
        },
        button: {
            type: String,
            required: true,
            default: '#1f2933'
        },
        buttonText: {
            type: String,
            required: true,
            default: '#ffffff'
        },
        gradient1: {
            type: String,
            required: true,
            default: '#007bff'
        },
        gradient2: {
            type: String,
            required: true,
            default: '#0056b3'
        }
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

marketplaceCustomizationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.model('MarketplaceCustomization', marketplaceCustomizationSchema);
