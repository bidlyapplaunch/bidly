import { AppError } from '../middleware/errorHandler.js';
import {
  applyPlanChangeEffects,
  cancelSubscription,
  createSubscription,
  getActiveSubscriptions,
  getSubscriptionById,
  serializePlanContext,
  syncStorePlanFromShopify
} from '../services/billingService.js';
import { BILLING_PLANS, DEFAULT_PLAN, getPlanCapabilities, sanitizePlan } from '../config/billingPlans.js';

const APP_URL = process.env.APP_URL || 'https://bidly-auction-backend.onrender.com';
const ADMIN_APP_URL = process.env.ADMIN_APP_URL || 'https://bidly-auction-admin.onrender.com';

export const subscribeToPlan = async (req, res, next) => {
  try {
    if (!req.store) {
      throw new AppError('Store context required', 400);
    }

    const planParam = req.body.plan || req.query.plan;
    if (!planParam) {
      throw new AppError('Plan is required', 400);
    }

    const planKey = sanitizePlan(planParam);
    const plan = BILLING_PLANS[planKey];
    if (!plan || planKey === DEFAULT_PLAN) {
      throw new AppError('Invalid plan selection', 400);
    }

    // Managed Pricing: This app uses Shopify's managed pricing configured in Partner Dashboard
    // Subscriptions are handled automatically by Shopify during app installation/upgrade
    // Merchants cannot subscribe through the app - they must upgrade via Shopify's billing interface
    const error = new AppError(
      'Managed Pricing Apps cannot use the Billing API (to create charges). Please upgrade your plan through Shopify\'s app settings or during app installation.',
      400
    );
    error.code = 'MANAGED_PRICING_NOT_SUPPORTED';
    return next(error);
  } catch (error) {
    console.error('❌ Billing subscribe error:', error.message);

    const message = error?.message || '';
    if (message.includes('migrated to the Shopify partners area')) {
      const friendly = new AppError(
        'Shopify billing isn\'t available for this app yet. Move the app into a Shopify Partners organization (or request access) before enabling paid plans.',
        403
      );
      friendly.code = 'BILLING_PARTNER_REQUIRED';
      return next(friendly);
    }

    next(error);
  }
};

