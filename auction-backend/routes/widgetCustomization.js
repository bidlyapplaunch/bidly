import express from 'express';
import WidgetCustomization from '../models/WidgetCustomization.js';
import { optionalStoreIdentification } from '../middleware/storeMiddleware.js';

const router = express.Router();

// Add debugging middleware
router.use((req, res, next) => {
  console.log('🎨 Widget customization route hit:', {
    method: req.method,
    path: req.path,
    url: req.url,
    query: req.query
  });
  next();
});

/**
 * GET /api/widget-customization
 * Get widget customization settings for the current shop
 */
router.get('/', optionalStoreIdentification, async (req, res) => {
    try {
        const shopDomain = req.shopDomain;
        
        console.log('🎨 Widget customization GET request:', {
            shopDomain,
            hasStore: !!req.store
        });

        if (!shopDomain) {
            return res.status(400).json({
                success: false,
                message: 'Shop domain is required'
            });
        }

        let customization = await WidgetCustomization.findOne({ shopDomain });

        if (!customization) {
            // Return default settings without saving
            customization = {
                shopDomain,
                template: 'Classic',
                font: 'Inter',
                colors: {
                    primary: '#007bff',
                    background: '#ffffff',
                    surface: '#f8f9fa',
                    textPrimary: '#212529',
                    textSecondary: '#6c757d',
                    textTitle: '#212529',
                    textTimer: '#dc3545',
                    textStatus: '#28a745',
                    textCount: '#6c757d',
                    textLabel: '#495057',
                    textAmount: '#007bff',
                    border: '#dee2e6',
                    accent: '#28a745',
                    success: '#28a745',
                    error: '#dc3545',
                    hover: '#0056b3',
                    buttonPrimary: '#007bff',
                    buttonSecondary: '#6c757d'
                }
            };
        }

        res.json({
            success: true,
            customization
        });
    } catch (error) {
        console.error('❌ Error fetching widget customization:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch widget customization settings',
            error: error.message
        });
    }
});

/**
 * POST /api/widget-customization
 * Update widget customization settings for the current shop
 */
router.post('/', optionalStoreIdentification, async (req, res) => {
    try {
        const shopDomain = req.shopDomain;
        const { template, font, colors } = req.body;

        console.log('🎨 Widget customization POST request:', {
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
            const validColorKeys = ['primary', 'background', 'surface', 'textPrimary', 'textSecondary', 'textTitle', 'textTimer', 'textStatus', 'textCount', 'textLabel', 'textAmount', 'border', 'accent', 'success', 'error', 'hover', 'buttonPrimary', 'buttonSecondary'];
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

        const customization = await WidgetCustomization.findOneAndUpdate(
            { shopDomain },
            updateData,
            { upsert: true, new: true, runValidators: true }
        );

        console.log('✅ Widget customization saved:', {
            id: customization._id,
            shopDomain,
            template: customization.template,
            font: customization.font
        });

        res.json({
            success: true,
            message: 'Widget customization settings saved successfully',
            customization
        });
    } catch (error) {
        console.error('❌ Error saving widget customization:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save widget customization settings',
            error: error.message
        });
    }
});

/**
 * GET /api/widget-customization/theme
 * Get widget theme CSS for the current shop
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

        let customization = await WidgetCustomization.findOne({ shopDomain });

        if (!customization) {
            // Return default theme
            customization = {
                template: 'Classic',
                font: 'Inter',
                colors: {
                    primary: '#007bff',
                    background: '#ffffff',
                    surface: '#f8f9fa',
                    textPrimary: '#212529',
                    textSecondary: '#6c757d',
                    textTitle: '#212529',
                    textTimer: '#dc3545',
                    textStatus: '#28a745',
                    textCount: '#6c757d',
                    textLabel: '#495057',
                    textAmount: '#007bff',
                    border: '#dee2e6',
                    accent: '#28a745',
                    success: '#28a745',
                    error: '#dc3545',
                    hover: '#0056b3',
                    buttonPrimary: '#007bff',
                    buttonSecondary: '#6c757d'
                }
            };
        }

        const css = generateWidgetThemeCSS(customization);

        res.setHeader('Content-Type', 'text/css');
        res.send(css);
    } catch (error) {
        console.error('❌ Error generating widget theme CSS:', error);
        res.status(500).send('/* Error generating theme CSS */');
    }
});

function generateWidgetThemeCSS(customization) {
    const { template, font, colors } = customization;

    // Base CSS variables
    let css = `:root {
        --bidly-widget-color-primary: ${colors.primary};
        --bidly-widget-color-background: ${colors.background};
        --bidly-widget-color-surface: ${colors.surface};
        --bidly-widget-color-text-primary: ${colors.textPrimary};
        --bidly-widget-color-text-secondary: ${colors.textSecondary};
        --bidly-widget-color-text-title: ${colors.textTitle};
        --bidly-widget-color-text-timer: ${colors.textTimer};
        --bidly-widget-color-text-status: ${colors.textStatus};
        --bidly-widget-color-text-count: ${colors.textCount};
        --bidly-widget-color-text-label: ${colors.textLabel};
        --bidly-widget-color-text-amount: ${colors.textAmount};
        --bidly-widget-color-border: ${colors.border};
        --bidly-widget-color-accent: ${colors.accent};
        --bidly-widget-color-success: ${colors.success};
        --bidly-widget-color-error: ${colors.error};
        --bidly-widget-color-hover: ${colors.hover};
        --bidly-widget-color-button-primary: ${colors.buttonPrimary};
        --bidly-widget-color-button-secondary: ${colors.buttonSecondary};
        --bidly-widget-font-family: '${font}', sans-serif;
        --bidly-widget-template: '${template}';
    `;

    // Template-specific styles
    switch (template) {
        case 'Modern':
            css += `
        --bidly-widget-border-radius: 12px;
        --bidly-widget-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        --bidly-widget-spacing: 1.5rem;
        --bidly-widget-button-padding: 0.75rem 1.5rem;
    `;
            break;
        case 'Minimal':
            css += `
        --bidly-widget-border-radius: 4px;
        --bidly-widget-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        --bidly-widget-spacing: 1rem;
        --bidly-widget-button-padding: 0.5rem 1rem;
    `;
            break;
        case 'Bold':
            css += `
        --bidly-widget-border-radius: 8px;
        --bidly-widget-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        --bidly-widget-spacing: 2rem;
        --bidly-widget-button-padding: 1rem 2rem;
    `;
            break;
        default: // Classic
            css += `
        --bidly-widget-border-radius: 6px;
        --bidly-widget-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
        --bidly-widget-spacing: 1.25rem;
        --bidly-widget-button-padding: 0.625rem 1.25rem;
    `;
    }

    // Additional utility variables
    css += `
        --bidly-widget-primary-hover: color-mix(in srgb, var(--bidly-widget-color-primary) 80%, black);
        --bidly-widget-primary-light: color-mix(in srgb, var(--bidly-widget-color-primary) 90%, white);
    }
    `;

    return css;
}

export default router;
