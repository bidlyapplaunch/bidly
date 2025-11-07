import axios from 'axios';
import Store from '../models/Store.js';
import {
  BILLING_PLANS,
  DEFAULT_PLAN,
  getPlanCapabilities,
  getPlanLevel,
  planMeetsRequirement,
  sanitizePlan
} from '../config/billingPlans.js';

const API_VERSION = process.env.SHOPIFY_BILLING_API_VERSION || process.env.SHOPIFY_API_VERSION || '2025-10';
const BILLING_TEST_MODE = process.env.SHOPIFY_BILLING_TEST === 'true';

function getPlanByName(name) {
  if (!name) return null;
  return Object.values(BILLING_PLANS).find((plan) => plan.name === name) || null;
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
  return subscriptions;
}

export async function syncStorePlanFromShopify(store) {
  const subscriptions = await getActiveSubscriptions(store);

  if (!subscriptions.length) {
    const previousPlan = store.plan;
    store.plan = DEFAULT_PLAN;
    store.pendingPlan = null;
    await store.save();
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
    const previousPlan = store.plan;
    store.plan = DEFAULT_PLAN;
    store.pendingPlan = null;
    await store.save();
    return {
      activePlan: DEFAULT_PLAN,
      changed: previousPlan !== DEFAULT_PLAN
    };
  }

  const previousPlan = store.plan;
  store.plan = highestPlan;
  store.pendingPlan = null;
  store.planActiveAt = new Date(selectedSubscription.createdAt || Date.now());
  if (selectedSubscription.trialDays) {
    const createdAt = selectedSubscription.createdAt ? new Date(selectedSubscription.createdAt) : new Date();
    store.trialEndsAt = new Date(createdAt.getTime() + selectedSubscription.trialDays * 24 * 60 * 60 * 1000);
  }
  await store.save();

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
  return {
    plan: planKey,
    pendingPlan: sanitizePlan(store?.pendingPlan) || null,
    capabilities: getPlanCapabilities(planKey)
  };
}


