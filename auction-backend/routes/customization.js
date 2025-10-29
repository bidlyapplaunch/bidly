import express from 'express';
import Customization from '../models/Customization.js';
import { optionalStoreIdentification } from '../middleware/storeMiddleware.js';

const router = express.Router();

/**
 * GET /api/customization
 * Get customization settings for the current shop
 */
router.get('/', optionalStoreIdentification, async (req, res) => {
    try {
        const shopDomain = req.shopDomain;
        
        console.log('🎨 Customization GET request:', {
            shopDomain,
            query: req.query,
            hasStore: !!req.store
        });
        
        if (!shopDomain) {
            console.log('❌ No shop domain found in request');
            return res.status(400).json({
                success: false,
                message: 'Shop domain is required'
            });
        }

        let customization;
        
        try {
            customization = await Customization.findOne({ shopDomain });
            console.log('🔍 Customization lookup result:', !!customization);
        } catch (dbError) {
            console.error('❌ Database error in customization lookup:', dbError.message);
            // Continue with default settings if database fails
        }
        
        // If no customization exists, return default settings without saving
        if (!customization) {
            console.log('📝 Using default customization settings');
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
                    hover: '#0056b3'
                }
            };
        }

        res.json({
            success: true,
            customization: {
                template: customization.template,
                font: customization.font,
                colors: customization.colors
            }
        });

    } catch (error) {
        console.error('Error fetching customization settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customization settings'
        });
    }
});

/**
 * POST /api/customization
 * Update customization settings for the current shop
 */
router.post('/', optionalStoreIdentification, async (req, res) => {
    try {
        const shopDomain = req.shopDomain;
        const { template, font, colors } = req.body;
        
        if (!shopDomain) {
            return res.status(400).json({
                success: false,
                message: 'Shop domain is required'
            });
        }

        // Validate input
        const validFonts = ['Poppins', 'Roboto', 'Montserrat', 'Inter'];
        const validTemplates = ['Classic', 'Modern', 'Minimal', 'Bold'];

        if (font && !validFonts.includes(font)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid font selection'
            });
        }

        if (template && !validTemplates.includes(template)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid template selection'
            });
        }

        // Validate colors if provided
        if (colors) {
            const colorKeys = ['primary', 'background', 'surface', 'textPrimary', 'textSecondary', 'border', 'accent', 'success', 'error', 'hover'];
            for (const key of colorKeys) {
                if (colors[key] && !/^#[0-9A-Fa-f]{6}$/.test(colors[key])) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid color format for ${key}`
                    });
                }
            }
        }

        // Update or create customization
        const updateData = {
            template: template || 'Classic',
            font: font || 'Inter',
            updatedAt: new Date()
        };

        if (colors) {
            updateData.colors = {
                primary: colors.primary || '#007bff',
                background: colors.background || '#f5f5f5',
                surface: colors.surface || '#ffffff',
                textPrimary: colors.textPrimary || '#222222',
                textSecondary: colors.textSecondary || '#666666',
                border: colors.border || '#dddddd',
                accent: colors.accent || '#00b894',
                success: colors.success || '#00c851',
                error: colors.error || '#ff4444',
                hover: colors.hover || '#0056b3'
            };
        }

        const customization = await Customization.findOneAndUpdate(
            { shopDomain },
            updateData,
            { 
                upsert: true, 
                new: true,
                runValidators: true
            }
        );

        res.json({
            success: true,
            message: 'Customization settings updated successfully',
            customization: {
                template: customization.template,
                font: customization.font,
                colors: customization.colors
            }
        });

    } catch (error) {
        console.error('Error updating customization settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update customization settings'
        });
    }
});

/**
 * GET /api/customization/theme
 * Get theme CSS variables for frontend consumption
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

        let customization = await Customization.findOne({ shopDomain });
        
        // If no customization exists, use defaults
        if (!customization) {
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
                    hover: '#0056b3'
                }
            };
        }

        // Generate CSS variables based on template and colors
        const theme = generateThemeCSS(customization);
        
        res.set('Content-Type', 'text/css');
        res.send(theme);

    } catch (error) {
        console.error('Error generating theme CSS:', error);
        res.status(500).send('/* Error generating theme */');
    }
});

/**
 * Generate CSS variables based on customization settings
 */
function generateThemeCSS(customization) {
    const { template, font, colors } = customization;
    
    // Base CSS variables
    let css = `:root {
    --bidly-color-primary: ${colors.primary};
    --bidly-color-background: ${colors.background};
    --bidly-color-surface: ${colors.surface};
    --bidly-color-text-primary: ${colors.textPrimary};
    --bidly-color-text-secondary: ${colors.textSecondary};
    --bidly-color-border: ${colors.border};
    --bidly-color-accent: ${colors.accent};
    --bidly-color-success: ${colors.success};
    --bidly-color-error: ${colors.error};
    --bidly-color-hover: ${colors.hover};
    --bidly-font-family: '${font}', sans-serif;
    --bidly-template: '${template}';
`;

    // Template-specific styles
    switch (template) {
        case 'Modern':
            css += `
    --bidly-border-radius: 12px;
    --bidly-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    --bidly-spacing: 1.5rem;
    --bidly-button-padding: 0.75rem 1.5rem;
`;
            break;
        case 'Minimal':
            css += `
    --bidly-border-radius: 4px;
    --bidly-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    --bidly-spacing: 1rem;
    --bidly-button-padding: 0.5rem 1rem;
`;
            break;
        case 'Bold':
            css += `
    --bidly-border-radius: 8px;
    --bidly-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    --bidly-spacing: 2rem;
    --bidly-button-padding: 1rem 2rem;
`;
            break;
        default: // Classic
            css += `
    --bidly-border-radius: 6px;
    --bidly-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
    --bidly-spacing: 1.25rem;
    --bidly-button-padding: 0.625rem 1.25rem;
`;
    }

    // Additional utility variables
    css += `
    --bidly-primary-hover: color-mix(in srgb, var(--bidly-color-primary) 80%, black);
    --bidly-primary-light: color-mix(in srgb, var(--bidly-color-primary) 90%, white);
}
`;

    return css;
}

export default router;
