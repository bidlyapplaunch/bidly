import React, { useEffect, useMemo, useState } from 'react';
import {
  Banner,
  Button,
  Card,
  Frame,
  Layout,
  Page,
  Spinner,
  Text
} from '@shopify/polaris';
import { useLocation } from 'react-router-dom';
import { billingAPI } from '../services/api';

const PLAN_DEFINITIONS = [
  {
    key: 'basic',
    title: 'Basic',
    price: '$9.99/mo',
    description: 'Start hosting auctions with the essentials.',
    highlights: ['3 active auctions', 'Standard Bidly branding', 'Core auction workflows']
  },
  {
    key: 'pro',
    title: 'Pro',
    price: '$19.99/mo',
    description: 'Unlock advanced bidding and full widget styling.',
    highlights: [
      '20 active auctions',
      'Remove Bidly branding',
      'Widget & marketplace customization',
      'Popcorn bidding'
    ]
  },
  {
    key: 'enterprise',
    title: 'Enterprise',
    price: '$49.99/mo',
    description: 'Unlimited auctions plus real-time bidder chat.',
    highlights: [
      'Unlimited auctions',
      'Remove Bidly branding',
      'Advanced customization controls',
      'Popcorn bidding & live chatbox'
    ]
  }
];

const trialCopy = 'Includes a 7-day free trial. You can cancel anytime from your Shopify admin.';

function PlanCard({ plan, currentPlan, pendingPlan, onSubscribe, loadingPlan }) {
  const isCurrent = currentPlan === plan.key;
  const isPending = pendingPlan === plan.key && pendingPlan !== currentPlan;
  const isLoading = loadingPlan === plan.key;

  const actionLabel = useMemo(() => {
    if (isCurrent) return 'Current plan';
    if (isPending) return 'Pending activation';
    return `Choose ${plan.title}`;
  }, [isCurrent, isPending, plan.title]);

  return (
    <Card>
      <Card.Section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Text variant="headingMd">{plan.title}</Text>
          <Text tone="subdued">{plan.price}</Text>
          <Text tone="subdued">{plan.description}</Text>
        </div>
      </Card.Section>
      <Card.Section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {plan.highlights.map((item) => (
            <Text as="p" key={item} tone="subdued">
              • {item}
            </Text>
          ))}
        </div>
      </Card.Section>
      <Card.Section>
        <Button
          primary={!isCurrent && !isPending}
          disabled={isCurrent || isPending}
          loading={isLoading}
          onClick={() => onSubscribe(plan.key)}
        >
          {actionLabel}
        </Button>
      </Card.Section>
    </Card>
  );
}

const PlansPage = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planData, setPlanData] = useState({ plan: 'none', pendingPlan: null });
  const [loadingPlan, setLoadingPlan] = useState(null);

  const billingStatus = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      status: params.get('billing'),
      plan: params.get('plan'),
      message: params.get('message')
    };
  }, [location.search]);

  const loadPlan = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await billingAPI.getCurrentPlan();
      if (response.success) {
        setPlanData({
          plan: response.plan,
          pendingPlan: response.pendingPlan,
          planDetails: response.planDetails,
          pendingPlanDetails: response.pendingPlanDetails,
          trialEndsAt: response.trialEndsAt
        });
      } else {
        setError(response.message || 'Unable to load plan details');
      }
    } catch (err) {
      console.error('Plan load error', err);
      setError(err.response?.data?.message || err.message || 'Unable to load plan details');
    } finally {
      setLoading(false);
    }
  };

  const getTrialCopy = useMemo(() => {
    if (!planData.trialEndsAt) {
      return trialCopy;
    }

    try {
      const formatted = new Date(planData.trialEndsAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      return `${trialCopy} Trial ends on ${formatted}.`;
    } catch (err) {
      console.warn('Plan trial date formatting failed:', err);
      return trialCopy;
    }
  }, [planData.trialEndsAt]);

  useEffect(() => {
    loadPlan();
  }, []);

  const handleSubscribe = async (planKey) => {
    try {
      setLoadingPlan(planKey);
      const response = await billingAPI.subscribe(planKey);
      if (response.success && response.confirmationUrl) {
        window.location.href = response.confirmationUrl;
      } else {
        setError(response.message || 'Unable to start subscription. Please try again.');
      }
    } catch (err) {
      console.error('Subscribe error', err);
      setError(err.response?.data?.message || err.message || 'Unable to start subscription.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const banner = useMemo(() => {
    if (billingStatus.status === 'success') {
      return (
        <Banner tone="success" title="Subscription activated">
          <p>Your plan is now active. Thanks for upgrading!</p>
        </Banner>
      );
    }
    if (billingStatus.status === 'pending') {
      return (
        <Banner tone="info" title="Awaiting confirmation">
          <p>Finish approving the subscription in Shopify to unlock premium features.</p>
        </Banner>
      );
    }
    if (billingStatus.status === 'error') {
      const errorMessage = billingStatus.message
        ? (() => {
            try {
              return decodeURIComponent(billingStatus.message);
            } catch (err) {
              return billingStatus.message;
            }
          })()
        : 'There was a problem confirming billing.';
      return (
        <Banner tone="critical" title="Subscription not confirmed">
          <p>{errorMessage}</p>
        </Banner>
      );
    }
    if (error) {
      return (
        <Banner tone="critical" title="We couldn’t load your plan">
          <p>{error}</p>
          <Button onClick={loadPlan}>Retry</Button>
        </Banner>
      );
    }
    return null;
  }, [billingStatus, error]);

  return (
    <Frame>
      <Page title="Choose your Bidly plan" subtitle="Manage your subscription and unlock premium auction features.">
        <Layout>
          <Layout.Section>
            {banner}
          </Layout.Section>

          <Layout.Section>
            <Card>
              <Card.Section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Text variant="headingMd">Current plan</Text>
                    {loading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Spinner accessibilityLabel="Loading plan" size="small" />
                        <Text tone="subdued">Loading…</Text>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <Text tone="subdued">Active: {planData.plan || 'none'}</Text>
                        {planData.pendingPlan && planData.pendingPlan !== planData.plan && (
                          <Text tone="subdued">Pending: {planData.pendingPlan}</Text>
                        )}
                        <Text tone="subdued">{getTrialCopy}</Text>
                      </div>
                    )}
                  </div>
                </div>
              </Card.Section>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Text variant="headingMd">Plans</Text>
          </Layout.Section>

          <Layout.Section>
            <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {PLAN_DEFINITIONS.map((plan) => (
                <PlanCard
                  key={plan.key}
                  plan={plan}
                  currentPlan={planData.plan}
                  pendingPlan={planData.pendingPlan}
                  onSubscribe={handleSubscribe}
                  loadingPlan={loadingPlan}
                />
              ))}
            </div>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
};

export default PlansPage;


