import React, { useMemo } from 'react';
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Select,
  InlineGrid,
  InlineStack,
  BlockStack,
  Spinner,
  Banner,
  Toast
} from '@shopify/polaris';
import { useCustomizationSettings } from '../hooks/useCustomizationSettings';

const COLOR_FIELDS = [
  { key: 'accent', label: 'Accent color', description: 'Highlights for prices and active states.' },
  { key: 'text', label: 'Primary text', description: 'Default text across the marketplace.' },
  { key: 'button_bg', label: 'Button background', description: 'Marketplace CTA background color.' },
  { key: 'button_text', label: 'Button text', description: 'Text color used on marketplace buttons.' },
  { key: 'button_hover', label: 'Button hover', description: 'CTA background when hovered.' },
  { key: 'border', label: 'Border & divider', description: 'Card outlines and subtle separators.' }
];

const BACKGROUND_FIELDS = [
  { key: 'bg_solid', label: 'Surface background', description: 'Default card background color.' },
  { key: 'bg_gradient_start', label: 'Hero gradient start', description: 'Starting color for feature gradient.' },
  { key: 'bg_gradient_end', label: 'Hero gradient end', description: 'Ending color for feature gradient.' }
];

function ColorSwatchInput({ label, description, value, onChange }) {
  const handleChange = (event) => {
    const nextValue = event.target.value.toUpperCase();
    if (/^#[0-9A-F]{0,6}$/.test(nextValue)) {
      onChange(nextValue);
    }
  };

  return (
    <BlockStack gap="extraTight" inlineAlign="start">
      <Text variant="bodyMd" fontWeight="medium">
        {label}
      </Text>
      <Text variant="bodySm" tone="subdued">
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
          onChange={handleChange}
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
        boxShadow: selected ? '0 0 0 1px rgba(37, 99, 235, 0.12)' : '0 1px 2px rgba(15, 23, 42, 0.04)',
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
        <Text variant="bodySm" tone="subdued">
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
        {Object.values(palette.colors).map((color) => (
          <div
            key={color}
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

function MarketplacePreview({ settings, previewData, boxShadowValue }) {
  const previewStyle = useMemo(
    () => ({
      '--preview-font': `'${settings.font}', Poppins, Inter, Roboto, Lato, sans-serif`,
      '--preview-text': settings.colors.text,
      '--preview-accent': settings.colors.accent,
      '--preview-button-bg': settings.colors.button_bg,
      '--preview-button-text': settings.colors.button_text,
      '--preview-border': settings.colors.border,
      '--preview-surface': settings.colors.bg_solid,
      '--preview-shadow': boxShadowValue
    }),
    [settings, boxShadowValue]
  );

  if (!previewData?.marketplace) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
        Preparing preview…
      </div>
    );
  }

  const { featured, auctions } = previewData.marketplace;

  return (
    <div
      style={{
        ...previewStyle,
        fontFamily: 'var(--preview-font)',
        display: 'grid',
        gap: 24
      }}
    >
      <div
        style={{
          borderRadius: 16,
          border: `1px solid var(--preview-border)`,
          background: `linear-gradient(135deg, ${settings.colors.bg_gradient_start}, ${settings.colors.bg_gradient_end})`,
          boxShadow: 'var(--preview-shadow)',
          padding: 24,
          color: '#fff'
        }}
      >
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="tight">
            <Text variant="headingMd" tone="success">
              Featured auction
            </Text>
            <Text variant="headingLg" as="h3">
              {featured.productTitle}
            </Text>
            <Text as="p">Current bid: ${featured.currentBid.toFixed(2)}</Text>
          </BlockStack>
          <Button tone="success">Place bid</Button>
        </InlineStack>
      </div>

      <InlineGrid columns={{ xs: 1, md: 3 }} gap="tight">
        {auctions.map((auction) => (
          <div
            key={auction.id}
            style={{
              background: 'var(--preview-surface)',
              borderRadius: settings.borderRadius,
              border: `1px solid var(--preview-border)`,
              padding: 18,
              boxShadow: 'var(--preview-shadow)'
            }}
          >
            <BlockStack gap="tight">
              <InlineStack align="space-between">
                <Text variant="bodySm" tone="subdued">
                  {auction.status.toUpperCase()}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Bids: {auction.bids}
                </Text>
              </InlineStack>
              <Text variant="headingSm">{auction.productTitle}</Text>
              <Text tone="subdued" variant="bodySm">
                Current bid — ${auction.currentBid.toFixed(2)}
              </Text>
              <Button
                tone={auction.status === 'pending' ? 'primary' : auction.status === 'ended' ? 'critical' : 'success'}
                disabled={auction.status === 'ended'}
              >
                {auction.status === 'ended' ? 'Auction ended' : 'Place bid'}
              </Button>
            </BlockStack>
          </div>
        ))}
      </InlineGrid>
    </div>
  );
}

const MarketplaceCustomizationSettings = () => {
  const {
    loading,
    saving,
    error,
    settings,
    meta,
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
    save
  } = useCustomizationSettings('marketplace');

  const shadowValue = useMemo(
    () => meta?.boxShadowValues?.[settings.boxShadow] || 'none',
    [meta, settings.boxShadow]
  );

  if (loading || !meta) {
    return (
      <Page title="Marketplace customization">
        <div style={{ padding: 64, display: 'flex', justifyContent: 'center' }}>
          <Spinner size="large" />
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Marketplace customization"
      subtitle="Control the marketplace landing experience without editing code."
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
          disabled: saving
        }
      ]}
    >
      {toast && (
        <Toast
          content={toast.message}
          tone={toast.status === 'success' ? 'success' : 'critical'}
          onDismiss={() => setToast(null)}
        />
      )}
      {error && (
        <Layout.Section>
          <Banner title="We couldn’t save the marketplace settings" tone="critical">
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
                  Start from a preset layout optimised for different aesthetics. Templates set fonts, spacing, and base colors.
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
                <Text variant="headingMd">Color palettes</Text>
                <Text tone="subdued">Apply a curated palette for the marketplace at once.</Text>
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
              <Text variant="headingMd">Typography & depth</Text>
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
                  label="Shadow"
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
              <InlineStack gap="tight" blockAlign="center">
                <Text variant="headingMd">Background & gradient</Text>
                <Button size="slim" onClick={toggleGradient}>
                  {settings.gradientEnabled ? 'Disable gradient' : 'Enable gradient'}
                </Button>
              </InlineStack>
              <InlineGrid columns={{ xs: 1, md: 3 }} gap="loose">
                {BACKGROUND_FIELDS.map((field) => (
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
              <Text variant="headingMd">Fine tune colors</Text>
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
              <div>
                <Text variant="headingMd">Live marketplace preview</Text>
                <Text tone="subdued">
                  Shows how featured auctions and list cards will appear with the current settings.
                </Text>
              </div>
              <MarketplacePreview settings={settings} previewData={previewData} boxShadowValue={shadowValue} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default MarketplaceCustomizationSettings;
