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
import { useI18n } from '@shopify/react-i18n';
import { getTranslationsForLocale, resolveLocale } from '../locales';

const PLAN_LEVELS = {
  free: 0,
  basic: 1,
  pro: 2,
  enterprise: 3
};

// FEATURE_LABELS will be localized in the component

// PLAN_CONFIG will be built dynamically using i18n

const PLAN_DISPLAY_ORDER = ['free', 'basic', 'pro', 'enterprise'];

function PlanCard({ planKey, currentPlan, pendingPlan, onSelect, loadingPlan, i18n, planConfig, t, translateHighlights, onShowUpgradeInstructions }) {
  const plan = planConfig[planKey];
  const normalizedCurrent = (currentPlan || 'free').toLowerCase();
  const isCurrent = normalizedCurrent === planKey;
  const isPending = pendingPlan === planKey && pendingPlan !== currentPlan;
  const isLoading = loadingPlan === planKey;
  const isDowngrade = PLAN_LEVELS[planKey] < PLAN_LEVELS[normalizedCurrent];
  const isUpgrade = PLAN_LEVELS[planKey] > PLAN_LEVELS[normalizedCurrent];

  const actionLabel = useMemo(() => {
    if (isCurrent) return t('admin.billing.plans.currentPlan');
    if (isPending) return t('admin.billing.plans.pendingActivation');
    if (planKey === 'free') return t('admin.billing.plans.free.actionLabel');
    if (isDowngrade) return `Downgrade to ${plan.title}`;
    return `Upgrade to ${plan.title}`;
  }, [isCurrent, isPending, isDowngrade, plan.title, planKey, t]);

  const handleSelect = useCallback(() => {
    // Free plan cannot be selected (it's the default)
    if (planKey === 'free') return;
    if (isCurrent || isPending) return;
    
    // With managed pricing, show instructions instead of calling API
    if (onShowUpgradeInstructions) {
      onShowUpgradeInstructions(planKey, isUpgrade);
    } else {
      // Fallback to old behavior if handler not provided
      onSelect(planKey);
    }
  }, [isCurrent, isPending, onSelect, planKey, onShowUpgradeInstructions, isUpgrade]);

  return (
    <LegacyCard>
      <LegacyCard.Section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Text variant="headingMd">{plan.title}</Text>
          <Text tone="subdued">{plan.price}</Text>
          <Text tone="subdued">{plan.description}</Text>
          {/* Show trial message only for paid plans */}
          {planKey !== 'free' && (
            <Text tone="subdued" variant="bodySm">{t('admin.billing.plans.trialCopy')}</Text>
          )}
        </div>
      </LegacyCard.Section>
      <LegacyCard.Section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {translateHighlights(`admin.billing.plans.${planKey}`).map((text, index) => (
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
  const [upgradeInstructionsModal, setUpgradeInstructionsModal] = useState({ open: false, planKey: null, isUpgrade: true });

  // Block rendering until i18n is ready
  if (!i18n || !i18n.translate) {
    return null;
  }

  // Optional: Verify billing namespace is loaded
  useEffect(() => {
    if (i18n && i18n.translations) {
      console.log('i18n translations loaded:', Object.keys(i18n.translations || {}));
      const hasBilling = i18n.translations && (
        i18n.translations['admin.billing.plans.pro.highlights'] !== undefined ||
        i18n.translations['admin']?.billing?.plans?.pro?.highlights !== undefined
      );
      console.log('Billing namespace loaded:', hasBilling);
    }
  }, [i18n]);

  // Safe translation helper that runs AFTER mount
  const t = useCallback((key, opts) => {
    if (!i18n || !i18n.translate) return key;
    try {
      return i18n.translate(key, opts);
    } catch (err) {
      console.error('Translation error for key:', key, err);
      return key;
    }
  }, [i18n]);

  // Get current locale from i18n context (must be called at component level)
  const [i18nContext] = useI18n();
  const currentLocale = i18nContext?.locale || 'en';
  const resolvedLocale = resolveLocale(currentLocale);

  // Helper function to translate highlight objects (moved inside component)
  const translateHighlights = useCallback((prefix) => {
    if (!i18n || !i18n.translate) return [];
    try {
      // Get translations directly from locale files
      const translations = getTranslationsForLocale(resolvedLocale);
      const keyParts = prefix.split('.');
      
      // Navigate through the translation object
      let highlightsObj = translations;
      for (const part of keyParts) {
        if (highlightsObj && typeof highlightsObj === 'object' && highlightsObj[part] !== undefined) {
          highlightsObj = highlightsObj[part];
        } else {
          highlightsObj = null;
          break;
        }
      }
      
      // Get highlights object
      const highlights = highlightsObj?.highlights;
      
      // Polaris i18n returns objects with numeric string keys, not arrays
      if (!highlights || typeof highlights !== 'object') {
        return [];
      }
      
      // Use Object.values() to get all highlight values
      return Object.values(highlights).map((value) => {
        if (typeof value === 'string') {
          // Value is already translated, return as-is
          return value;
        }
        return value;
      });
    } catch (err) {
      console.error('Error translating highlights for:', prefix, err);
      return [];
    }
  }, [i18n, resolvedLocale]);

  const FEATURE_LABELS = useMemo(() => {
    const proHighlights = translateHighlights('admin.billing.plans.pro');
    const enterpriseHighlights = translateHighlights('admin.billing.plans.enterprise');
    return {
      removeBranding: proHighlights[1] || 'Remove Bidly branding',
      customization: proHighlights[2] || 'Widget & marketplace customization',
      popcorn: proHighlights[3] || 'Popcorn bidding',
      chat: enterpriseHighlights[3] || 'Live bidder chatbox'
    };
  }, [translateHighlights]);

  const PLAN_CONFIG = useMemo(() => {
    return {
      free: {
        key: 'free',
        title: t('admin.billing.plans.free.title'),
        price: t('admin.billing.plans.free.price'),
        description: t('admin.billing.plans.free.description'),
        highlights: translateHighlights('admin.billing.plans.free'),
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
        title: t('admin.billing.plans.basic.title'),
        price: t('admin.billing.plans.basic.price'),
        description: t('admin.billing.plans.basic.description'),
        highlights: translateHighlights('admin.billing.plans.basic'),
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
        title: t('admin.billing.plans.pro.title'),
        price: t('admin.billing.plans.pro.price'),
        description: t('admin.billing.plans.pro.description'),
        highlights: translateHighlights('admin.billing.plans.pro'),
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
        title: t('admin.billing.plans.enterprise.title'),
        price: t('admin.billing.plans.enterprise.price'),
        description: t('admin.billing.plans.enterprise.description'),
        highlights: translateHighlights('admin.billing.plans.enterprise'),
        limits: { auctions: null },
        features: {
          removeBranding: true,
          customization: true,
          popcorn: true,
          chat: true
        }
      }
    };
  }, [t, translateHighlights]);

  const billingStatus = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      status: params.get('billing'),
      plan: params.get('plan'),
      message: params.get('message')
    };
  }, [location.search]);

  const loadPlan = useCallback(async () => {
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
        setError(planResponse.message || t('admin.billing.errors.loadError'));
      }

      if (statsResponse) {
        setAuctionStats(statsResponse);
      }
    } catch (err) {
      console.error('Plan load error', err);
      // If billing isn't available (403), default to free plan instead of showing error
      if (err.response?.status === 403 && err.response?.data?.code === 'BILLING_PARTNER_REQUIRED') {
        console.warn('Billing not available, defaulting to free plan');
        setPlanData({
          plan: 'free',
          pendingPlan: null,
          planDetails: PLAN_CONFIG.free,
          pendingPlanDetails: null,
          trialEndsAt: null
        });
        setError(''); // Clear error, show info message instead
      } else {
        setError(err.response?.data?.message || err.message || t('admin.billing.errors.loadError'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  const formatLimit = useCallback((limit) => {
    if (limit === null) {
      return t('admin.billing.formatLimit.unlimited');
    }
    if (typeof limit === 'number') {
      return t('admin.billing.formatLimit.activeAuctions', { count: limit });
    }
    return t('admin.billing.formatLimit.unlimited');
  }, [t]);


  useEffect(() => {
    loadPlan();
  }, []);

  // Show upgrade/downgrade instructions for managed pricing
  const showUpgradeInstructions = useCallback((planKey, isUpgrade) => {
    setUpgradeInstructionsModal({ open: true, planKey, isUpgrade });
  }, []);

  const closeUpgradeInstructionsModal = useCallback(() => {
    setUpgradeInstructionsModal({ open: false, planKey: null, isUpgrade: true });
  }, []);

  const startSubscription = useCallback(async (planKey) => {
    // This function is kept for backward compatibility but shouldn't be called with managed pricing
    // With managed pricing, showUpgradeInstructions should be used instead
    const isUpgrade = PLAN_LEVELS[planKey] > PLAN_LEVELS[(planData.plan || 'free').toLowerCase()];
    showUpgradeInstructions(planKey, isUpgrade);
  }, [showUpgradeInstructions, planData.plan]);

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
        setError(response.message || t('admin.billing.cancel.resubscribe'));
        await loadPlan(); // Reload plan data
      } else {
        setError(response.message || t('admin.billing.errors.cancelError'));
      }
    } catch (err) {
      console.error('Cancel subscription error', err);
      setError(err.response?.data?.message || err.message || t('admin.billing.errors.cancelError'));
    } finally {
      setCancelling(false);
    }
  }, [closeCancelModal, loadPlan, t]);

  const banner = useMemo(() => {
    if (billingStatus.status === 'success') {
      return (
        <Banner tone="success" title={t('admin.billing.banners.subscriptionActivated.title')}>
          <p>{t('admin.billing.banners.subscriptionActivated.message')}</p>
        </Banner>
      );
    }
    if (billingStatus.status === 'pending') {
      return (
        <Banner tone="info" title={t('admin.billing.banners.awaitingConfirmation.title')}>
          <p>{t('admin.billing.banners.awaitingConfirmation.message')}</p>
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
        : t('admin.billing.banners.subscriptionNotConfirmed.message');
      return (
        <Banner tone="critical" title={t('admin.billing.banners.subscriptionNotConfirmed.title')}>
          <p>{errorMessage}</p>
        </Banner>
      );
    }
    if (error) {
      // Check if it's a cancellation success message
      if (error.includes('cancelled successfully') || error.includes('revert to Free')) {
        return (
          <Banner tone="success" title={t('admin.billing.banners.subscriptionCancelled.title')}>
            <p>{t('admin.billing.banners.subscriptionCancelled.message', { message: error })}</p>
          </Banner>
        );
      }
      return (
        <Banner tone="critical" title={t('admin.billing.banners.loadError.title')}>
          <p>{error}</p>
          <Button onClick={loadPlan}>{t('admin.billing.banners.loadError.retry')}</Button>
        </Banner>
      );
    }
    return null;
  }, [billingStatus, error, loadPlan, t]);

  const previewModeBanner = useMemo(() => {
    if (!loading && !planData.plan) {
      return (
        <Banner
          tone="warning"
          title={t('admin.billing.banners.previewMode.title')}
          action={{
            content: t('admin.billing.banners.previewMode.action'),
            onAction: () => navigate(`/plans${location.search || ''}`)
          }}
        >
          <p>{t('admin.billing.banners.previewMode.message')}</p>
        </Banner>
      );
    }
    return null;
  }, [loading, planData.plan, t, navigate, location.search]);

  // Managed pricing info banner
  const managedPricingBanner = useMemo(() => {
    return (
      <Banner
        tone="info"
        title="Plan changes are managed through Shopify"
      >
        <p>
          To upgrade or downgrade your plan, please go to <strong>Settings → Apps and sales channels</strong> in your Shopify admin, 
          then click on Bidly and select <strong>"Change plan"</strong>. Your plan will be updated automatically.
        </p>
      </Banner>
    );
  }, []);


  return (
    <>
      <Page
        title={t('admin.billing.page.title')}
        subtitle={t('admin.billing.page.subtitle')}
        backAction={{
          content: t('admin.common.back'),
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
            {managedPricingBanner}
          </Layout.Section>

          <Layout.Section>
            <LegacyCard>
              <LegacyCard.Section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Text variant="headingMd">{t('admin.billing.currentPlan.title')}</Text>
                    {loading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Spinner accessibilityLabel={t('admin.billing.currentPlan.loading')} size="small" />
                        <Text tone="subdued">{t('admin.billing.currentPlan.loading')}</Text>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <Text tone="subdued">{t('admin.billing.currentPlan.active', { plan: PLAN_CONFIG[planData.plan || 'free']?.title || planData.plan || 'free' })}</Text>
                        {/* Only show Pending if there's a real pending change (cancellation or downgrade) */}
                        {planData.pendingPlan && 
                         planData.pendingPlan !== planData.plan && 
                         (planData.pendingPlan === 'free' || PLAN_LEVELS[planData.pendingPlan] < PLAN_LEVELS[planData.plan]) && (
                          <Text tone="subdued">{t('admin.billing.currentPlan.pending', { plan: PLAN_CONFIG[planData.pendingPlan]?.title || planData.pendingPlan })}</Text>
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
                      {t('admin.billing.currentPlan.cancelSubscription')}
                    </Button>
                  )}
                </div>
              </LegacyCard.Section>
            </LegacyCard>
          </Layout.Section>

          <Layout.Section>
            <Text variant="headingMd">{t('admin.billing.plans.title')}</Text>
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
                  onShowUpgradeInstructions={showUpgradeInstructions}
                  loadingPlan={loadingPlan}
                  i18n={i18n}
                  planConfig={PLAN_CONFIG}
                  t={t}
                  translateHighlights={translateHighlights}
                />
              ))}
            </div>
          </Layout.Section>
        </Layout>
      </Page>

      {/* Upgrade/Downgrade Instructions Modal for Managed Pricing */}
      {upgradeInstructionsModal.open && upgradeInstructionsModal.planKey && (
        <Modal
          open
          onClose={closeUpgradeInstructionsModal}
          title={upgradeInstructionsModal.isUpgrade ? 'How to upgrade your plan' : 'How to downgrade your plan'}
          primaryAction={{
            content: 'Got it',
            onAction: closeUpgradeInstructionsModal
          }}
        >
          <Modal.Section>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Text variant="bodyMd">
                {upgradeInstructionsModal.isUpgrade 
                  ? `To upgrade to the ${PLAN_CONFIG[upgradeInstructionsModal.planKey]?.title || upgradeInstructionsModal.planKey} plan:`
                  : `To downgrade to the ${PLAN_CONFIG[upgradeInstructionsModal.planKey]?.title || upgradeInstructionsModal.planKey} plan:`
                }
              </Text>
              <List type="number">
                <List.Item>
                  Go to <strong>Settings</strong> → <strong>Apps and sales channels</strong> in your Shopify admin
                </List.Item>
                <List.Item>
                  Find and click on <strong>Bidly</strong> in your installed apps
                </List.Item>
                <List.Item>
                  Click <strong>"Change plan"</strong> or <strong>"Manage subscription"</strong>
                </List.Item>
                <List.Item>
                  Select the {PLAN_CONFIG[upgradeInstructionsModal.planKey]?.title || upgradeInstructionsModal.planKey} plan and confirm
                </List.Item>
                <List.Item>
                  Your plan will be updated automatically and reflected here
                </List.Item>
              </List>
              <Text variant="bodyMd" tone="subdued">
                <strong>Note:</strong> Plan changes are processed by Shopify. Upgrades take effect immediately, 
                while downgrades take effect at the end of your current billing period.
              </Text>
            </div>
          </Modal.Section>
        </Modal>
      )}

      {downgradeModal.open && downgradeModal.info && (
        <Modal
          open
          onClose={closeDowngradeModal}
          title={t('admin.billing.downgrade.title', { plan: PLAN_CONFIG[downgradeModal.targetPlan]?.title || downgradeModal.targetPlan || 'plan' })}
          primaryAction={{
            content: t('admin.billing.downgrade.confirm'),
            destructive: true,
            onAction: confirmDowngrade,
            loading: loadingPlan === downgradeModal.targetPlan
          }}
          secondaryActions={[
            {
              content: t('admin.common.cancel'),
              onAction: closeDowngradeModal
            }
          ]}
        >
          <Modal.Section>
            <Text variant="bodyMd">
              {t('admin.billing.downgrade.message', {
                current: PLAN_CONFIG[downgradeModal.info.currentPlanKey].title,
                target: PLAN_CONFIG[downgradeModal.targetPlan].title
              })}
            </Text>
            <div style={{ marginTop: '16px' }}>
              <List type="bullet">
                {downgradeModal.info.lostFeatures.length > 0 &&
                  downgradeModal.info.lostFeatures.map((feature) => (
                    <List.Item key={feature}>{t('admin.billing.downgrade.featureRemoved', { feature })}</List.Item>
                  ))}
                {downgradeModal.info.lostFeatures.length === 0 && (
                  <List.Item key="no-features">{t('admin.billing.downgrade.noFeaturesRemoved')}</List.Item>
                )}
                {typeof downgradeModal.info.auctionsToClose === 'number' ? (
                  downgradeModal.info.auctionsToClose > 0 ? (
                    <List.Item key="auctions">
                      {t('admin.billing.downgrade.auctionsToClose', {
                        count: downgradeModal.info.auctionsToClose,
                        plural: downgradeModal.info.auctionsToClose === 1 ? '' : 's',
                        limit: formatLimit(downgradeModal.info.targetLimit)
                      })}
                    </List.Item>
                  ) : (
                    <List.Item key="auctions-fit">
                      {t('admin.billing.downgrade.auctionsFit', {
                        limit: formatLimit(downgradeModal.info.targetLimit)
                      })}
                    </List.Item>
                  )
                ) : (
                  <List.Item key="auctions-unlimited">
                    {t('admin.billing.downgrade.unlimitedLimit')}
                  </List.Item>
                )}
              </List>
            </div>
            <Text tone="critical" variant="bodySm">
              {t('admin.billing.downgrade.warning')}
            </Text>
          </Modal.Section>
        </Modal>
      )}

      {cancelModal.open && (
        <Modal
          open
          onClose={closeCancelModal}
          title={t('admin.billing.cancel.title')}
          primaryAction={{
            content: t('admin.billing.cancel.confirm'),
            destructive: true,
            onAction: confirmCancelSubscription,
            loading: cancelling
          }}
          secondaryActions={[
            {
              content: t('admin.billing.cancel.keep'),
              onAction: closeCancelModal
            }
          ]}
        >
          <Modal.Section>
            <Text variant="bodyMd">
              {t('admin.billing.cancel.message')}
            </Text>
            <div style={{ marginTop: '16px' }}>
              <Text tone="subdued" variant="bodyMd">
                {t('admin.billing.cancel.description')}
              </Text>
              <List type="bullet">
                <List.Item>{t('admin.billing.cancel.freeFeatures.0')}</List.Item>
                <List.Item>{t('admin.billing.cancel.freeFeatures.1')}</List.Item>
                <List.Item>{t('admin.billing.cancel.freeFeatures.2')}</List.Item>
              </List>
            </div>
            <Text tone="critical" variant="bodySm" style={{ marginTop: '16px' }}>
              {t('admin.billing.cancel.resubscribe')}
            </Text>
          </Modal.Section>
        </Modal>
      )}
    </>
  );
};

export default PlansPage;


