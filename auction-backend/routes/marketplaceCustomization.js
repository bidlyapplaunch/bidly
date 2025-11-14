import express from 'express';
import MarketplaceCustomization from '../models/MarketplaceCustomization.js';
import { optionalStoreIdentification } from '../middleware/storeMiddleware.js';
import { buildMarketplaceCSS, normalizeMarketplaceTheme } from '../../shared/marketplaceTheme.js';

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
            // Return default settings without saving
            customization = {
                shopDomain,
                template: 'Classic',
                font: 'Inter',
                colors: {
                    primary: '#007bff',
                    background: '#f5f5f5',
                    surface: '#ffffff',
                    textPrimary: '#222222',
                    textSecondary: '#666666',
                    border: '#dddddd',
                    accent: '#00b894',
                    success: '#00c851',
                    error: '#ff4444',
                    hover: '#0056b3',
                    gradient1: '#007bff',
                    gradient2: '#0056b3'
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
        const { template, font, colors } = req.body;

        console.log('🏪 Marketplace customization POST request:', {
            shopDomain,
            template,
            font,
            colors: colors ? Object.keys(colors) : 'none'
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
        if (colors) {
            const validColorKeys = ['primary', 'background', 'surface', 'textPrimary', 'textSecondary', 'border', 'accent', 'success', 'error', 'hover', 'gradient1', 'gradient2'];
            const invalidKeys = Object.keys(colors).filter(key => !validColorKeys.includes(key));
            if (invalidKeys.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid color keys: ' + invalidKeys.join(', ') + '. Valid keys: ' + validColorKeys.join(', ')
                });
            }
        }

        const updateData = {};
        if (template) updateData.template = template;
        if (font) updateData.font = font;
        if (colors) updateData.colors = colors;

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
            // Return default theme
            customization = {
                template: 'Classic',
                font: 'Inter',
                colors: {
                    primary: '#007bff',
                    background: '#f5f5f5',
                    surface: '#ffffff',
                    textPrimary: '#222222',
                    textSecondary: '#666666',
                    border: '#dddddd',
                    accent: '#00b894',
                    success: '#00c851',
                    error: '#ff4444',
                    hover: '#0056b3',
                    gradient1: '#007bff',
                    gradient2: '#0056b3'
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
