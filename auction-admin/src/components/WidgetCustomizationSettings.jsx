import React, { useMemo } from 'react';
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

function WidgetPreviewFrame({ settings, previewData, boxShadowValue }) {
  const { auction } = previewData || {};
  const gradientEnable = settings.gradientEnabled ? 1 : 0;
  const fontStack = `'${settings.font}', Poppins, Inter, Roboto, Lato, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

  const srcDoc = useMemo(() => {
    if (!auction) {
      return '<html><body style="font-family: sans-serif; color: #6b7280; padding: 24px;">Preview loading…</body></html>';
    }

    const cssVariables = `
      :root {
        --bidly-font-family: ${fontStack};
        --bidly-text-color: ${settings.colors.text};
        --bidly-accent-color: ${settings.colors.accent};
        --bidly-bg-color: ${settings.colors.bg_solid};
        --bidly-bg-gradient-start: ${settings.colors.bg_gradient_start};
        --bidly-bg-gradient-end: ${settings.colors.bg_gradient_end};
        --bidly-bg-gradient-enable: ${gradientEnable};
        --bidly-button-bg: ${settings.colors.button_bg};
        --bidly-button-hover-bg: ${settings.colors.button_hover};
        --bidly-button-text: ${settings.colors.button_text};
        --bidly-border-color: ${settings.colors.border};
        --bidly-border-radius: ${settings.borderRadius}px;
        --bidly-box-shadow: ${boxShadowValue};
      }
    `;

    const widgetHTML = `
      <div class="bidly-widget-root">
        <div class="bidly-widget-header">
          <div class="bidly-widget-header-left">
            <span class="bidly-widget-pill">Live auction</span>
            <h3 class="bidly-widget-title">${auction.productTitle}</h3>
          </div>
          <div class="bidly-widget-header-right">
            <span class="bidly-widget-participants">👤 256 watchers</span>
          </div>
        </div>

        <div class="bidly-widget-section">
          <div class="bidly-widget-timer-label">Ends in</div>
          <div class="bidly-widget-timer-value">${auction.status === 'pending' ? 'Starts in 02h 30m' : auction.status === 'ended' ? 'Ended' : '06h 12m 47s'}</div>
          <div class="bidly-widget-timer-meta">${auction.status === 'ended' ? 'Auction finished' : 'Auto extends if bids land in last 60 seconds'}</div>
        </div>

        <div class="bidly-widget-pricing">
          <div class="bidly-price-card">
            <div class="bidly-price-label">Current bid</div>
            <div class="bidly-price-value">$${auction.currentBid.toFixed(2)}</div>
          </div>
          <div class="bidly-price-card">
            <div class="bidly-price-label">Minimum bid</div>
            <div class="bidly-price-value">$${auction.minimumBid.toFixed(2)}</div>
          </div>
          <div class="bidly-price-card">
            <div class="bidly-price-label">Bid count</div>
            <div class="bidly-price-value">${auction.bids}</div>
          </div>
        </div>

        <div class="bidly-widget-input">
          <input class="bidly-widget-input-field" placeholder="Enter bid ≥ $${auction.minimumBid.toFixed(2)}" />
          <button class="bidly-widget-primary-button">${auction.status === 'ended' ? 'Auction ended' : 'Place bid'}</button>
        </div>

        <div class="bidly-widget-footer">
          <span class="bidly-widget-footer-link">View bid history</span>
          <span class="bidly-widget-footer-link">Auction rules</span>
        </div>
      </div>
    `;

    const styles = `
      ${cssVariables}
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lato:wght@400;700&family=Poppins:wght@500;600;700&family=Roboto:wght@400;500;700&display=swap');
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: #f4f6f8;
        padding: 24px;
      }
      .bidly-widget-root {
        font-family: var(--bidly-font-family);
        background: var(--bidly-bg-color);
        border-radius: var(--bidly-border-radius);
        box-shadow: var(--bidly-box-shadow);
        color: var(--bidly-text-color);
        border: 1px solid var(--bidly-border-color);
        overflow: hidden;
        max-width: 400px;
        margin: 0 auto;
      }
      .bidly-widget-header {
        padding: 20px 24px;
        background: linear-gradient(135deg, var(--bidly-bg-gradient-start), var(--bidly-bg-gradient-end));
        position: relative;
      }
      .bidly-widget-root[data-gradient='0'] .bidly-widget-header {
        background: var(--bidly-bg-color);
      }
      .bidly-widget-title {
        margin: 8px 0 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--bidly-button-text);
      }
      .bidly-widget-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.18);
        color: var(--bidly-button-text);
        border-radius: 999px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .bidly-widget-participants {
        color: rgba(255, 255, 255, 0.76);
        font-size: 13px;
      }
      .bidly-widget-section {
        padding: 20px 24px;
        display: grid;
        gap: 6px;
      }
      .bidly-widget-timer-label {
        font-size: 13px;
        text-transform: uppercase;
        color: rgba(15, 23, 42, 0.5);
      }
      .bidly-widget-timer-value {
        font-size: 24px;
        font-weight: 600;
        color: var(--bidly-accent-color);
      }
      .bidly-widget-timer-meta {
        font-size: 12px;
        color: rgba(15, 23, 42, 0.45);
      }
      .bidly-widget-pricing {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        padding: 0 24px 20px;
      }
      .bidly-price-card {
        background: rgba(148, 163, 184, 0.07);
        border-radius: calc(var(--bidly-border-radius) - 6px);
        padding: 12px;
        border: 1px solid rgba(148, 163, 184, 0.16);
      }
      .bidly-price-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(15, 23, 42, 0.5);
      }
      .bidly-price-value {
        margin-top: 6px;
        font-size: 16px;
        font-weight: 600;
        color: var(--bidly-accent-color);
      }
      .bidly-widget-input {
        display: flex;
        gap: 12px;
        padding: 0 24px 20px;
      }
      .bidly-widget-input-field {
        flex: 1;
        border-radius: calc(var(--bidly-border-radius) - 4px);
        border: 1px solid var(--bidly-border-color);
        padding: 14px 16px;
        font-size: 14px;
        font-family: inherit;
        background: #fff;
        color: var(--bidly-text-color);
      }
      .bidly-widget-primary-button {
        border: none;
        border-radius: calc(var(--bidly-border-radius) - 4px);
        padding: 14px 20px;
        background: var(--bidly-button-bg);
        color: var(--bidly-button-text);
        font-weight: 600;
        cursor: pointer;
        transition: background 120ms ease;
      }
      .bidly-widget-primary-button:hover {
        background: var(--bidly-button-hover-bg);
      }
      .bidly-widget-footer {
        padding: 16px 24px 24px;
        display: flex;
        justify-content: space-between;
        border-top: 1px solid rgba(148, 163, 184, 0.18);
        font-size: 13px;
        color: rgba(15, 23, 42, 0.55);
      }
      .bidly-widget-footer-link {
        cursor: pointer;
      }
    `;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>${styles}</style>
        </head>
        <body>
          <div class="bidly-widget-preview" style="display:flex;justify-content:center;">
            ${widgetHTML}
          </div>
          <script>
            document.querySelector('.bidly-widget-root').dataset.gradient = '${gradientEnable}';
          </script>
        </body>
      </html>
    `;
  }, [auction, boxShadowValue, gradientEnable, settings.colors, settings.font]);

  return (
    <iframe
      title="Widget customization preview"
      style={{
        width: '100%',
        maxWidth: 460,
        height: 520,
        border: '1px solid var(--p-color-border-subdued)',
        borderRadius: 16,
        background: '#f4f6f8'
      }}
      srcDoc={srcDoc}
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
    loadPreview
  } = useCustomizationSettings('widget');

  const shadowValue = useMemo(() => meta?.boxShadowValues?.[settings.boxShadow] || 'none', [meta, settings.boxShadow]);

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
              <WidgetPreviewFrame settings={settings} previewData={previewData} boxShadowValue={shadowValue} />
            </BlockStack>
          </Card>
        </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
};

export default WidgetCustomizationSettings;
