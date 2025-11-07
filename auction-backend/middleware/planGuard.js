import Auction from '../models/Auction.js';
import { AppError } from './errorHandler.js';
import {
  BILLING_PLANS,
  DEFAULT_PLAN,
  PLAN_LEVELS,
  getHigherPlans,
  getPlanCapabilities,
  getPlanLevel,
  planMeetsRequirement,
  sanitizePlan
} from '../config/billingPlans.js';

export function getStorePlan(req) {
  if (!req.store) {
    return DEFAULT_PLAN;
  }
  return sanitizePlan(req.store.plan || DEFAULT_PLAN);
}

export function checkPlan(requiredPlan) {
  const required = sanitizePlan(requiredPlan);
  return (req, res, next) => {
    try {
      if (!req.store) {
        throw new AppError('Store context required', 400);
      }

      const currentPlan = getStorePlan(req);
      if (planMeetsRequirement(currentPlan, required)) {
        return next();
      }

      const message = `This feature requires the ${required.charAt(0).toUpperCase() + required.slice(1)} plan.`;

      return res.status(403).json({
        success: false,
        code: 'PLAN_UPGRADE_REQUIRED',
        message,
        plan: currentPlan,
        requiredPlan: required,
        upgradeOptions: getHigherPlans(required)
      });
    } catch (error) {
      next(error);
    }
  };
}

export async function enforceAuctionLimit(req, res, next) {
  try {
    if (!req.store) {
      throw new AppError('Store context required', 400);
    }

    const currentPlan = getStorePlan(req);
    const planConfig = BILLING_PLANS[currentPlan] || BILLING_PLANS.basic;
    const limit = planConfig.limits.auctions;

    if (limit === null) {
      return next();
    }

    const activeCount = await Auction.countDocuments({
      shopDomain: req.shopDomain,
      status: { $in: ['pending', 'active'] },
      isDeleted: { $ne: true }
    });

    if (activeCount >= limit) {
      let upgradeTarget = 'basic';
      if (currentPlan === 'basic') {
        upgradeTarget = 'pro';
      } else if (currentPlan === 'pro') {
        upgradeTarget = 'enterprise';
      } else if (currentPlan === 'enterprise') {
        upgradeTarget = 'enterprise';
      }

      return res.status(403).json({
        success: false,
        code: 'PLAN_LIMIT_REACHED',
        message: `You have reached the ${limit} auction limit for your current plan. Upgrade to create more auctions.`,
        limit,
        plan: currentPlan,
        upgradeOptions: getHigherPlans(upgradeTarget)
      });
    }

    return next();
  } catch (error) {
    next(error);
  }
}

export function getPlanContext(req) {
  const plan = getStorePlan(req);
  return {
    plan,
    level: getPlanLevel(plan),
    capabilities: getPlanCapabilities(plan)
  };
}

export function attachPlanContext(req, res, next) {
  try {
    if (req && req.store) {
      req.planContext = getPlanContext(req);
    }
  } catch (error) {
    console.warn('⚠️ Failed to attach plan context:', error.message);
  }
  next();
}