export const getCurrentPlan = async (req, res, next) => {
  try {
    if (!req.store) {
      throw new AppError('Store context required', 400);
    }

    // With managed pricing, sync from Shopify to get the latest plan status
    // This ensures the plan in our DB matches what Shopify has
    // If sync fails, we use the cached plan from DB (non-blocking)
    try {
      await syncStorePlanFromShopify(req.store);
    } catch (syncError) {
      // Log sync error but don't fail the request - use cached plan from DB
      console.warn('⚠️ Failed to sync plan from Shopify, using cached plan:', syncError.message);
    }

    const planKey = sanitizePlan(req.store.plan || DEFAULT_PLAN);
    const plan = BILLING_PLANS[planKey] || BILLING_PLANS.none;
    const pendingPlanRaw = req.store.pendingPlan;
    const pendingPlan = pendingPlanRaw ? sanitizePlan(pendingPlanRaw) : null;

    const response = {
      success: true,
      plan: planKey,
      pendingPlan,
      planDetails: getPlanCapabilities(planKey),
      pendingPlanDetails: pendingPlan ? getPlanCapabilities(pendingPlan) : null,
      trialEndsAt: req.store.trialEndsAt || null,
      planActivatedAt: req.store.planActiveAt || null,
      managedPricing: true // Indicate that managed pricing is in use
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
};

export const confirmSubscription = async (req, res, next) => {
  try {
    const { shop } = req.query;
    const chargeId = req.query.charge_id || req.query.chargeId;

    if (!shop) {
      throw new AppError('Shop parameter is required', 400);
    }

    if (!chargeId) {
      throw new AppError('Missing charge identifier', 400);
    }

    const gid = chargeId.startsWith('gid://') ? chargeId : `gid://shopify/AppSubscription/${chargeId}`;

    // identifyStore middleware already attached store & shopDomain
    if (!req.store) {
      throw new AppError('Store context required', 400);
    }

    const subscription = await getSubscriptionById(req.store, gid);

    if (!subscription) {
      throw new AppError('Unable to verify the subscription with Shopify', 400);
    }

    const status = subscription.status;
    const validStatuses = ['ACTIVE', 'ACCEPTED'];
    if (!validStatuses.includes(status)) {
      console.warn('⚠️ Subscription not activated yet:', status);
      const redirectUrl = new URL('/plans', ADMIN_APP_URL);
      redirectUrl.searchParams.set('shop', shop);
      redirectUrl.searchParams.set('billing', 'pending');
      return res.redirect(redirectUrl.toString());
    }

    const plan = BILLING_PLANS[sanitizePlan(req.query.plan)] || BILLING_PLANS.basic;
    const planFromName = sanitizePlan(subscription.name);
    const resolvedPlanKey = planFromName in BILLING_PLANS ? planFromName : plan.key;

    const previousPlan = sanitizePlan(req.store.plan || DEFAULT_PLAN);
    req.store.plan = resolvedPlanKey;
    req.store.pendingPlan = null;
    req.store.planActiveAt = new Date(subscription.createdAt || Date.now());
    if (subscription.trialDays) {
      const createdAt = subscription.createdAt ? new Date(subscription.createdAt) : new Date();
      req.store.trialEndsAt = new Date(createdAt.getTime() + subscription.trialDays * 24 * 60 * 60 * 1000);
    }
    await req.store.save();
    await applyPlanChangeEffects(req.store, previousPlan, resolvedPlanKey);

    const redirectUrl = new URL('/plans', ADMIN_APP_URL);
    redirectUrl.searchParams.set('shop', shop);
    redirectUrl.searchParams.set('billing', 'success');
    redirectUrl.searchParams.set('plan', resolvedPlanKey);

    return res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('❌ Billing confirmation error:', error.message);
    const shop = req.query.shop || req.shopDomain;
    const redirectUrl = new URL('/plans', ADMIN_APP_URL);
    if (shop) {
      redirectUrl.searchParams.set('shop', shop);
    }
    redirectUrl.searchParams.set('billing', 'error');
    redirectUrl.searchParams.set('message', encodeURIComponent(error.message || 'Unable to confirm subscription'));
    res.redirect(redirectUrl.toString());
  }
};

export const syncPlan = async (req, res, next) => {
  try {
    if (!req.store) {
      throw new AppError('Store context required', 400);
    }

    const result = await syncStorePlanFromShopify(req.store);
    return res.json({
      success: true,
      plan: req.store.plan,
      changed: result.changed,
      planDetails: getPlanCapabilities(req.store.plan)
    });
  } catch (error) {
    next(error);
  }
};

export const getPlanCapabilitiesHandler = async (req, res, next) => {
  try {
    if (!req.store) {
      throw new AppError('Store context required', 400);
    }

    return res.json({
      success: true,
      context: serializePlanContext(req.store)
    });
  } catch (error) {
    next(error);
  }
};

export const cancelCurrentSubscription = async (req, res, next) => {
  try {
    if (!req.store) {
      throw new AppError('Store context required', 400);
    }

    // Get active subscriptions
    const subscriptions = await getActiveSubscriptions(req.store);
    
    if (!subscriptions || subscriptions.length === 0) {
      throw new AppError('No active subscription found to cancel', 400);
    }

    // Cancel the first active subscription (typically there's only one)
    const subscriptionToCancel = subscriptions[0];
    const result = await cancelSubscription(req.store, subscriptionToCancel.id);

    // Note: The plan will revert to 'free' when the subscription period ends
    // This is handled by Shopify webhooks or periodic sync via syncStorePlanFromShopify

    return res.json({
      success: true,
      message: 'Subscription cancelled successfully. Your plan will revert to Free when the current billing period ends.',
      subscription: result.subscription
    });
  } catch (error) {
    next(error);
  }
};


