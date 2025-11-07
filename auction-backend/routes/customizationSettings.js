import express from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import {
  getCustomization,
  saveCustomization,
  getCustomizationMeta,
  getPreviewData,
  customizationServiceConstants
} from '../services/customizationService.js';

const ALLOWED_TYPES = ['widget', 'marketplace'];
const router = express.Router();

function resolveShopDomain(req) {
  return (
    req.query.shop ||
    req.get('x-shopify-shop-domain') ||
    req.get('x-shop-domain') ||
    req.get('x-bidly-shop') ||
    req.body?.shop ||
    null
  );
}

function buildValidationChain() {
  return [
    body('template').optional().isIn(customizationServiceConstants.TEMPLATE_KEYS),
    body('font').optional().isIn(customizationServiceConstants.FONT_OPTIONS),
    body('borderRadius').optional().isInt().custom((value) => {
      return customizationServiceConstants.BORDER_RADIUS_OPTIONS.includes(Number(value));
    }),
    body('boxShadow').optional().isIn(customizationServiceConstants.BOX_SHADOW_OPTIONS),
    body('gradientEnabled').optional().isBoolean(),
    body('colors').optional().isObject(),
    ...customizationServiceConstants.COLOR_KEYS.map((key) =>
      body(`colors.${key}`)
        .optional()
        .isString()
        .matches(/^#([0-9a-fA-F]{6})$/)
    )
  ];
}

router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid customization type "${type}". Supported types: ${ALLOWED_TYPES.join(', ')}`
      });
    }

    const shopDomain = resolveShopDomain(req);
    if (!shopDomain) {
      return res.status(400).json({
        success: false,
        message: 'Shop parameter is required'
      });
    }

    const customization = await getCustomization(shopDomain, type);
    const response = {
      success: true,
      ...customization
    };

    const includeMeta = !!req.user || req.query.includeMeta === '1';
    if (includeMeta) {
      response.meta = getCustomizationMeta(type);
    }

    return res.json(response);
  } catch (error) {
    console.error('❌ Error fetching customization:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to fetch customization settings'
    });
  }
});

router.put(
  '/:type',
  requireAuth,
  buildValidationChain(),
  async (req, res) => {
    try {
      const { type } = req.params;
      if (!ALLOWED_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid customization type "${type}". Supported types: ${ALLOWED_TYPES.join(', ')}`
        });
      }

      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors.array()
        });
      }

      const shopDomain = resolveShopDomain(req);
      if (!shopDomain) {
        return res.status(400).json({
          success: false,
          message: 'Shop parameter is required'
        });
      }

      const payload = req.body?.settings ? req.body.settings : req.body;

      const saved = await saveCustomization(shopDomain, type, payload);
      return res.json({
        success: true,
        message: 'Customization settings saved successfully',
        ...saved
      });
    } catch (error) {
      console.error('❌ Error saving customization:', error);
      return res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to save customization settings',
        errors: error.details || undefined
      });
    }
  }
);

router.get('/:type/preview', requireAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const { state = 'active' } = req.query;

    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid customization type "${type}". Supported types: ${ALLOWED_TYPES.join(', ')}`
      });
    }

    if (!['pending', 'active', 'ended'].includes(state)) {
      return res.status(400).json({
        success: false,
        message: `Invalid preview state "${state}". Expected pending, active, or ended`
      });
    }

    const preview = getPreviewData(type, state);
    return res.json({
      success: true,
      type,
      state,
      preview
    });
  } catch (error) {
    console.error('❌ Error generating customization preview:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate customization preview'
    });
  }
});

router.get('/:type/meta', requireAuth, (req, res) => {
  const { type } = req.params;

  if (!ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `Invalid customization type "${type}". Supported types: ${ALLOWED_TYPES.join(', ')}`
    });
  }

  return res.json({
    success: true,
    type,
    meta: getCustomizationMeta(type)
  });
});

export default router;


