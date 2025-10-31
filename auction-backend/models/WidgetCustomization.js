import mongoose from 'mongoose';

const widgetCustomizationSchema = new mongoose.Schema({
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
        // Widget-specific colors
        primary: {
            type: String,
            required: true,
            default: '#6366f1'
        },
        background: {
            type: String,
            required: true,
            default: '#ffffff'
        },
        surface: {
            type: String,
            required: true,
            default: '#667eea'
        },
        textPrimary: {
            type: String,
            required: true,
            default: '#1e293b'
        },
        textSecondary: {
            type: String,
            required: true,
            default: '#64748b'
        },
        textTitle: {
            type: String,
            required: true,
            default: '#ffffff'
        },
        textTimer: {
            type: String,
            required: true,
            default: '#fbbf24'
        },
        textStatus: {
            type: String,
            required: true,
            default: '#10b981'
        },
        textCount: {
            type: String,
            required: true,
            default: '#64748b'
        },
        textLabel: {
            type: String,
            required: true,
            default: '#475569'
        },
        textAmount: {
            type: String,
            required: true,
            default: '#6366f1'
        },
        border: {
            type: String,
            required: true,
            default: '#e2e8f0'
        },
        accent: {
            type: String,
            required: true,
            default: '#8b5cf6'
        },
        success: {
            type: String,
            required: true,
            default: '#10b981'
        },
        error: {
            type: String,
            required: true,
            default: '#ef4444'
        },
        hover: {
            type: String,
            required: true,
            default: '#4f46e5'
        },
        buttonPrimary: {
            type: String,
            required: true,
            default: '#6366f1'
        },
        buttonSecondary: {
            type: String,
            required: true,
            default: '#64748b'
        },
        gradient1: {
            type: String,
            required: true,
            default: '#667eea'
        },
        gradient2: {
            type: String,
            required: true,
            default: '#764ba2'
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

widgetCustomizationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.model('WidgetCustomization', widgetCustomizationSchema);
