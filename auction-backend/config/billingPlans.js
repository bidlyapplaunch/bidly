export const PLAN_LEVELS = Object.freeze({
  none: 0,
  basic: 1,
  pro: 2,
  enterprise: 3
});

export const BILLING_PLANS = Object.freeze({
  basic: {
    key: 'basic',
    name: 'Bidly Basic',
    price: 9.99,
    currencyCode: 'USD',
    trialDays: 7,
    level: PLAN_LEVELS.basic,
    limits: {
      auctions: 3
    },
    features: {
      removeBranding: false,
      customization: false,
      popcorn: false,
      chat: false
    }
  },
  pro: {
    key: 'pro',
    name: 'Bidly Pro',
    price: 19.99,
    currencyCode: 'USD',
    trialDays: 7,
    level: PLAN_LEVELS.pro,
    limits: {
      auctions: 20
    },
    features: {
      removeBranding: true,
      customization: true,
      popcorn: true,
      chat: false
    }
  },
  enterprise: {
    key: 'enterprise',
    name: 'Bidly Enterprise',
    price: 49.99,
    currencyCode: 'USD',
    trialDays: 7,
    level: PLAN_LEVELS.enterprise,
    limits: {
      auctions: null
    },
    features: {
      removeBranding: true,
      customization: true,
      popcorn: true,
      chat: true
    }
  }
});

export const PLAN_ORDER = ['none', 'basic', 'pro', 'enterprise'];

export const DEFAULT_PLAN = 'none';

export function sanitizePlan(planKey) {
  if (!planKey) return DEFAULT_PLAN;
  const normalized = planKey.toLowerCase();
  if (normalized in PLAN_LEVELS) {
    return normalized;
  }
  return DEFAULT_PLAN;
}

export function getPlan(levelOrKey) {
  if (!levelOrKey && levelOrKey !== 0) {
    return BILLING_PLANS.basic;
  }

  if (typeof levelOrKey === 'string') {
    const key = sanitizePlan(levelOrKey);
    return BILLING_PLANS[key] || BILLING_PLANS.basic;
  }

  const match = Object.values(BILLING_PLANS).find((plan) => plan.level === levelOrKey);
  return match || BILLING_PLANS.basic;
}

export function getPlanLevel(planKey) {
  const sanitized = sanitizePlan(planKey);
  return PLAN_LEVELS[sanitized] ?? PLAN_LEVELS[DEFAULT_PLAN];
}

export function planMeetsRequirement(currentPlan, requiredPlan) {
  const currentLevel = getPlanLevel(currentPlan);
  const requiredLevel = getPlanLevel(requiredPlan);
  return currentLevel >= requiredLevel;
}

export function getPlanCapabilities(planKey) {
  const plan = getPlan(planKey);
  return {
    key: plan.key,
    name: plan.name,
    level: plan.level,
    limits: plan.limits,
    features: plan.features,
    price: plan.price,
    currencyCode: plan.currencyCode,
    trialDays: plan.trialDays
  };
}

export function getHigherPlans(requiredPlanKey) {
  const requiredLevel = getPlanLevel(requiredPlanKey);
  return Object.values(BILLING_PLANS)
    .filter((plan) => plan.level >= requiredLevel)
    .sort((a, b) => a.level - b.level)
    .map((plan) => getPlanCapabilities(plan.key));
}


