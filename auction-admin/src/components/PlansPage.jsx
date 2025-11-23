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
import useAdminI18n from '../hooks/useAdminI18n';

const PLAN_LEVELS = {
  free: 0,
  basic: 1,
  pro: 2,
  enterprise: 3
};

// FEATURE_LABELS will be localized in the component

// PLAN_CONFIG will be built dynamically using i18n

const PLAN_DISPLAY_ORDER = ['free', 'basic', 'pro', 'enterprise'];

// Helper function to translate highlight arrays
const translateHighlights = (i18n, prefix) => {
  const highlights = i18n.translate(`${prefix}.highlights`, { returnObjects: true });
  if (!Array.isArray(highlights)) return [];
  return highlights.map((line) => i18n.translate(line));
};

function PlanCard({ planKey, currentPlan, pendingPlan, onSelect, loadingPlan, i18n, planConfig }) {
  const plan = planConfig[planKey];
  const normalizedCurrent = (currentPlan || 'free').toLowerCase();
  const isCurrent = normalizedCurrent === planKey;
  const isPending = pendingPlan === planKey && pendingPlan !== currentPlan;
  const isLoading = loadingPlan === planKey;
  const isDowngrade = PLAN_LEVELS[planKey] < PLAN_LEVELS[normalizedCurrent];
  const isUpgrade = PLAN_LEVELS[planKey] > PLAN_LEVELS[normalizedCurrent];

  const actionLabel = useMemo(() => {
    if (isCurrent) return i18n.translate('admin.billing.plans.currentPlan');
    if (isPending) return i18n.translate('admin.billing.plans.pendingActivation');
    if (planKey === 'free') return i18n.translate('admin.billing.plans.free.actionLabel');
    if (isDowngrade) return i18n.translate('admin.billing.plans.downgradeTo', { title: plan.title });
    return i18n.translate('admin.billing.plans.upgradeTo', { title: plan.title });
  }, [isCurrent, isPending, isDowngrade, plan.title, planKey, i18n]);

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
            <Text tone="subdued" variant="bodySm">{i18n.translate('admin.billing.plans.trialCopy')}</Text>
          )}
        </div>
      </LegacyCard.Section>
      <LegacyCard.Section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {translateHighlights(i18n, `admin.billing.plans.${planKey}`).map((text, index) => (
            <Text as="p" key={index} tone="subdued">
              • {text}
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
  const i18n = useAdminI18n();
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

  const FEATURE_LABELS = useMemo(() => {
    const proHighlights = translateHighlights(i18n, 'admin.billing.plans.pro');
    const enterpriseHighlights = translateHighlights(i18n, 'admin.billing.plans.enterprise');
    return {
      removeBranding: proHighlights[1] || 'Remove Bidly branding',
      customization: proHighlights[2] || 'Widget & marketplace customization',
      popcorn: proHighlights[3] || 'Popcorn bidding',
      chat: enterpriseHighlights[3] || 'Live bidder chatbox'
    };
  }, [i18n]);

  const PLAN_CONFIG = useMemo(() => {
    return {
      free: {
        key: 'free',
        title: i18n.translate('admin.billing.plans.free.title'),
        price: i18n.translate('admin.billing.plans.free.price'),
        description: i18n.translate('admin.billing.plans.free.description'),
        highlights: translateHighlights(i18n, 'admin.billing.plans.free'),
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
        title: i18n.translate('admin.billing.plans.basic.title'),
        price: i18n.translate('admin.billing.plans.basic.price'),
        description: i18n.translate('admin.billing.plans.basic.description'),
        highlights: translateHighlights(i18n, 'admin.billing.plans.basic'),
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
        title: i18n.translate('admin.billing.plans.pro.title'),
        price: i18n.translate('admin.billing.plans.pro.price'),
        description: i18n.translate('admin.billing.plans.pro.description'),
        highlights: translateHighlights(i18n, 'admin.billing.plans.pro'),
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
        title: i18n.translate('admin.billing.plans.enterprise.title'),
        price: i18n.translate('admin.billing.plans.enterprise.price'),
        description: i18n.translate('admin.billing.plans.enterprise.description'),
        highlights: translateHighlights(i18n, 'admin.billing.plans.enterprise'),
        limits: { auctions: null },
        features: {
          removeBranding: true,
          customization: true,
          popcorn: true,
          chat: true
        }
      }
    };
  }, [i18n]);

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
        setError(planResponse.message || i18n.translate('admin.billing.errors.loadError'));
      }

      if (statsResponse) {
        setAuctionStats(statsResponse);
      }
    } catch (err) {
      console.error('Plan load error', err);
      setError(err.response?.data?.message || err.message || i18n.translate('admin.billing.errors.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const formatLimit = useCallback((limit) => {
    if (limit === null) {
      return i18n.translate('admin.billing.formatLimit.unlimited');
    }
    if (typeof limit === 'number') {
      return i18n.translate('admin.billing.formatLimit.activeAuctions', { count: limit });
    }
    return i18n.translate('admin.billing.formatLimit.unlimited');
  }, [i18n]);


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
        setError(response.message || i18n.translate('admin.billing.errors.subscribeError'));
      }
    } catch (err) {
      console.error('Subscribe error', err);
      setError(err.response?.data?.message || err.message || i18n.translate('admin.billing.errors.subscribeError'));
    } finally {
      setLoadingPlan(null);
    }
  }, [i18n]);

  const buildDowngradeInfo = useCallback(
    (targetPlanKey) => {
      const currentPlanKey = (planData.plan || 'free').toLowerCase();
      const currentPlanConfig = PLAN_CONFIG[currentPlanKey] || PLAN_CONFIG.free;
      const targetPlanConfig = PLAN_CONFIG[targetPlanKey] || PLAN_CONFIG.free;
      const currentFeatures = planData.planDetails?.features || currentPlanConfig.features || {};
      const targetFeatures = targetPlanConfig.features || {};
      const lostFeatures = Object.keys(FEATURE_LABELS).filter(
        (feature) => currentFeatures[feature] && !targetFeatures[feature]
      ).map((feature) => FEATURE_LABELS[feature]);

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
        lostFeatures,
        currentLimit,
        targetLimit,
        totalScheduledAuctions,
        auctionsToClose
      };
    },
    [auctionStats, planData, FEATURE_LABELS]
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
        setError(response.message || i18n.translate('admin.billing.cancel.resubscribe'));
        await loadPlan(); // Reload plan data
      } else {
        setError(response.message || i18n.translate('admin.billing.errors.cancelError'));
      }
    } catch (err) {
      console.error('Cancel subscription error', err);
      setError(err.response?.data?.message || err.message || i18n.translate('admin.billing.errors.cancelError'));
    } finally {
      setCancelling(false);
    }
  }, [closeCancelModal, loadPlan, i18n]);

  const banner = useMemo(() => {
    if (billingStatus.status === 'success') {
      return (
        <Banner tone="success" title={i18n.translate('admin.billing.banners.subscriptionActivated.title')}>
          <p>{i18n.translate('admin.billing.banners.subscriptionActivated.message')}</p>
        </Banner>
      );
    }
    if (billingStatus.status === 'pending') {
      return (
        <Banner tone="info" title={i18n.translate('admin.billing.banners.awaitingConfirmation.title')}>
          <p>{i18n.translate('admin.billing.banners.awaitingConfirmation.message')}</p>
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
        : i18n.translate('admin.billing.banners.subscriptionNotConfirmed.message');
      return (
        <Banner tone="critical" title={i18n.translate('admin.billing.banners.subscriptionNotConfirmed.title')}>
          <p>{errorMessage}</p>
        </Banner>
      );
    }
    if (error) {
      // Check if it's a cancellation success message
      if (error.includes('cancelled successfully') || error.includes('revert to Free')) {
        return (
          <Banner tone="success" title={i18n.translate('admin.billing.banners.subscriptionCancelled.title')}>
            <p>{i18n.translate('admin.billing.banners.subscriptionCancelled.message', { message: error })}</p>
          </Banner>
        );
      }
      return (
        <Banner tone="critical" title={i18n.translate('admin.billing.banners.loadError.title')}>
          <p>{error}</p>
          <Button onClick={loadPlan}>{i18n.translate('admin.billing.banners.loadError.retry')}</Button>
        </Banner>
      );
    }
    return null;
  }, [billingStatus, error, loadPlan, i18n]);

  const previewModeBanner =
    !loading && !planData.plan ? (
      <Banner
        tone="warning"
        title={i18n.translate('admin.billing.banners.previewMode.title')}
        action={{
          content: i18n.translate('admin.billing.banners.previewMode.action'),
          onAction: () => navigate(`/plans${location.search || ''}`)
        }}
      >
        <p>{i18n.translate('admin.billing.banners.previewMode.message')}</p>
      </Banner>
    ) : null;


  return (
    <>
      <Page
        title={i18n.translate('admin.billing.page.title')}
        subtitle={i18n.translate('admin.billing.page.subtitle')}
        backAction={{
          content: i18n.translate('admin.common.back'),
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
                    <Text variant="headingMd">{i18n.translate('admin.billing.currentPlan.title')}</Text>
                    {loading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Spinner accessibilityLabel={i18n.translate('admin.billing.currentPlan.loading')} size="small" />
                        <Text tone="subdued">{i18n.translate('admin.billing.currentPlan.loading')}</Text>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <Text tone="subdued">{i18n.translate('admin.billing.currentPlan.active', { plan: planData.plan || 'free' })}</Text>
                        {/* Only show Pending if there's a real pending change (cancellation or downgrade) */}
                        {planData.pendingPlan && 
                         planData.pendingPlan !== planData.plan && 
                         (planData.pendingPlan === 'free' || PLAN_LEVELS[planData.pendingPlan] < PLAN_LEVELS[planData.plan]) && (
                          <Text tone="subdued">{i18n.translate('admin.billing.currentPlan.pending', { plan: planData.pendingPlan })}</Text>
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
                      {i18n.translate('admin.billing.currentPlan.cancelSubscription')}
                    </Button>
                  )}
                </div>
              </LegacyCard.Section>
            </LegacyCard>
          </Layout.Section>

          <Layout.Section>
            <Text variant="headingMd">{i18n.translate('admin.billing.plans.title')}</Text>
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
                  i18n={i18n}
                  planConfig={PLAN_CONFIG}
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
          title={i18n.translate('admin.billing.downgrade.title', { plan: PLAN_CONFIG[downgradeModal.targetPlan].title })}
          primaryAction={{
            content: i18n.translate('admin.billing.downgrade.confirm'),
            destructive: true,
            onAction: confirmDowngrade,
            loading: loadingPlan === downgradeModal.targetPlan
          }}
          secondaryActions={[
            {
              content: i18n.translate('admin.common.cancel'),
              onAction: closeDowngradeModal
            }
          ]}
        >
          <Modal.Section>
            <Text variant="bodyMd">
              {i18n.translate('admin.billing.downgrade.message', {
                current: PLAN_CONFIG[downgradeModal.info.currentPlanKey].title,
                target: PLAN_CONFIG[downgradeModal.targetPlan].title
              })}
            </Text>
            <div style={{ marginTop: '16px' }}>
              <List type="bullet">
                {downgradeModal.info.lostFeatures.length > 0 &&
                  downgradeModal.info.lostFeatures.map((feature) => (
                    <List.Item key={feature}>{i18n.translate('admin.billing.downgrade.featureRemoved', { feature })}</List.Item>
                  ))}
                {downgradeModal.info.lostFeatures.length === 0 && (
                  <List.Item key="no-features">{i18n.translate('admin.billing.downgrade.noFeaturesRemoved')}</List.Item>
                )}
                {typeof downgradeModal.info.auctionsToClose === 'number' ? (
                  downgradeModal.info.auctionsToClose > 0 ? (
                    <List.Item key="auctions">
                      {i18n.translate('admin.billing.downgrade.auctionsToClose', {
                        count: downgradeModal.info.auctionsToClose,
                        plural: downgradeModal.info.auctionsToClose === 1 ? '' : 's',
                        limit: formatLimit(downgradeModal.info.targetLimit)
                      })}
                    </List.Item>
                  ) : (
                    <List.Item key="auctions-fit">
                      {i18n.translate('admin.billing.downgrade.auctionsFit', {
                        limit: formatLimit(downgradeModal.info.targetLimit)
                      })}
                    </List.Item>
                  )
                ) : (
                  <List.Item key="auctions-unlimited">
                    {i18n.translate('admin.billing.downgrade.unlimitedLimit')}
                  </List.Item>
                )}
              </List>
            </div>
            <Text tone="critical" variant="bodySm">
              {i18n.translate('admin.billing.downgrade.warning')}
            </Text>
          </Modal.Section>
        </Modal>
      )}

      {cancelModal.open && (
        <Modal
          open
          onClose={closeCancelModal}
          title={i18n.translate('admin.billing.cancel.title')}
          primaryAction={{
            content: i18n.translate('admin.billing.cancel.confirm'),
            destructive: true,
            onAction: confirmCancelSubscription,
            loading: cancelling
          }}
          secondaryActions={[
            {
              content: i18n.translate('admin.billing.cancel.keep'),
              onAction: closeCancelModal
            }
          ]}
        >
          <Modal.Section>
            <Text variant="bodyMd">
              {i18n.translate('admin.billing.cancel.message')}
            </Text>
            <div style={{ marginTop: '16px' }}>
              <Text tone="subdued" variant="bodyMd">
                {i18n.translate('admin.billing.cancel.description')}
              </Text>
              <List type="bullet">
                <List.Item>{i18n.translate('admin.billing.cancel.freeFeatures.0')}</List.Item>
                <List.Item>{i18n.translate('admin.billing.cancel.freeFeatures.1')}</List.Item>
                <List.Item>{i18n.translate('admin.billing.cancel.freeFeatures.2')}</List.Item>
              </List>
            </div>
            <Text tone="critical" variant="bodySm" style={{ marginTop: '16px' }}>
              {i18n.translate('admin.billing.cancel.resubscribe')}
            </Text>
          </Modal.Section>
        </Modal>
      )}
    </>
  );
};

export default PlansPage;


