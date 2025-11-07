import express from 'express';
import { body, validationResult } from 'express-validator';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import {
  getCustomization,
  saveCustomization,
  getCustomizationMeta,
  getPreviewData,
  customizationServiceConstants,
  getDefaultSettings
} from '../services/customizationService.js';
import { identifyStore } from '../middleware/storeMiddleware.js';
import { attachPlanContext, getStorePlan } from '../middleware/planGuard.js';
import { getHigherPlans, getPlanCapabilities, planMeetsRequirement } from '../config/billingPlans.js';

const ALLOWED_TYPES = ['widget', 'marketplace'];
const DISABLED_TYPES = new Set(['marketplace']);
const PLAN_REQUIREMENTS = {
  widget: 'pro',
  marketplace: 'enterprise'
};

function isDisabled(type) {
  return DISABLED_TYPES.has(type);
}

function respondDisabled(res, type) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Retry-After', '3600');
  return res.status(503).json({
    success: false,
    message: `The ${type} customization studio is temporarily unavailable while we roll out updates.`
  });
}
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

router.use(optionalAuth);
router.use(identifyStore);
router.use(attachPlanContext);

router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid customization type "${type}". Supported types: ${ALLOWED_TYPES.join(', ')}`
      });
    }

    if (isDisabled(type)) {
      return respondDisabled(res, type);
    }

    const shopDomain = req.shopDomain || resolveShopDomain(req);
    if (!shopDomain) {
      return res.status(400).json({
        success: false,
        message: 'Shop parameter is required'
      });
    }

    const requiredPlan = PLAN_REQUIREMENTS[type] || 'basic';
    const currentPlan = getStorePlan(req);
    const includeMeta = !!req.user || req.query.includeMeta === '1';
    const hasAccess = planMeetsRequirement(currentPlan, requiredPlan);

    if (!hasAccess) {
      if (includeMeta) {
        return res.status(403).json({
          success: false,
          code: 'PLAN_UPGRADE_REQUIRED',
          message: `The ${type} customization requires the ${requiredPlan} plan.`,
          plan: currentPlan,
          requiredPlan,
          upgradeOptions: getHigherPlans(requiredPlan),
          capabilities: getPlanCapabilities(currentPlan)
        });
      }

      const defaults = getDefaultSettings(type);
      return res.json({
        success: true,
        shop: shopDomain,
        type,
        settings: defaults,
        enforcedDefault: true,
        plan: currentPlan,
        requiredPlan,
        capabilities: getPlanCapabilities(currentPlan)
      });
    }

    const customization = await getCustomization(shopDomain, type);
    const response = {
      success: true,
        plan: currentPlan,
        requiredPlan,
        capabilities: getPlanCapabilities(currentPlan),
      ...customization
    };

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

      if (isDisabled(type)) {
        return respondDisabled(res, type);
      }

      const requiredPlan = PLAN_REQUIREMENTS[type] || 'pro';
      const currentPlan = getStorePlan(req);
      if (!planMeetsRequirement(currentPlan, requiredPlan)) {
        return res.status(403).json({
          success: false,
          code: 'PLAN_UPGRADE_REQUIRED',
          message: `The ${type} customization requires the ${requiredPlan} plan.`,
          plan: currentPlan,
          requiredPlan,
          upgradeOptions: getHigherPlans(requiredPlan),
          capabilities: getPlanCapabilities(currentPlan)
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

    if (isDisabled(type)) {
      return respondDisabled(res, type);
    }

    const requiredPlan = PLAN_REQUIREMENTS[type] || 'pro';
    const currentPlan = getStorePlan(req);
    if (!planMeetsRequirement(currentPlan, requiredPlan)) {
      return res.status(403).json({
        success: false,
        code: 'PLAN_UPGRADE_REQUIRED',
        message: `The ${type} customization requires the ${requiredPlan} plan.`,
        plan: currentPlan,
        requiredPlan,
        upgradeOptions: getHigherPlans(requiredPlan),
        capabilities: getPlanCapabilities(currentPlan)
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

  if (isDisabled(type)) {
    return respondDisabled(res, type);
  }

  const requiredPlan = PLAN_REQUIREMENTS[type] || 'pro';
  const currentPlan = getStorePlan(req);
  if (!planMeetsRequirement(currentPlan, requiredPlan)) {
    return res.status(403).json({
      success: false,
      code: 'PLAN_UPGRADE_REQUIRED',
      message: `The ${type} customization requires the ${requiredPlan} plan.`,
      plan: currentPlan,
      requiredPlan,
      upgradeOptions: getHigherPlans(requiredPlan),
      capabilities: getPlanCapabilities(currentPlan)
    });
  }

  return res.json({
    success: true,
    type,
    meta: getCustomizationMeta(type)
  });
});

export default router;


