import mongoose from 'mongoose';

const customizationSchema = new mongoose.Schema({
    shopDomain: {
        type: String,
        required: true,
        unique: true,
        index: true
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
        hover: {
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

// Update the updatedAt field before saving
customizationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.model('Customization', customizationSchema);
