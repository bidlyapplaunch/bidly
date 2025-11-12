import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Layout,
  Frame,
  Page,
  Spinner,
  Text,
  TextField,
  Toast
} from '@shopify/polaris';
import { Redirect } from '@shopify/app-bridge/actions';
import { useAppBridge } from '@shopify/app-bridge-react';
import { onboardingAPI } from '../services/api';

const OnboardingPage = ({ initialStatus, onComplete }) => {
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
      showToast('Failed to load onboarding status. Please try again.', 'critical');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

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
      showToast('Marketplace URL copied');
    } catch (error) {
      console.error('Failed to copy URL', error);
      showToast('Unable to copy URL. Please copy it manually.', 'critical');
    }
  }, [marketplaceUrl, showToast]);

  const handleComplete = useCallback(async () => {
    if (completing || !allStepsComplete) return;
    try {
      setCompleting(true);
      await onboardingAPI.complete();
      showToast('Onboarding complete! Redirecting to your dashboard.');
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to complete onboarding', error);
      showToast('Failed to complete onboarding. Please try again.', 'critical');
    } finally {
      setCompleting(false);
    }
  }, [allStepsComplete, completing, onComplete, showToast]);

  const handleMarkStepTwo = useCallback(() => {
    setStepTwoComplete(true);
    showToast('Remember to update your menu after copying the URL.');
  }, [showToast]);

  const handleConfirmWidget = useCallback(() => {
    setWidgetConfirmed(true);
    showToast('Marked widget as enabled.');
  }, [showToast]);

  const stepTwoDescription = useMemo(() => {
    if (!shopSlug) {
      return 'Open your Online Store navigation and add a new menu item linking to your auction marketplace.';
    }
    return `Open your Online Store navigation and add a new menu item linking to the marketplace. We've generated the URL for ${shopSlug}.`;
  }, [shopSlug]);

  if (loading || !status) {
    return (
      <Frame>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh'
          }}
        >
          <Spinner accessibilityLabel="Loading onboarding status" size="large" />
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      {toast && (
        <Toast
          content={toast.content}
          tone={toast.tone === 'critical' ? 'critical' : 'success'}
          onDismiss={() => setToast(null)}
        />
      )}
      <Page
        title="Welcome to Bidly"
        subtitle="Complete these steps to finish your setup."
        narrowWidth
      >
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd">Step 1 · Enable the Auction Widget</Text>
                  <Badge tone={widgetEnabled ? 'success' : 'attention'}>
                    {widgetEnabled ? 'Completed' : 'Pending'}
                  </Badge>
                </InlineStack>
                <Text>
                  Activate the Bidly widget in your Online Store so it can appear on your product pages. This opens the Shopify theme editor where you can enable the app embed.
                </Text>
                {widgetDetected ? (
                  <Text tone="success">We detected the widget is enabled in your theme.</Text>
                ) : (
                  <Text tone={widgetError ? 'critical' : 'subdued'}>
                    {widgetError
                      ? `We couldn’t confirm the widget automatically: ${widgetError}`
                      : 'If you have already enabled the widget, you can mark this step as complete manually.'}
                  </Text>
                )}
                <InlineStack gap="200">
                  <Button onClick={handleOpenThemeEditor} variant="primary">
                    Open theme editor
                  </Button>
                  <Button onClick={fetchStatus}>Refresh status</Button>
                  {!widgetEnabled && (
                    <Button onClick={handleConfirmWidget} tone="critical">
                      Mark widget as enabled
                    </Button>
                  )}
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd">Step 2 · Add the Auction Marketplace to your menu</Text>
                  <Badge tone={stepTwoComplete ? 'success' : 'attention'}>
                    {stepTwoComplete ? 'Completed' : 'Pending'}
                  </Badge>
                </InlineStack>
                <Text>{stepTwoDescription}</Text>
                <InlineStack gap="200" wrap={false}>
                  <TextField
                    label="Marketplace URL"
                    labelHidden
                    value={marketplaceUrl}
                    onChange={() => {}}
                    readOnly
                    autoComplete="off"
                  />
                  <Button onClick={handleCopyMarketplaceUrl}>Copy</Button>
                </InlineStack>
                <InlineStack gap="200">
                  <Button onClick={handleOpenMenuSettings}>Go to menu settings</Button>
                  <Button onClick={handleMarkStepTwo} variant={stepTwoComplete ? 'secondary' : 'primary'} disabled={stepTwoComplete}>
                    {stepTwoComplete ? 'Marked as done' : 'Mark step as done'}
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">Finish setup</Text>
                <Text>
                  Once both steps are complete, you&apos;re ready to start creating auctions with Bidly.
                </Text>
                <InlineStack gap="200">
                  <Button
                    variant="primary"
                    tone="success"
                    disabled={!allStepsComplete || completing}
                    loading={completing}
                    onClick={handleComplete}
                  >
                    Finish setup and open dashboard
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
};

export default OnboardingPage;

