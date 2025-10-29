import express from 'express';
import Customization from '../models/Customization.js';
import { identifyStore } from '../middleware/storeMiddleware.js';

const router = express.Router();

/**
 * GET /api/customization
 * Get customization settings for the current shop
 */
router.get('/', identifyStore, async (req, res) => {
    try {
        const shopDomain = req.shopDomain;
        
        if (!shopDomain) {
            return res.status(400).json({
                success: false,
                message: 'Shop domain is required'
            });
        }

        let customization = await Customization.findOne({ shopDomain });
        
        // If no customization exists, create default one
        if (!customization) {
            customization = new Customization({
                shopDomain,
                primaryColor: '#3B82F6',
                font: 'Poppins',
                template: 'Classic'
            });
            await customization.save();
        }

        res.json({
            success: true,
            customization: {
                primaryColor: customization.primaryColor,
                font: customization.font,
                template: customization.template
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
router.post('/', identifyStore, async (req, res) => {
    try {
        const shopDomain = req.shopDomain;
        const { primaryColor, font, template } = req.body;
        
        if (!shopDomain) {
            return res.status(400).json({
                success: false,
                message: 'Shop domain is required'
            });
        }

        // Validate input
        const validColors = ['#EF4444', '#3B82F6', '#10B981', '#000000', '#FFFFFF', '#F59E0B', '#6B7280', '#8B5CF6'];
        const validFonts = ['Poppins', 'Roboto', 'Montserrat', 'Inter'];
        const validTemplates = ['Classic', 'Modern', 'Minimal', 'Bold'];

        if (primaryColor && !validColors.includes(primaryColor)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid primary color'
            });
        }

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

        // Update or create customization
        const customization = await Customization.findOneAndUpdate(
            { shopDomain },
            {
                primaryColor: primaryColor || '#3B82F6',
                font: font || 'Poppins',
                template: template || 'Classic',
                updatedAt: new Date()
            },
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
                primaryColor: customization.primaryColor,
                font: customization.font,
                template: customization.template
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
router.get('/theme', identifyStore, async (req, res) => {
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
                primaryColor: '#3B82F6',
                font: 'Poppins',
                template: 'Classic'
            };
        }

        // Generate CSS variables based on template and color
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
    const { primaryColor, font, template } = customization;
    
    // Base CSS variables
    let css = `:root {
    --bidly-primary-color: ${primaryColor};
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

    // Color variations
    css += `
    --bidly-primary-hover: color-mix(in srgb, var(--bidly-primary-color) 80%, black);
    --bidly-primary-light: color-mix(in srgb, var(--bidly-primary-color) 90%, white);
    --bidly-text-primary: #1f2937;
    --bidly-text-secondary: #6b7280;
    --bidly-background: #ffffff;
    --bidly-border: #e5e7eb;
}
`;

    return css;
}

export default router;
