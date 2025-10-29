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
            default: '#007bff'
        },
        background: {
            type: String,
            required: true,
            default: '#ffffff'
        },
        surface: {
            type: String,
            required: true,
            default: '#f8f9fa'
        },
        textPrimary: {
            type: String,
            required: true,
            default: '#212529'
        },
        textSecondary: {
            type: String,
            required: true,
            default: '#6c757d'
        },
        textTitle: {
            type: String,
            required: true,
            default: '#212529'
        },
        textTimer: {
            type: String,
            required: true,
            default: '#dc3545'
        },
        textStatus: {
            type: String,
            required: true,
            default: '#28a745'
        },
        textCount: {
            type: String,
            required: true,
            default: '#6c757d'
        },
        textLabel: {
            type: String,
            required: true,
            default: '#495057'
        },
        textAmount: {
            type: String,
            required: true,
            default: '#007bff'
        },
        border: {
            type: String,
            required: true,
            default: '#dee2e6'
        },
        accent: {
            type: String,
            required: true,
            default: '#28a745'
        },
        success: {
            type: String,
            required: true,
            default: '#28a745'
        },
        error: {
            type: String,
            required: true,
            default: '#dc3545'
        },
        hover: {
            type: String,
            required: true,
            default: '#0056b3'
        },
        buttonPrimary: {
            type: String,
            required: true,
            default: '#007bff'
        },
        buttonSecondary: {
            type: String,
            required: true,
            default: '#6c757d'
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
