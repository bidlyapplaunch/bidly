import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Page, Layout, Card, Text, Button, Banner, Spinner, Select } from '@shopify/polaris';
import { useCustomizationSettings } from '../hooks/useCustomizationSettings';
import useAdminI18n from '../hooks/useAdminI18n';

const COLOR_FIELDS = ['accent', 'text', 'timer', 'button_bg', 'button_hover', 'button_text', 'border'];

const GRADIENT_FIELDS = ['bg_solid', 'bg_gradient_start', 'bg_gradient_end'];

const stackStyle = (gap = 12) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: typeof gap === 'number' ? `${gap}px` : gap
});

function ColorSwatchInput({ label, description, value, onChange }) {
  const handleTextChange = (event) => {
    const next = event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`;
    if (/^#[0-9a-fA-F]{0,6}$/.test(next)) {
      onChange(next.toUpperCase());
    }
  };

  return (
    <div style={stackStyle(6)}>
      <div style={stackStyle(4)}>
        <Text variant="bodyMd" fontWeight="medium">
          {label}
        </Text>
        <Text as="p" tone="subdued" variant="bodySm">
          {description}
        </Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          style={{
            width: 48,
            height: 36,
            border: '1px solid var(--p-color-border-subdued)',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer'
          }}
        />
        <input
          value={value}
          onChange={handleTextChange}
          maxLength={7}
          style={{
            width: 110,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--p-color-border-subdued)',
            fontFamily: 'monospace',
            fontSize: 13
          }}
        />
      </div>
    </div>
  );
}

function TemplateCard({ template, selected, onSelect, label, description }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      style={{
        textAlign: 'left',
        borderRadius: 12,
        border: selected ? '2px solid var(--p-color-border-highlight)' : '1px solid var(--p-color-border-subdued)',
        padding: '18px 20px',
        background: '#fff',
        boxShadow: selected ? '0 0 0 1px rgba(37, 99, 235, 0.15)' : '0 1px 2px rgba(15, 23, 42, 0.04)',
        cursor: 'pointer'
      }}
    >
      <div style={stackStyle(6)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: template.colors.accent
            }}
          />
          <Text variant="bodyMd" fontWeight="semibold">
            {label}
          </Text>
        </div>
        <Text as="p" tone="subdued" variant="bodySm">
          {description}
        </Text>
      </div>
    </button>
  );
}

function PaletteCard({ palette, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(palette.id)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        borderRadius: 10,
        border: '1px solid var(--p-color-border-subdued)',
        background: '#fff',
        cursor: 'pointer'
      }}
    >
      <Text variant="bodyMd" fontWeight="medium">
        {palette.name}
      </Text>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {Object.values(palette.colors).map((color, index) => (
          <div
            key={`${palette.id}-${index}`}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: color,
              border: '1px solid rgba(15, 23, 42, 0.08)'
            }}
          />
        ))}
      </div>
    </button>
  );
}

function createPreviewUrl(shopDomain, previewState) {
  const params = new URLSearchParams();
  if (shopDomain) {
    params.set('shop', shopDomain);
  }
  if (previewState) {
    params.set('state', previewState);
  }
  params.set('preview', 'true');
  return `/preview/widget?${params.toString()}`;
}

function WidgetPreviewFrame({ settings, previewData, previewState, shopDomain, title }) {
  const iframeRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  const previewUrl = useMemo(() => createPreviewUrl(shopDomain, previewState), [shopDomain, previewState]);

  useEffect(() => {
    setIsReady(false);
  }, [previewUrl]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return undefined;

    const handleLoad = () => {
      setIsReady(true);
    };

    iframe.addEventListener('load', handleLoad);

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [previewUrl]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (!event?.data || event.data.type !== 'BIDLY_PREVIEW_HEIGHT') {
        return;
      }

      const nextHeight = Number(event.data.height);
      if (!Number.isFinite(nextHeight) || !iframeRef.current) {
        return;
      }

      const paddedHeight = Math.min(Math.max(nextHeight + 32, 520), 1200);
      iframeRef.current.style.height = `${paddedHeight}px`;
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const themePayload = useMemo(() => ({
    template: settings.template,
    font: settings.font,
    borderRadius: settings.borderRadius,
    boxShadow: settings.boxShadow,
    gradientEnabled: settings.gradientEnabled,
    colors: { ...settings.colors }
  }), [settings]);

  const auctionPayload = useMemo(() => {
    if (!previewData?.auction) {
      return null;
    }

    const auction = previewData.auction;
    return {
      hasAuction: true,
      auctionId: auction.id || 'preview-auction',
      status: previewState,
      currentBid: Number(auction.currentBid ?? 0),
      startingBid: Number(auction.minimumBid ?? auction.currentBid ?? 0),
      reservePrice: auction.reserveMet ? Number(auction.minimumBid ?? 0) : 0,
      endTime: auction.endsAt || null,
      startTime: auction.startsAt || null,
      bidCount: Number(auction.bids ?? 0),
      buyNowPrice: Number(auction.buyNowPrice ?? 0)
    };
  }, [previewData, previewState]);

  useEffect(() => {
    if (!iframeRef.current || !isReady) {
      return;
    }

    const payload = {
      type: 'BIDLY_PREVIEW_THEME_UPDATE',
      payload: {
        theme: themePayload,
        auctionData: auctionPayload,
        state: previewState,
        timestamp: Date.now()
      }
    };

    try {
      iframeRef.current.contentWindow.postMessage(payload, '*');
    } catch (error) {
      console.warn('Bidly: Failed to send preview update message', error);
    }
  }, [themePayload, auctionPayload, previewState, isReady]);

  return (
    <iframe
      ref={iframeRef}
      key={previewUrl}
      title={title}
      src={previewUrl}
      style={{
        width: '100%',
        maxWidth: 460,
        height: 680,
        border: '1px solid var(--p-color-border-subdued)',
        borderRadius: 16,
        background: '#f4f6f8'
      }}
    />
  );
}

const WidgetCustomizationSettings = () => {
  const i18n = useAdminI18n();
  const {
    loading,
    saving,
    error,
    settings,
    meta,
    previewState,
    previewData,
    toast,
    setToast,
    dirty,
    updateField,
    updateColor,
    applyTemplate,
    applyPalette,
    toggleGradient,
    resetToDefaults,
    resetToOriginal,
    save,
    loadPreview,
    shopDomain,
    planGate
  } = useCustomizationSettings('widget');

  const navigate = useNavigate();
  const location = useLocation();
  const search = location.search || '';
  const goToPlans = () => navigate(`/plans${search}`);
  const colorFields = useMemo(
    () =>
      COLOR_FIELDS.map((key) => ({
        key,
        label: i18n.translate(`admin.widget.colors.${key}.label`),
        description: i18n.translate(`admin.widget.colors.${key}.description`)
      })),
    [i18n]
  );
  const gradientFields = useMemo(
    () =>
      GRADIENT_FIELDS.map((key) => ({
        key,
        label: i18n.translate(`admin.widget.gradient.${key}.label`),
        description: i18n.translate(`admin.widget.gradient.${key}.description`)
      })),
    [i18n]
  );
  const previewOptions = useMemo(
    () => [
      { label: i18n.translate('admin.widget.previewStates.active'), value: 'active' },
      { label: i18n.translate('admin.widget.previewStates.pending'), value: 'pending' },
      { label: i18n.translate('admin.widget.previewStates.ended'), value: 'ended' }
    ],
    [i18n]
  );

  if (planGate) {
    const gateMessage =
      planGate.message && !/widget customization requires the pro plan/i.test(planGate.message)
        ? planGate.message
        : i18n.translate('admin.widget.planGate.defaultMessage');
    return (
      <Page
        title={i18n.translate('admin.widget.page.title')}
        subtitle={i18n.translate('admin.widget.planGate.subtitle')}
        backAction={{
          content: i18n.translate('admin.common.back'),
          onAction: () => navigate(-1)
        }}
      >
        <Layout>
          <Layout.Section>
            <Banner
              tone="info"
              title={i18n.translate('admin.widget.planGate.bannerTitle')}
              action={{
                content: i18n.translate('admin.common.viewPlans'),
                onAction: goToPlans
              }}
            >
              <p>{gateMessage}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (loading || !meta) {
    return (
      <Page
        title={i18n.translate('admin.widget.page.title')}
        backAction={{
          content: i18n.translate('admin.common.back'),
          onAction: () => navigate(-1)
        }}
      >
        <div style={{ padding: 64, display: 'flex', justifyContent: 'center' }}>
          <Spinner accessibilityLabel={i18n.translate('admin.widget.status.loading')} size="large" />
        </div>
      </Page>
    );
  }

  return (
    <Page
        fullWidth
        title={i18n.translate('admin.widget.page.title')}
        subtitle={i18n.translate('admin.widget.page.subtitle')}
        backAction={{
          content: i18n.translate('admin.common.back'),
          onAction: () => navigate(-1)
        }}
        primaryAction={{
          content: i18n.translate('admin.widget.actions.save'),
          onAction: save,
          loading: saving,
          disabled: saving || !dirty
        }}
        secondaryActions={[
          {
            content: i18n.translate('admin.widget.actions.resetSaved'),
            onAction: resetToOriginal,
            disabled: saving || !dirty
          },
          {
            content: i18n.translate('admin.widget.actions.resetDefaults'),
            onAction: resetToDefaults,
            destructive: false,
            disabled: saving
          }
        ]}
      >
        {toast && (
          <div style={{ marginBottom: 16 }}>
            <Banner tone={toast.status === 'success' ? 'success' : 'critical'} onDismiss={() => setToast(null)}>
              <p>{toast.message}</p>
            </Banner>
          </div>
        )}
        <style>{`
          .widget-customization-grid {
            width: 100%;
            max-width: 1600px;
            margin: 0 auto;
            display: grid;
            gap: 32px;
            grid-template-columns: 1fr;
          }
          @media (min-width: 1280px) {
            .widget-customization-grid {
              grid-template-columns: 1fr 500px;
              align-items: flex-start;
            }
          }
          .widget-customization-grid__preview {
            position: relative;
          }
          @media (min-width: 1280px) {
            .widget-customization-grid__preview {
              position: sticky;
              top: 80px;
            }
          }
          .widget-customization-grid__previewCard {
            width: 100%;
            max-width: 500px;
            margin-left: auto;
            margin-right: auto;
            border-radius: 26px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
          }
          .widget-customization-grid__previewBody {
            padding: 0;
          }
        `}</style>
        <div className="widget-customization-grid">
          <div className="widget-customization-grid__controls">
            {error && (
              <Banner title={i18n.translate('admin.widget.errors.saveFailed')} tone="critical">
                <p>{error}</p>
              </Banner>
            )}

            <Card>
              <div style={stackStyle(20)}>
                <div style={stackStyle(6)}>
                  <Text variant="headingMd">{i18n.translate('admin.widget.sections.templates.title')}</Text>
                  <Text tone="subdued">
                    {i18n.translate('admin.widget.sections.templates.description')}
                  </Text>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gap: 16,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'
                  }}
                >
                  {meta.templates.map((template) => {
                    const label = i18n.translate('admin.widget.sections.templates.cardLabel', {
                      id: template.id,
                      name: template.name
                    });
                    return (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        label={label}
                        description={template.description}
                        selected={settings.template === template.id}
                        onSelect={applyTemplate}
                      />
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card>
              <div style={stackStyle(16)}>
                <Text variant="headingMd">{i18n.translate('admin.widget.sections.typography.title')}</Text>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <Select
                    label={i18n.translate('admin.widget.sections.typography.fontLabel')}
                    labelHidden
                    options={meta.fonts.map((font) => ({ label: font, value: font }))}
                    value={settings.font}
                    onChange={(value) => updateField('font', value)}
                  />
                  <Select
                    label={i18n.translate('admin.widget.sections.typography.radiusLabel')}
                    labelHidden
                    options={meta.borderRadius.map((radius) => ({ label: `${radius}px`, value: radius }))}
                    value={settings.borderRadius}
                    onChange={(value) => updateField('borderRadius', Number(value))}
                  />
                  <Select
                    label={i18n.translate('admin.widget.sections.typography.shadowLabel')}
                    labelHidden
                    options={meta.boxShadows.map((shadow) => ({
                      label: shadow.charAt(0).toUpperCase() + shadow.slice(1),
                      value: shadow
                    }))}
                    value={settings.boxShadow}
                    onChange={(value) => updateField('boxShadow', value)}
                  />
                </div>
              </div>
            </Card>

            <Card>
              <div style={stackStyle(16)}>
                <div style={stackStyle(4)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text variant="headingMd">{i18n.translate('admin.widget.sections.gradient.title')}</Text>
                    <Button size="slim" onClick={toggleGradient}>
                      {settings.gradientEnabled
                        ? i18n.translate('admin.widget.sections.gradient.disable')
                        : i18n.translate('admin.widget.sections.gradient.enable')}
                    </Button>
                  </div>
                  <Text tone="subdued">
                    {i18n.translate('admin.widget.sections.gradient.description')}
                  </Text>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gap: 16,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
                  }}
                >
                  {gradientFields.map((field) => (
                    <ColorSwatchInput
                      key={field.key}
                      label={field.label}
                      description={field.description}
                      value={settings.colors[field.key]}
                      onChange={(value) => updateColor(field.key, value)}
                    />
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <div style={stackStyle(16)}>
                <div style={stackStyle(4)}>
                  <Text variant="headingMd">{i18n.translate('admin.widget.sections.colors.title')}</Text>
                  <Text tone="subdued">
                    {i18n.translate('admin.widget.sections.colors.description')}
                  </Text>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gap: 16,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
                  }}
                >
                  {colorFields.map((field) => (
                    <ColorSwatchInput
                      key={field.key}
                      label={field.label}
                      description={field.description}
                      value={settings.colors[field.key]}
                      onChange={(value) => updateColor(field.key, value)}
                    />
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div className="widget-customization-grid__preview">
            <Card
              title={i18n.translate('admin.widget.previewCard.title')}
              sectioned
              className="widget-customization-grid__previewCard"
            >
              <div className="widget-customization-grid__previewBody">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1.25rem', flexWrap: 'wrap' }}>
                  <Text variant="headingMd">{i18n.translate('admin.widget.previewCard.title')}</Text>
                  <Select
                    label={i18n.translate('admin.widget.previewCard.stateLabel')}
                    labelHidden
                    options={previewOptions}
                    value={previewState}
                    onChange={(value) => loadPreview(value)}
                  />
                </div>
                <div style={{ padding: '0 1.5rem 1.5rem' }}>
                  <Text tone="subdued">
                    {i18n.translate('admin.widget.previewCard.description')}
                  </Text>
                </div>
                <div style={{ padding: '0 1.5rem 1.75rem' }}>
                  <WidgetPreviewFrame
                    settings={settings}
                    previewData={previewData}
                    previewState={previewState}
                    shopDomain={shopDomain}
                    title={i18n.translate('admin.widget.previewCard.iframeTitle')}
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Page>
  );
};

export default WidgetCustomizationSettings;
