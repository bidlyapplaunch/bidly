import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banner,
  Button,
  Layout,
  LegacyCard,
  Modal,
  Page,
  Spinner,
  Text,
  List
} from '@shopify/polaris';
import { useLocation, useNavigate } from 'react-router-dom';
import { auctionAPI, billingAPI } from '../services/api';

const PLAN_LEVELS = {
  free: 0,
  basic: 1,
  pro: 2,
  enterprise: 3
};

const FEATURE_LABELS = {
  removeBranding: 'Remove Bidly branding',
  customization: 'Widget & marketplace customization',
  popcorn: 'Popcorn bidding',
  chat: 'Live bidder chatbox'
};

const PLAN_CONFIG = {
  free: {
    key: 'free',
    title: 'Free',
    price: '$0/mo',
    description: 'Get started with Bidly and run your first auction.',
    highlights: ['1 active auction at a time', 'Preview dashboard access', 'Upgrade to unlock more auctions'],
    limits: { auctions: 1 },
    features: {
      removeBranding: false,
      customization: false,
      popcorn: false,
      chat: false
    }
  },
  basic: {
    key: 'basic',
    title: 'Basic',
    price: '$9.99/mo',
    description: 'Start hosting auctions with the essentials.',
    highlights: ['3 active auctions', 'Standard Bidly branding', 'Core auction workflows'],
    limits: { auctions: 3 },
    features: {
      removeBranding: false,
      customization: false,
      popcorn: false,
      chat: false
    }
  },
  pro: {
    key: 'pro',
    title: 'Pro',
    price: '$19.99/mo',
    description: 'Unlock advanced bidding and full widget styling.',
    highlights: [
      '20 active auctions',
      'Remove Bidly branding',
      'Widget & marketplace customization',
      'Popcorn bidding'
    ],
    limits: { auctions: 20 },
    features: {
      removeBranding: true,
      customization: true,
      popcorn: true,
      chat: false
    }
  },
  enterprise: {
    key: 'enterprise',
    title: 'Enterprise',
    price: '$49.99/mo',
    description: 'Unlimited auctions plus real-time bidder chat.',
    highlights: [
      'Unlimited auctions',
      'Remove Bidly branding',
      'Widget & marketplace customization',
      'Popcorn bidding & live chatbox'
    ],
    limits: { auctions: null },
    features: {
      removeBranding: true,
      customization: true,
      popcorn: true,
      chat: true
    }
  }
};

const PLAN_DISPLAY_ORDER = ['free', 'basic', 'pro', 'enterprise'];

const trialCopy = 'Includes a 7-day free trial. You can cancel anytime from your Shopify admin.';

function PlanCard({ planKey, currentPlan, pendingPlan, onSelect, loadingPlan }) {
  const plan = PLAN_CONFIG[planKey];
  const normalizedCurrent = (currentPlan || 'free').toLowerCase();
  const isCurrent = normalizedCurrent === planKey;
  const isPending = pendingPlan === planKey && pendingPlan !== currentPlan;
  const isLoading = loadingPlan === planKey;
  const isDowngrade = PLAN_LEVELS[planKey] < PLAN_LEVELS[normalizedCurrent];
  const isUpgrade = PLAN_LEVELS[planKey] > PLAN_LEVELS[normalizedCurrent];

  const actionLabel = useMemo(() => {
    if (isCurrent) return 'Current plan';
    if (isPending) return 'Pending activation';
    if (planKey === 'free') return 'Free plan';
    if (isDowngrade) return `Downgrade to ${plan.title}`;
    return `Upgrade to ${plan.title}`;
  }, [isCurrent, isPending, isDowngrade, plan.title, planKey]);

  const handleSelect = useCallback(() => {
    // Free plan cannot be selected (it's the default)
    if (planKey === 'free') return;
    if (!isCurrent && !isPending) {
      onSelect(planKey);
    }
  }, [isCurrent, isPending, onSelect, planKey]);

  return (
    <LegacyCard>
      <LegacyCard.Section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Text variant="headingMd">{plan.title}</Text>
          <Text tone="subdued">{plan.price}</Text>
          <Text tone="subdued">{plan.description}</Text>
          {/* Show trial message only for paid plans */}
          {planKey !== 'free' && (
            <Text tone="subdued" variant="bodySm">{trialCopy}</Text>
          )}
        </div>
      </LegacyCard.Section>
      <LegacyCard.Section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {plan.highlights.map((item) => (
            <Text as="p" key={item} tone="subdued">
              • {item}
            </Text>
          ))}
        </div>
      </LegacyCard.Section>
      {planKey !== 'free' && (
        <LegacyCard.Section>
          <Button
            primary={isUpgrade && !isPending}
            tone={isDowngrade ? 'critical' : undefined}
            disabled={isCurrent || isPending}
            loading={isLoading}
            onClick={handleSelect}
          >
            {actionLabel}
          </Button>
        </LegacyCard.Section>
      )}
    </LegacyCard>
  );
}

const PlansPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planData, setPlanData] = useState({ plan: 'free', pendingPlan: null });
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [auctionStats, setAuctionStats] = useState(null);
  const [downgradeModal, setDowngradeModal] = useState({ open: false, targetPlan: null, info: null });
  const [cancelModal, setCancelModal] = useState({ open: false });
  const [cancelling, setCancelling] = useState(false);

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
      const [planResponse, statsResponse] = await Promise.all([
        billingAPI.getCurrentPlan(),
        auctionAPI
          .getAuctionStats()
          .then((res) => (res.success ? res.data : null))
          .catch((err) => {
            console.error('Auction stats load error', err);
            return null;
          })
      ]);

      if (planResponse.success) {
        setPlanData({
          plan: planResponse.plan,
          pendingPlan: planResponse.pendingPlan,
          planDetails: planResponse.planDetails,
          pendingPlanDetails: planResponse.pendingPlanDetails,
          trialEndsAt: planResponse.trialEndsAt
        });
      } else {
        setError(planResponse.message || 'Unable to load plan details');
      }

      if (statsResponse) {
        setAuctionStats(statsResponse);
      }
    } catch (err) {
      console.error('Plan load error', err);
      setError(err.response?.data?.message || err.message || 'Unable to load plan details');
    } finally {
      setLoading(false);
    }
  };

  const formatLimit = useCallback((limit) => {
    if (limit === null) {
      return 'unlimited';
    }
    if (typeof limit === 'number') {
      return `${limit} active auctions`;
    }
    return 'unlimited';
  }, []);


  useEffect(() => {
    loadPlan();
  }, []);

  const startSubscription = useCallback(async (planKey) => {
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
  }, []);

  const buildDowngradeInfo = useCallback(
    (targetPlanKey) => {
      const currentPlanKey = (planData.plan || 'free').toLowerCase();
      const currentPlanConfig = PLAN_CONFIG[currentPlanKey] || PLAN_CONFIG.free;
      const targetPlanConfig = PLAN_CONFIG[targetPlanKey] || PLAN_CONFIG.free;
      const currentFeatures = planData.planDetails?.features || currentPlanConfig.features || {};
      const targetFeatures = targetPlanConfig.features || {};
      const lostFeatures = Object.keys(FEATURE_LABELS).filter(
        (feature) => currentFeatures[feature] && !targetFeatures[feature]
      );

      const currentLimit =
        planData.planDetails?.limits?.auctions !== undefined
          ? planData.planDetails.limits.auctions
          : currentPlanConfig.limits.auctions;
      const targetLimit = targetPlanConfig.limits?.auctions;
      const totalScheduledAuctions =
        (auctionStats?.activeAuctions || 0) + (auctionStats?.pendingAuctions || 0);

      let auctionsToClose = null;
      if (typeof targetLimit === 'number') {
        auctionsToClose = Math.max(0, totalScheduledAuctions - targetLimit);
      }

      return {
        currentPlanKey,
        targetPlanKey,
        lostFeatures: lostFeatures.map((feature) => FEATURE_LABELS[feature]),
        currentLimit,
        targetLimit,
        totalScheduledAuctions,
        auctionsToClose
      };
    },
    [auctionStats, planData]
  );

  const handlePlanSelection = useCallback(
    (planKey) => {
      const targetPlanKey = (planKey || '').toLowerCase();
      const currentPlanKey = (planData.plan || 'free').toLowerCase();
      if (!targetPlanKey || targetPlanKey === currentPlanKey) {
        return;
      }

      const currentLevel = PLAN_LEVELS[currentPlanKey] ?? 0;
      const targetLevel = PLAN_LEVELS[targetPlanKey] ?? 0;

      if (targetLevel >= currentLevel) {
        startSubscription(targetPlanKey);
        return;
      }

      const downgradeInfo = buildDowngradeInfo(targetPlanKey);
      setDowngradeModal({ open: true, targetPlan: targetPlanKey, info: downgradeInfo });
    },
    [buildDowngradeInfo, planData.plan, startSubscription]
  );

  const closeDowngradeModal = useCallback(() => {
    setDowngradeModal({ open: false, targetPlan: null, info: null });
  }, []);

  const confirmDowngrade = useCallback(async () => {
    const target = downgradeModal.targetPlan;
    closeDowngradeModal();
    if (target) {
      await startSubscription(target);
    }
  }, [closeDowngradeModal, downgradeModal.targetPlan, startSubscription]);

  const handleCancelSubscription = useCallback(() => {
    setCancelModal({ open: true });
  }, []);

  const closeCancelModal = useCallback(() => {
    setCancelModal({ open: false });
  }, []);

  const confirmCancelSubscription = useCallback(async () => {
    try {
      setCancelling(true);
      setError('');
      const response = await billingAPI.cancelSubscription();
      if (response.success) {
        closeCancelModal();
        // Show success message
        setError(response.message || 'Subscription cancelled successfully. Your plan will revert to Free when the current billing period ends.');
        await loadPlan(); // Reload plan data
      } else {
        setError(response.message || 'Failed to cancel subscription');
      }
    } catch (err) {
      console.error('Cancel subscription error', err);
      setError(err.response?.data?.message || err.message || 'Unable to cancel subscription.');
    } finally {
      setCancelling(false);
    }
  }, [closeCancelModal, loadPlan]);

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
      // Check if it's a cancellation success message
      if (error.includes('cancelled successfully') || error.includes('revert to Free')) {
        return (
          <Banner tone="success" title="Subscription cancelled">
            <p>{error}</p>
          </Banner>
        );
      }
      return (
        <Banner tone="critical" title="We couldn't load your plan">
          <p>{error}</p>
          <Button onClick={loadPlan}>Retry</Button>
        </Banner>
      );
    }
    return null;
  }, [billingStatus, error, loadPlan]);

  const previewModeBanner =
    !loading && !planData.plan ? (
      <Banner
        tone="warning"
        title="Upgrade to activate Bidly"
        action={{
          content: 'View plans',
          onAction: () => navigate(`/plans${location.search || ''}`)
        }}
      >
        <p>
          Preview mode lets you explore the admin, but auctions, customization, and live bidding are disabled until you
          choose a paid plan.
        </p>
      </Banner>
    ) : null;


  return (
    <>
      <Page
        title="Choose your Bidly plan"
        subtitle="Manage your subscription and unlock premium auction features."
        backAction={{
          content: 'Back',
          onAction: () => navigate(-1)
        }}
      >
        <Layout>
          <Layout.Section>
            {banner}
          </Layout.Section>

          {previewModeBanner && (
            <Layout.Section>{previewModeBanner}</Layout.Section>
          )}

          <Layout.Section>
            <LegacyCard>
              <LegacyCard.Section>
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
                        <Text tone="subdued">Active: {planData.plan || 'free'}</Text>
                        {/* Only show Pending if there's a real pending change (cancellation or downgrade) */}
                        {planData.pendingPlan && 
                         planData.pendingPlan !== planData.plan && 
                         (planData.pendingPlan === 'free' || PLAN_LEVELS[planData.pendingPlan] < PLAN_LEVELS[planData.plan]) && (
                          <Text tone="subdued">Pending: {planData.pendingPlan}</Text>
                        )}
                      </div>
                    )}
                  </div>
                  {!loading && planData.plan && planData.plan !== 'free' && (
                    <Button
                      tone="critical"
                      onClick={handleCancelSubscription}
                      disabled={cancelling}
                    >
                      Cancel subscription
                    </Button>
                  )}
                </div>
              </LegacyCard.Section>
            </LegacyCard>
          </Layout.Section>

          <Layout.Section>
            <Text variant="headingMd">Plans</Text>
          </Layout.Section>

          <Layout.Section>
            <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {PLAN_DISPLAY_ORDER.map((planKey) => (
                <PlanCard
                  key={planKey}
                  planKey={planKey}
                  currentPlan={planData.plan}
                  pendingPlan={planData.pendingPlan}
                  onSelect={handlePlanSelection}
                  loadingPlan={loadingPlan}
                />
              ))}
            </div>
          </Layout.Section>
        </Layout>
      </Page>

      {downgradeModal.open && downgradeModal.info && (
        <Modal
          open
          onClose={closeDowngradeModal}
          title={`Downgrade to ${PLAN_CONFIG[downgradeModal.targetPlan].title}`}
          primaryAction={{
            content: 'Confirm downgrade',
            destructive: true,
            onAction: confirmDowngrade,
            loading: loadingPlan === downgradeModal.targetPlan
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: closeDowngradeModal
            }
          ]}
        >
          <Modal.Section>
            <Text variant="bodyMd">
              {`You are downgrading from ${
                PLAN_CONFIG[downgradeModal.info.currentPlanKey].title
              } to ${PLAN_CONFIG[downgradeModal.targetPlan].title}.`}
            </Text>
            <div style={{ marginTop: '16px' }}>
              <List type="bullet">
                {downgradeModal.info.lostFeatures.length > 0 &&
                  downgradeModal.info.lostFeatures.map((feature) => (
                    <List.Item key={feature}>{`Feature removed: ${feature}`}</List.Item>
                  ))}
                {downgradeModal.info.lostFeatures.length === 0 && (
                  <List.Item key="no-features">No premium features will be removed.</List.Item>
                )}
                {typeof downgradeModal.info.auctionsToClose === 'number' ? (
                  downgradeModal.info.auctionsToClose > 0 ? (
                    <List.Item key="auctions">
                      {`We will automatically close ${downgradeModal.info.auctionsToClose} scheduled auction${
                        downgradeModal.info.auctionsToClose === 1 ? '' : 's'
                      } to meet the ${formatLimit(downgradeModal.info.targetLimit)} limit.`}
                    </List.Item>
                  ) : (
                    <List.Item key="auctions-fit">
                      {`Your current auction count already fits the ${formatLimit(downgradeModal.info.targetLimit)} limit.`}
                    </List.Item>
                  )
                ) : (
                  <List.Item key="auctions-unlimited">
                    The new plan includes an unlimited auction limit.
                  </List.Item>
                )}
              </List>
            </div>
            <Text tone="critical" variant="bodySm">
              Downgrading takes effect immediately and cannot be undone automatically.
            </Text>
          </Modal.Section>
        </Modal>
      )}

      {cancelModal.open && (
        <Modal
          open
          onClose={closeCancelModal}
          title="Cancel subscription"
          primaryAction={{
            content: 'Confirm cancellation',
            destructive: true,
            onAction: confirmCancelSubscription,
            loading: cancelling
          }}
          secondaryActions={[
            {
              content: 'Keep subscription',
              onAction: closeCancelModal
            }
          ]}
        >
          <Modal.Section>
            <Text variant="bodyMd">
              Are you sure you want to cancel your subscription?
            </Text>
            <div style={{ marginTop: '16px' }}>
              <Text tone="subdued" variant="bodyMd">
                Your subscription will remain active until the end of the current billing period. After that, your plan will automatically revert to the Free plan, which includes:
              </Text>
              <List type="bullet">
                <List.Item>1 active auction at a time</List.Item>
                <List.Item>Standard Bidly branding</List.Item>
                <List.Item>Basic auction features</List.Item>
              </List>
            </div>
            <Text tone="critical" variant="bodySm" style={{ marginTop: '16px' }}>
              You can resubscribe at any time to regain access to premium features.
            </Text>
          </Modal.Section>
        </Modal>
      )}
    </>
  );
};

export default PlansPage;


