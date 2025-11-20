import express from 'express';
import MarketplaceCustomization from '../models/MarketplaceCustomization.js';
import { optionalStoreIdentification } from '../middleware/storeMiddleware.js';
import { buildMarketplaceCSS, normalizeMarketplaceTheme } from '../../shared/marketplaceTheme.js';
import { getDefaultSettings } from '../services/customizationService.js';

const router = express.Router();

// Add debugging middleware
router.use((req, res, next) => {
  console.log('🏪 Marketplace customization route hit:', {
    method: req.method,
    path: req.path,
    url: req.url,
    query: req.query
  });
  next();
});

/**
 * GET /api/marketplace-customization
 * Get marketplace customization settings for the current shop
 */
router.get('/', optionalStoreIdentification, async (req, res) => {
    try {
        const shopDomain = req.shopDomain;
        
        console.log('🏪 Marketplace customization GET request:', {
            shopDomain,
            hasStore: !!req.store
        });

        if (!shopDomain) {
            return res.status(400).json({
                success: false,
                message: 'Shop domain is required'
            });
        }

        let customization = await MarketplaceCustomization.findOne({ shopDomain });

        if (!customization) {
            // Use default settings from customization service
            const defaultSettings = getDefaultSettings('marketplace', 'A');
            customization = {
                shopDomain,
                template: defaultSettings.template || 'A',
                font: defaultSettings.font || 'Inter',
                gradientEnabled: defaultSettings.gradientEnabled !== undefined ? defaultSettings.gradientEnabled : false,
                colors: {
                    primary: defaultSettings.colors?.button_bg || '#FFFFFF',
                    background: defaultSettings.colors?.bg_solid || '#EDEDED',
                    surface: '#FFFFFF',
                    textPrimary: defaultSettings.colors?.text || '#000000',
                    textSecondary: '#1A2E37',
                    border: defaultSettings.colors?.border || '#324462',
                    accent: defaultSettings.colors?.accent || '#00B894',
                    success: '#00C851',
                    error: '#FF4444',
                    button: defaultSettings.colors?.button_bg || '#FFFFFF',
                    buttonText: defaultSettings.colors?.button_text || '#000000',
                    gradient1: defaultSettings.colors?.bg_gradient_start || '#CEC236',
                    gradient2: defaultSettings.colors?.bg_gradient_end || '#94C5F0'
                }
            };
        }

        res.json({
            success: true,
            customization
        });
    } catch (error) {
        console.error('❌ Error fetching marketplace customization:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch marketplace customization settings',
            error: error.message
        });
    }
});

/**
 * POST /api/marketplace-customization
 * Update marketplace customization settings for the current shop
 */
router.post('/', optionalStoreIdentification, async (req, res) => {
    try {
        const shopDomain = req.shopDomain;
        const { template, font, colors, gradientEnabled } = req.body;

        console.log('🏪 Marketplace customization POST request:', {
            shopDomain,
            template,
            font,
            colors: colors ? Object.keys(colors) : 'none',
            gradientEnabled
        });

        if (!shopDomain) {
            return res.status(400).json({
                success: false,
                message: 'Shop domain is required'
            });
        }

        // Validate template
        const validTemplates = ['Classic', 'Modern', 'Minimal', 'Bold'];
        if (template && !validTemplates.includes(template)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid template. Must be one of: ' + validTemplates.join(', ')
            });
        }

        // Validate font
        const validFonts = ['Poppins', 'Roboto', 'Montserrat', 'Inter'];
        if (font && !validFonts.includes(font)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid font. Must be one of: ' + validFonts.join(', ')
            });
        }

        // Validate colors
        let cleanedColors = null;
        if (colors) {
            const validColorKeys = ['primary', 'background', 'surface', 'textPrimary', 'textSecondary', 'buttonText', 'button', 'border', 'accent', 'success', 'error', 'gradient1', 'gradient2'];
            cleanedColors = Object.entries(colors).reduce((acc, [key, value]) => {
                if (validColorKeys.includes(key)) {
                    acc[key] = value;
                } else {
                    console.warn(`⚠️ Ignoring unsupported color key "${key}" for shop ${shopDomain}`);
                }
                return acc;
            }, {});
        }

        const updateData = {};
        if (template) updateData.template = template;
        if (font) updateData.font = font;
        if (typeof gradientEnabled === 'boolean') updateData.gradientEnabled = gradientEnabled;
        if (cleanedColors && Object.keys(cleanedColors).length > 0) {
            updateData.colors = cleanedColors;
        }

        const customization = await MarketplaceCustomization.findOneAndUpdate(
            { shopDomain },
            updateData,
            { upsert: true, new: true, runValidators: true }
        );

        console.log('✅ Marketplace customization saved:', {
            id: customization._id,
            shopDomain,
            template: customization.template,
            font: customization.font
        });

        res.json({
            success: true,
            message: 'Marketplace customization settings saved successfully',
            customization
        });
    } catch (error) {
        console.error('❌ Error saving marketplace customization:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save marketplace customization settings',
            error: error.message
        });
    }
});

/**
 * GET /api/marketplace-customization/theme
 * Get marketplace theme CSS for the current shop
 */
router.get('/theme', optionalStoreIdentification, async (req, res) => {
    try {
        const shopDomain = req.shopDomain;

        if (!shopDomain) {
            return res.status(400).json({
                success: false,
                message: 'Shop domain is required'
            });
        }

        let customization = await MarketplaceCustomization.findOne({ shopDomain });

        if (!customization) {
            // Use default settings from customization service
            const defaultSettings = getDefaultSettings('marketplace', 'A');
            customization = {
                template: defaultSettings.template || 'A',
                font: defaultSettings.font || 'Inter',
                gradientEnabled: defaultSettings.gradientEnabled !== undefined ? defaultSettings.gradientEnabled : false,
                colors: {
                    primary: defaultSettings.colors?.button_bg || '#FFFFFF',
                    background: defaultSettings.colors?.bg_solid || '#EDEDED',
                    surface: '#FFFFFF',
                    textPrimary: defaultSettings.colors?.text || '#000000',
                    textSecondary: '#1A2E37',
                    border: defaultSettings.colors?.border || '#324462',
                    accent: defaultSettings.colors?.accent || '#00B894',
                    success: '#00C851',
                    error: '#FF4444',
                    button: defaultSettings.colors?.button_bg || '#FFFFFF',
                    buttonText: defaultSettings.colors?.button_text || '#000000',
                    gradient1: defaultSettings.colors?.bg_gradient_start || '#CEC236',
                    gradient2: defaultSettings.colors?.bg_gradient_end || '#94C5F0'
                }
            };
        }

        const normalizedTheme = normalizeMarketplaceTheme(customization);
        const css = buildMarketplaceCSS(normalizedTheme);

        res.setHeader('Content-Type', 'text/css');
        res.send(css);
    } catch (error) {
        console.error('❌ Error generating marketplace theme CSS:', error);
        res.status(500).send('/* Error generating theme CSS */');
    }
});

export default router;
