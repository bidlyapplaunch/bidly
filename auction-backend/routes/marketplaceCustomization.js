import express from 'express';
import MarketplaceCustomization from '../models/MarketplaceCustomization.js';
import { optionalStoreIdentification } from '../middleware/storeMiddleware.js';

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

        const css = generateMarketplaceThemeCSS(customization);

        res.setHeader('Content-Type', 'text/css');
        res.send(css);
    } catch (error) {
        console.error('❌ Error generating marketplace theme CSS:', error);
        res.status(500).send('/* Error generating theme CSS */');
    }
});

function generateMarketplaceThemeCSS(customization) {
    const { template, font, colors } = customization;

    // Base CSS variables
    let css = `:root {
        --bidly-marketplace-color-primary: ${colors.primary};
        --bidly-marketplace-color-background: ${colors.background};
        --bidly-marketplace-color-surface: ${colors.surface};
        --bidly-marketplace-color-text-primary: ${colors.textPrimary};
        --bidly-marketplace-color-text-secondary: ${colors.textSecondary};
        --bidly-marketplace-color-border: ${colors.border};
        --bidly-marketplace-color-accent: ${colors.accent};
        --bidly-marketplace-color-success: ${colors.success};
        --bidly-marketplace-color-error: ${colors.error};
        --bidly-marketplace-color-hover: ${colors.hover};
        --bidly-marketplace-color-gradient1: ${colors.gradient1 || '#007bff'};
        --bidly-marketplace-color-gradient2: ${colors.gradient2 || '#0056b3'};
        --bidly-marketplace-font-family: '${font}', sans-serif;
        --bidly-marketplace-template: '${template}';
    `;

    // Template-specific styles
    switch (template) {
        case 'Modern':
            css += `
        --bidly-marketplace-border-radius: 12px;
        --bidly-marketplace-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        --bidly-marketplace-spacing: 1.5rem;
        --bidly-marketplace-button-padding: 0.75rem 1.5rem;
    `;
            break;
        case 'Minimal':
            css += `
        --bidly-marketplace-border-radius: 4px;
        --bidly-marketplace-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        --bidly-marketplace-spacing: 1rem;
        --bidly-marketplace-button-padding: 0.5rem 1rem;
    `;
            break;
        case 'Bold':
            css += `
        --bidly-marketplace-border-radius: 8px;
        --bidly-marketplace-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        --bidly-marketplace-spacing: 2rem;
        --bidly-marketplace-button-padding: 1rem 2rem;
    `;
            break;
        default: // Classic
            css += `
        --bidly-marketplace-border-radius: 6px;
        --bidly-marketplace-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
        --bidly-marketplace-spacing: 1.25rem;
        --bidly-marketplace-button-padding: 0.625rem 1.25rem;
    `;
    }

    // Additional utility variables
    css += `
        --bidly-marketplace-primary-hover: color-mix(in srgb, var(--bidly-marketplace-color-primary) 80%, black);
        --bidly-marketplace-primary-light: color-mix(in srgb, var(--bidly-marketplace-color-primary) 90%, white);
        --bidly-marketplace-gradient: linear-gradient(135deg, var(--bidly-marketplace-color-gradient1), var(--bidly-marketplace-color-gradient2));
    }
    `;

    return css;
}

export default router;
