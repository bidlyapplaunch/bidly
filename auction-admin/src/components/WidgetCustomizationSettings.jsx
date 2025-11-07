import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  InlineGrid,
  InlineStack,
  BlockStack,
  Banner,
  Spinner,
  Select,
  Toast,
  Frame
} from '@shopify/polaris';
import { useCustomizationSettings } from '../hooks/useCustomizationSettings';

const COLOR_FIELDS = [
  { key: 'accent', label: 'Accent color', description: 'Applied to prices and primary highlights.' },
  { key: 'text', label: 'Primary text', description: 'Default text color for widget content.' },
  { key: 'button_bg', label: 'Button background', description: 'Primary button background color.' },
  { key: 'button_hover', label: 'Button hover', description: 'Background color on hover focus.' },
  { key: 'button_text', label: 'Button text', description: 'Text color for primary buttons.' },
  { key: 'border', label: 'Border color', description: 'Input borders, cards, and separators.' }
];

const GRADIENT_FIELDS = [
  { key: 'bg_solid', label: 'Solid background', description: 'Used when gradient is disabled.' },
  { key: 'bg_gradient_start', label: 'Gradient start', description: 'Starting color of the header gradient.' },
  { key: 'bg_gradient_end', label: 'Gradient end', description: 'Ending color of the header gradient.' }
];

