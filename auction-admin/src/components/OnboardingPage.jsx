import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Banner, Button, Card, Layout, Page, Spinner, Text, TextField } from '@shopify/polaris';
import { Redirect } from '@shopify/app-bridge/actions';
import { useAppBridge } from '@shopify/app-bridge-react';
import { onboardingAPI } from '../services/api';
import useAdminI18n from '../hooks/useAdminI18n';

const stackStyle = (gap = 16) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: typeof gap === 'number' ? `${gap}px` : gap
});

const rowStyle = ({ gap = 12, justify = 'flex-start', align = 'center', wrap = true } = {}) => ({
  display: 'flex',
  alignItems: align,
  justifyContent: justify,
  flexWrap: wrap ? 'wrap' : 'nowrap',
  gap: typeof gap === 'number' ? `${gap}px` : gap
});

const OnboardingPage = ({ initialStatus, onComplete }) => {
  const i18n = useAdminI18n();
  const app = useAppBridge();
  const [status, setStatus] = useState(initialStatus || null);
  const [loading, setLoading] = useState(!initialStatus);
  const [widgetConfirmed, setWidgetConfirmed] = useState(initialStatus?.widgetActive ?? false);
  const [stepTwoComplete, setStepTwoComplete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [toast, setToast] = useState(null);

  const marketplaceUrl = status?.marketplaceUrl || '';
  const shopSlug = status?.storeSlug || status?.shopDomain?.replace('.myshopify.com', '') || '';

  const widgetError = status?.widgetError;
  const widgetDetected = Boolean(status?.widgetActive);
  const widgetEnabled = widgetConfirmed;
  const allStepsComplete = widgetConfirmed && stepTwoComplete;

  const showToast = useCallback((content, tone = 'success') => {
    setToast({ content, tone });
  }, []);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await onboardingAPI.getStatus();
      setStatus(response);
      setWidgetConfirmed(response.widgetActive || false);
    } catch (error) {
      console.error('Failed to load onboarding status', error);
      showToast(i18n.translate('admin.onboarding.errors.loadStatus'), 'critical');
    } finally {
      setLoading(false);
    }
  }, [showToast, i18n]);

  useEffect(() => {
    if (!initialStatus) {
      fetchStatus();
    }
  }, [fetchStatus, initialStatus]);

  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
      setWidgetConfirmed(initialStatus.widgetActive || false);
    }
  }, [initialStatus]);

  const dispatchRedirect = useCallback(
    (path) => {
      const redirect = Redirect.create(app);
      redirect.dispatch(Redirect.Action.ADMIN_PATH, path);
    },
    [app]
  );

  const handleOpenThemeEditor = useCallback(() => {
    const path = '/themes/current/editor?context=apps';
    dispatchRedirect(path);
    if (status?.storeSlug) {
      window.open(`https://admin.shopify.com/store/${status.storeSlug}${path}`, '_blank', 'noopener');
    }
  }, [dispatchRedirect, status?.storeSlug]);

  const handleOpenMenuSettings = useCallback(() => {
    const path = '/content/menus';
    dispatchRedirect(path);
    if (status?.storeSlug) {
      window.open(`https://admin.shopify.com/store/${status.storeSlug}${path}`, '_blank', 'noopener');
    }
  }, [dispatchRedirect, status?.storeSlug]);

  const handleCopyMarketplaceUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(marketplaceUrl);
      showToast(i18n.translate('admin.onboarding.step2.toast.copied'));
    } catch (error) {
      console.error('Failed to copy URL', error);
      showToast(i18n.translate('admin.onboarding.step2.toast.copyError'), 'critical');
    }
  }, [marketplaceUrl, showToast, i18n]);

  const handleComplete = useCallback(async () => {
    if (completing || !allStepsComplete) return;
    try {
      setCompleting(true);
      await onboardingAPI.complete();
      showToast(i18n.translate('admin.onboarding.finish.toast.complete'));
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to complete onboarding', error);
      showToast(i18n.translate('admin.onboarding.finish.toast.error'), 'critical');
    } finally {
      setCompleting(false);
    }
  }, [allStepsComplete, completing, onComplete, showToast, i18n]);

  const handleMarkStepTwo = useCallback(() => {
    setStepTwoComplete(true);
    showToast(i18n.translate('admin.onboarding.step2.toast.reminder'));
  }, [showToast, i18n]);

  const handleConfirmWidget = useCallback(() => {
    setWidgetConfirmed(true);
    showToast(i18n.translate('admin.onboarding.step1.toast.marked'));
  }, [showToast, i18n]);

  const stepTwoDescription = useMemo(() => {
    if (!shopSlug) {
      return i18n.translate('admin.onboarding.step2.description');
    }
    return i18n.translate('admin.onboarding.step2.descriptionWithShop', { shop: shopSlug });
  }, [shopSlug, i18n]);

  if (loading || !status) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh'
        }}
      >
        <Spinner accessibilityLabel={i18n.translate('admin.onboarding.status.loading')} size="large" />
      </div>
    );
  }

  return (
    <Page
      title={i18n.translate('admin.onboarding.page.title')}
      subtitle={i18n.translate('admin.onboarding.page.subtitle')}
      narrowWidth
    >
      {toast && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone={toast.tone === 'critical' ? 'critical' : 'success'} onDismiss={() => setToast(null)}>
            <p>{toast.content}</p>
          </Banner>
        </div>
      )}
      <Layout>
        <Layout.Section>
          <Card>
            <div style={stackStyle(28)}>
              <div style={rowStyle({ justify: 'space-between' })}>
                <Text variant="headingMd">{i18n.translate('admin.onboarding.step1.title')}</Text>
                <Badge tone={widgetEnabled ? 'success' : 'attention'}>
                  {widgetEnabled ? i18n.translate('admin.onboarding.step1.completed') : i18n.translate('admin.onboarding.step1.pending')}
                </Badge>
              </div>
              <Text>
                {i18n.translate('admin.onboarding.step1.description')}
              </Text>
              {widgetDetected ? (
                <Text tone="success">{i18n.translate('admin.onboarding.step1.detected')}</Text>
              ) : (
                <Text tone={widgetError ? 'critical' : 'subdued'}>
                  {widgetError
                    ? i18n.translate('admin.onboarding.step1.error', { error: widgetError })
                    : i18n.translate('admin.onboarding.step1.notDetected')}
                </Text>
              )}
              <div style={rowStyle({ gap: 12 })}>
                <Button onClick={handleOpenThemeEditor} variant="primary">
                  {i18n.translate('admin.onboarding.step1.actions.openThemeEditor')}
                </Button>
                <Button onClick={fetchStatus}>{i18n.translate('admin.onboarding.step1.actions.refreshStatus')}</Button>
                {!widgetEnabled && (
                  <Button onClick={handleConfirmWidget} tone="critical">
                    {i18n.translate('admin.onboarding.step1.actions.markEnabled')}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={stackStyle(28)}>
              <div style={rowStyle({ justify: 'space-between' })}>
                <Text variant="headingMd">{i18n.translate('admin.onboarding.step2.title')}</Text>
                <Badge tone={stepTwoComplete ? 'success' : 'attention'}>
                  {stepTwoComplete ? i18n.translate('admin.onboarding.step2.completed') : i18n.translate('admin.onboarding.step2.pending')}
                </Badge>
              </div>
              <Text>{stepTwoDescription}</Text>
              <div style={rowStyle({ gap: 12, wrap: false })}>
                <TextField
                  label={i18n.translate('admin.onboarding.step2.marketplaceUrl')}
                  labelHidden
                  value={marketplaceUrl}
                  onChange={() => {}}
                  readOnly
                  autoComplete="off"
                />
                <Button onClick={handleCopyMarketplaceUrl}>{i18n.translate('admin.onboarding.step2.actions.copy')}</Button>
              </div>
              <div style={rowStyle({ gap: 12 })}>
                <Button onClick={handleOpenMenuSettings}>{i18n.translate('admin.onboarding.step2.actions.goToMenu')}</Button>
                <Button onClick={handleMarkStepTwo} variant={stepTwoComplete ? 'secondary' : 'primary'} disabled={stepTwoComplete}>
                  {stepTwoComplete ? i18n.translate('admin.onboarding.step2.actions.markedDone') : i18n.translate('admin.onboarding.step2.actions.markDone')}
                </Button>
              </div>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={stackStyle(20)}>
              <Text variant="headingMd">{i18n.translate('admin.onboarding.finish.title')}</Text>
              <Text>
                {i18n.translate('admin.onboarding.finish.description')}
              </Text>
              <div style={rowStyle({ gap: 12 })}>
                <Button
                  variant="primary"
                  tone="success"
                  disabled={!allStepsComplete || completing}
                  loading={completing}
                  onClick={handleComplete}
                >
                  {i18n.translate('admin.onboarding.finish.action')}
                </Button>
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default OnboardingPage;

