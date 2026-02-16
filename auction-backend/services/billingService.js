import axios from 'axios';
import Store from '../models/Store.js';
import Auction from '../models/Auction.js';
import {
  BILLING_PLANS,
  DEFAULT_PLAN,
  getPlanCapabilities,
  getPlanLevel,
  sanitizePlan
} from '../config/billingPlans.js';

const API_VERSION = process.env.SHOPIFY_BILLING_API_VERSION || process.env.SHOPIFY_API_VERSION || '2025-10';
const BILLING_TEST_MODE = process.env.SHOPIFY_BILLING_TEST === 'true';

function getPlanByName(name) {
  if (!name) return null;
  
  // Try exact match first (backward compatibility)
  let plan = Object.values(BILLING_PLANS).find((plan) => plan.name === name);
  if (plan) return plan;
  
  // Try matching without "Bidly" prefix (for Managed Pricing)
  // Shopify uses "Enterprise", "Pro", "Basic" without prefix
  const nameWithoutPrefix = name.replace(/^Bidly\s+/i, '').trim();
  plan = Object.values(BILLING_PLANS).find((plan) => {
    const planNameWithoutPrefix = plan.name.replace(/^Bidly\s+/i, '').trim();
    return planNameWithoutPrefix.toLowerCase() === nameWithoutPrefix.toLowerCase();
  });
  
  return plan || null;
}

function buildShopifyGraphQLUrl(shopDomain) {
  return `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`;
}

async function postShopifyGraphQL(store, query, variables = {}) {
  if (!store?.shopDomain || !store?.accessToken) {
    throw new Error('Store access token is required for billing operations');
  }

  const url = buildShopifyGraphQLUrl(store.shopDomain);
  const response = await axios.post(
    url,
    { query, variables },
    {
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json'
      }
    }
  );

  if (response.data.errors) {
    throw new Error(response.data.errors.map((err) => err.message).join('; '));
  }

  return response.data.data;
}