function ColorSwatchInput({ label, description, value, onChange }) {
  const handleTextChange = (event) => {
    const next = event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`;
    if (/^#[0-9a-fA-F]{0,6}$/.test(next)) {
      onChange(next.toUpperCase());
    }
  };

  return (
    <BlockStack gap="extraTight" inlineAlign="start">
      <Text variant="bodyMd" fontWeight="medium">
        {label}
      </Text>
      <Text as="p" tone="subdued" variant="bodySm">
        {description}
      </Text>
      <InlineStack gap="tight" blockAlign="center">
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
      </InlineStack>
    </BlockStack>
  );
}

function TemplateCard({ template, selected, onSelect }) {
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
      <BlockStack gap="tight">
        <InlineStack gap="tight" blockAlign="center">
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: template.colors.accent
            }}
          />
          <Text variant="bodyMd" fontWeight="semibold">
            Template {template.id} · {template.name}
          </Text>
        </InlineStack>
        <Text as="p" tone="subdued" variant="bodySm">
          {template.description}
        </Text>
      </BlockStack>
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
      <InlineStack gap="extraTight">
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
      </InlineStack>
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

function WidgetPreviewFrame({ settings, previewData, previewState, shopDomain }) {
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
      title="Widget customization preview"
      src={previewUrl}
      style={{
        width: '100%',
        maxWidth: 460,
        height: 520,
        border: '1px solid var(--p-color-border-subdued)',
        borderRadius: 16,
        background: '#f4f6f8'
      }}
    />
  );
}

const WidgetCustomizationSettings = () => {
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
    shopDomain
  } = useCustomizationSettings('widget');

  if (loading || !meta) {
    return (
      <Frame>
        <Page title="Widget customization">
          <div style={{ padding: 64, display: 'flex', justifyContent: 'center' }}>
            <Spinner accessibilityLabel="Loading customization settings" size="large" />
          </div>
        </Page>
      </Frame>
    );
  }

  const previewOptions = [
    { label: 'Active auction', value: 'active' },
    { label: 'Pending auction', value: 'pending' },
    { label: 'Ended auction', value: 'ended' }
  ];

  return (
    <Frame>
      {toast && (
        <Toast
          content={toast.message}
          tone={toast.status === 'success' ? 'success' : 'critical'}
          onDismiss={() => setToast(null)}
        />
      )}
      <Page
        title="Widget customization"
        subtitle="Control how the Bidly widget appears on your product pages without touching code."
        primaryAction={{
          content: 'Save changes',
          onAction: save,
          loading: saving,
          disabled: saving || !dirty
        }}
        secondaryActions={[
          {
            content: 'Reset to saved',
            onAction: resetToOriginal,
            disabled: saving || !dirty
          },
          {
            content: 'Reset to defaults',
            onAction: resetToDefaults,
            destructive: false,
            disabled: saving
          }
        ]}
      >
        {error && (
          <Layout.Section>
            <Banner title="We couldn’t save the widget settings" tone="critical">
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="loose">
              <div>
                <Text variant="headingMd">Templates</Text>
                <Text tone="subdued">
                  Start from a professionally designed preset. You can still adjust individual settings after selecting a template.
                </Text>
              </div>
              <InlineGrid columns={{ xs: 1, sm: 2 }} gap="tight">
                {meta.templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    selected={settings.template === template.id}
                    onSelect={applyTemplate}
                  />
                ))}
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="loose">
              <div>
                <Text variant="headingMd">Color palette</Text>
                <Text tone="subdued">
                  Apply a curated palette to update background, text, and accent colors together. Afterwards you can fine-tune individual values.
                </Text>
              </div>
              <InlineGrid columns={{ xs: 1, sm: 2 }} gap="tight">
                {meta.palettes.map((palette) => (
                  <PaletteCard key={palette.id} palette={palette} onSelect={applyPalette} />
                ))}
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="loose">
              <div>
                <Text variant="headingMd">Typography & layout</Text>
              </div>
              <InlineStack gap="loose">
                <Select
                  label="Font family"
                  labelHidden
                  options={meta.fonts.map((font) => ({ label: font, value: font }))}
                  value={settings.font}
                  onChange={(value) => updateField('font', value)}
                />
                <Select
                  label="Border radius"
                  labelHidden
                  options={meta.borderRadius.map((radius) => ({ label: `${radius}px`, value: radius }))}
                  value={settings.borderRadius}
                  onChange={(value) => updateField('borderRadius', Number(value))}
                />
                <Select
                  label="Depth / shadow"
                  labelHidden
                  options={meta.boxShadows.map((shadow) => ({
                    label: shadow.charAt(0).toUpperCase() + shadow.slice(1),
                    value: shadow
                  }))}
                  value={settings.boxShadow}
                  onChange={(value) => updateField('boxShadow', value)}
                />
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="loose">
              <div>
                <InlineStack gap="tight" blockAlign="center">
                  <Text variant="headingMd">Gradient & background</Text>
                  <Button size="slim" onClick={toggleGradient}>
                    {settings.gradientEnabled ? 'Disable gradient' : 'Enable gradient'}
                  </Button>
                </InlineStack>
                <Text tone="subdued">
                  Choose the gradient colors for the widget header or switch to a flat background.
                </Text>
              </div>
              <InlineGrid columns={{ xs: 1, md: 3 }} gap="loose">
                {GRADIENT_FIELDS.map((field) => (
                  <ColorSwatchInput
                    key={field.key}
                    label={field.label}
                    description={field.description}
                    value={settings.colors[field.key]}
                    onChange={(value) => updateColor(field.key, value)}
                  />
                ))}
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="loose">
              <div>
                <Text variant="headingMd">Fine tune colors</Text>
                <Text tone="subdued">
                  Adjust individual tokens for text, buttons, and borders. All colors support hex values only.
                </Text>
              </div>
              <InlineGrid columns={{ xs: 1, md: 3 }} gap="loose">
                {COLOR_FIELDS.map((field) => (
                  <ColorSwatchInput
                    key={field.key}
                    label={field.label}
                    description={field.description}
                    value={settings.colors[field.key]}
                    onChange={(value) => updateColor(field.key, value)}
                  />
                ))}
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="loose">
              <InlineStack gap="tight" blockAlign="center">
                <Text variant="headingMd">Live widget preview</Text>
                <Select
                  label="Preview state"
                  labelHidden
                  options={previewOptions}
                  value={previewState}
                  onChange={(value) => loadPreview(value)}
                />
              </InlineStack>
              <Text tone="subdued">
                Preview updates instantly as you adjust settings. This iframe uses the same markup and tokens as the storefront widget.
              </Text>
              <WidgetPreviewFrame
                settings={settings}
                previewData={previewData}
                previewState={previewState}
                shopDomain={shopDomain}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
};

export default WidgetCustomizationSettings;