export async function createSubscription(store, planKey, returnUrl) {
  const sanitizedPlan = sanitizePlan(planKey);
  const plan = BILLING_PLANS[sanitizedPlan];

  if (!plan) {
    throw new Error(`Invalid plan: ${planKey}`);
  }

  const mutation = `
    mutation CreateSubscription($name: String!, $returnUrl: URL!, $trialDays: Int!, $amount: Decimal!) {
      appSubscriptionCreate(
        name: $name,
        returnUrl: $returnUrl,
        trialDays: $trialDays,
        test: ${BILLING_TEST_MODE ? 'true' : 'false'},
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: $amount, currencyCode: USD }
              }
            }
          }
        ]
      ) {
        confirmationUrl
        appSubscription {
          id
          name
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    name: plan.name,
    returnUrl,
    trialDays: plan.trialDays,
    amount: plan.price.toFixed(2)
  };

  const data = await postShopifyGraphQL(store, mutation, variables);

  const result = data.appSubscriptionCreate;
  if (!result) {
    throw new Error('Unexpected billing response. Please try again.');
  }

  if (result.userErrors?.length) {
    const message = result.userErrors.map((err) => err.message).join('; ');
    throw new Error(message || 'Failed to create subscription');
  }

  if (!result.confirmationUrl) {
    throw new Error('Missing confirmation URL from Shopify');
  }

  store.pendingPlan = sanitizedPlan;
  await store.save();

  return {
    confirmationUrl: result.confirmationUrl,
    subscriptionId: result.appSubscription?.id || null
  };
}

export async function applyPlanChangeEffects(store, previousPlanKey, nextPlanKey) {
  if (!store || !store.shopDomain) {
    return { closedAuctions: 0, popcornDisabled: 0 };
  }

  const previousPlan = sanitizePlan(previousPlanKey || DEFAULT_PLAN);
  const nextPlan = sanitizePlan(nextPlanKey || DEFAULT_PLAN);

  if (getPlanLevel(nextPlan) >= getPlanLevel(previousPlan)) {
    return { closedAuctions: 0, popcornDisabled: 0 };
  }

  const targetPlanConfig = BILLING_PLANS[nextPlan] || BILLING_PLANS[DEFAULT_PLAN];
  const closingLimit = targetPlanConfig?.limits?.auctions ?? 0;
  let closedAuctions = 0;

  if (closingLimit !== null) {
    const activeAuctions = await Auction.find({
      shopDomain: store.shopDomain,
      isDeleted: { $ne: true },
      status: { $in: ['pending', 'active'] }
    }).sort({ createdAt: -1, _id: -1 });

    if (activeAuctions.length > closingLimit) {
      const toClose = activeAuctions.slice(closingLimit);
      await Promise.all(
        toClose.map(async (auction) => {
          auction.status = 'closed';
          auction.updatedAt = new Date();
          await auction.save();
        })
      );
      closedAuctions = toClose.length;
    }
  }

  let popcornDisabled = 0;
  if (!targetPlanConfig?.features?.popcorn) {
    const result = await Auction.updateMany(
      { shopDomain: store.shopDomain, popcornEnabled: true },
      { popcornEnabled: false }
    );
    popcornDisabled = result.modifiedCount || 0;
  }

  return { closedAuctions, popcornDisabled };
}

export async function getActiveSubscriptions(store) {
  const query = `
    query ActiveSubscriptions {
      currentAppInstallation {
        activeSubscriptions {
          id
          name
          status
          createdAt
          trialDays
        }
      }
    }
  `;

  const data = await postShopifyGraphQL(store, query);
  const subscriptions = data?.currentAppInstallation?.activeSubscriptions || [];
  
  // Filter to only include ACTIVE or ACCEPTED subscriptions
  // In production, cancelled subscriptions may remain in the list until billing period ends
  // In test mode, cancelled subscriptions are immediately removed
  const activeOnly = subscriptions.filter(sub => {
    const status = sub.status?.toUpperCase();
    return status === 'ACTIVE' || status === 'ACCEPTED';
  });
  
  return activeOnly;
}

export async function syncStorePlanFromShopify(store) {
  // Skip sync if plan was manually set
  if (store.planManuallySet) {
    console.log(`⏭️ Skipping plan sync for ${store.shopDomain} - plan is manually set to ${store.plan}`);
    return {
      activePlan: store.plan || DEFAULT_PLAN,
      changed: false,
      skipped: true
    };
  }

  const subscriptions = await getActiveSubscriptions(store);

  if (!subscriptions.length) {
    const previousPlan = sanitizePlan(store.plan || DEFAULT_PLAN);
    store.plan = DEFAULT_PLAN;
    store.pendingPlan = null;
    await store.save();
    await applyPlanChangeEffects(store, previousPlan, DEFAULT_PLAN);
    return {
      activePlan: DEFAULT_PLAN,
      changed: previousPlan !== DEFAULT_PLAN
    };
  }

  // Pick the highest plan based on configured names
  let highestPlan = DEFAULT_PLAN;
  let selectedSubscription = null;

  for (const subscription of subscriptions) {
    const plan = getPlanByName(subscription.name);
    if (!plan) continue;
    if (plan.level > getPlanLevel(highestPlan)) {
      highestPlan = plan.key;
      selectedSubscription = subscription;
    }
  }

  if (!selectedSubscription) {
    // No matching plan names - fall back to default
    const previousPlan = sanitizePlan(store.plan || DEFAULT_PLAN);
    store.plan = DEFAULT_PLAN;
    store.pendingPlan = null;
    await store.save();
    await applyPlanChangeEffects(store, previousPlan, DEFAULT_PLAN);
    return {
      activePlan: DEFAULT_PLAN,
      changed: previousPlan !== DEFAULT_PLAN
    };
  }

  const previousPlan = sanitizePlan(store.plan || DEFAULT_PLAN);
  store.plan = highestPlan;
  store.pendingPlan = null;
  store.planActiveAt = new Date(selectedSubscription.createdAt || Date.now());
  if (selectedSubscription.trialDays) {
    const createdAt = selectedSubscription.createdAt ? new Date(selectedSubscription.createdAt) : new Date();
    store.trialEndsAt = new Date(createdAt.getTime() + selectedSubscription.trialDays * 24 * 60 * 60 * 1000);
  }
  await store.save();
  await applyPlanChangeEffects(store, previousPlan, highestPlan);

  return {
    activePlan: highestPlan,
    changed: previousPlan !== highestPlan
  };
}

export async function getSubscriptionById(store, gid) {
  const query = `
    query SubscriptionById($id: ID!) {
      appSubscription(id: $id) {
        id
        name
        status
        createdAt
        trialDays
      }
    }
  `;

  const data = await postShopifyGraphQL(store, query, { id: gid });
  return data?.appSubscription || null;
}

export async function cancelSubscription(store, subscriptionId) {
  if (!subscriptionId) {
    throw new Error('Subscription ID is required');
  }

  const mutation = `
    mutation CancelSubscription($id: ID!) {
      appSubscriptionCancel(id: $id) {
        appSubscription {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await postShopifyGraphQL(store, mutation, { id: subscriptionId });

  const result = data.appSubscriptionCancel;
  if (!result) {
    throw new Error('Unexpected billing response. Please try again.');
  }

  if (result.userErrors?.length) {
    const message = result.userErrors.map((err) => err.message).join('; ');
    throw new Error(message || 'Failed to cancel subscription');
  }

  // Mark subscription as cancelled in store
  // The plan will revert to free when the subscription period ends
  // This is handled by Shopify webhooks or periodic sync
  return {
    success: true,
    subscription: result.appSubscription
  };
}

export async function attachStoreWithAccessToken(shopDomain) {
  const store = await Store.findByDomain(shopDomain);
  if (!store) {
    throw new Error(`Store ${shopDomain} not found`);
  }
  if (!store.accessToken) {
    throw new Error(`Store ${shopDomain} missing access token`);
  }
  return store;
}

export function serializePlanContext(store) {
  const planKey = sanitizePlan(store?.plan || DEFAULT_PLAN);
  const pendingPlanRaw = store?.pendingPlan;
  return {
    plan: planKey,
    pendingPlan: pendingPlanRaw ? sanitizePlan(pendingPlanRaw) : null,
    capabilities: getPlanCapabilities(planKey)
  };
}


