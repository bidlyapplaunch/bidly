import React, { useEffect, useMemo, useState } from 'react';
import { Frame, Page, Layout, Card, Text, Banner, Button, InlineGrid, BlockStack, Select, Spinner, Toast } from '@shopify/polaris';
import { useLocation, useNavigate } from 'react-router-dom';
import { marketplaceCustomizationAPI } from '../services/api';
import { normalizeMarketplaceTheme, DEFAULT_MARKETPLACE_THEME } from '@shared/marketplaceTheme.js';
import MarketplacePreview from './MarketplacePreview.jsx';

const FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter' },
  { label: 'Roboto', value: 'Roboto' },
  { label: 'Poppins', value: 'Poppins' },
  { label: 'Montserrat', value: 'Montserrat' }
];

const TEMPLATE_OPTIONS = [
  { label: 'Classic', value: 'Classic', description: 'Balanced spacing, subtle depth, and rounded corners.' },
  { label: 'Modern', value: 'Modern', description: 'Softer surfaces, deeper shadows, and generous padding.' },
  { label: 'Minimal', value: 'Minimal', description: 'Compact spacing with crisp lines and light shadows.' },
  { label: 'Bold', value: 'Bold', description: 'Large radiuses, dramatic shadows, and pill buttons.' }
];

const COLOR_FIELDS = [
  { key: 'primary', label: 'Primary', description: 'Buttons, actions, and primary highlights.' },
  { key: 'background', label: 'Background', description: 'Marketplace page background.' },
  { key: 'surface', label: 'Surface', description: 'Cards, modals, and sheets.' },
  { key: 'textPrimary', label: 'Primary text', description: 'Headings and main text.' },
  { key: 'textSecondary', label: 'Secondary text', description: 'Muted text, helper copy, and labels.' },
  { key: 'border', label: 'Border', description: 'Card outlines, dividers, and inputs.' },
  { key: 'accent', label: 'Accent', description: 'Timers, stats, and pills.' },
  { key: 'success', label: 'Success', description: 'Positive badges and buy-now confirmations.' },
  { key: 'error', label: 'Error', description: 'Errors, ended states, and blocking toasts.' },
  { key: 'hover', label: 'Hover', description: 'Button hover and focus states.' },
  { key: 'gradient1', label: 'Gradient start', description: 'Hero gradient starting color.' },
  { key: 'gradient2', label: 'Gradient end', description: 'Hero gradient ending color.' }
];

const DEFAULT_CUSTOMIZATION = {
  template: DEFAULT_MARKETPLACE_THEME.template,
  font: DEFAULT_MARKETPLACE_THEME.font,
  colors: { ...DEFAULT_MARKETPLACE_THEME.colors },
  gradientEnabled: DEFAULT_MARKETPLACE_THEME.gradientEnabled
};

const sanitizeHex = (value) => {
  if (!value) return '';
  const upper = value.toUpperCase();
  return upper.startsWith('#') ? upper : `#${upper}`;
};

const normalizeCustomization = (settings = {}) => {
  const normalizedTheme = normalizeMarketplaceTheme({
    template: settings.template || DEFAULT_CUSTOMIZATION.template,
    font: settings.font || DEFAULT_CUSTOMIZATION.font,
    colors: settings.colors || DEFAULT_CUSTOMIZATION.colors,
    gradientEnabled:
      typeof settings.gradientEnabled === 'boolean' ? settings.gradientEnabled : DEFAULT_CUSTOMIZATION.gradientEnabled
  });

  const normalizedColors = Object.entries(normalizedTheme.colors).reduce((acc, [key, value]) => {
    acc[key] = sanitizeHex(value);
    return acc;
  }, {});

  return {
    template: normalizedTheme.template,
    font: normalizedTheme.font,
    colors: normalizedColors,
    gradientEnabled: normalizedTheme.gradientEnabled
  };
};

function ColorInput({ field, value, onChange }) {
  const handleTextChange = (event) => {
    const next = sanitizeHex(event.target.value);
    if (/^#[0-9A-F]{0,6}$/.test(next)) {
      onChange(field.key, next);
    }
  };

  return (
    <BlockStack gap="extraTight">
      <Text variant="bodyMd" fontWeight="medium">
        {field.label}
      </Text>
      <Text variant="bodySm" tone="subdued">
        {field.description}
      </Text>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(field.key, event.target.value.toUpperCase())}
          style={{
            width: 48,
            height: 36,
            borderRadius: 8,
            border: '1px solid var(--p-color-border-subdued)',
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
    </BlockStack>
  );
}

function TemplateSelector({ selected, onSelect }) {
  return (
    <InlineGrid columns={{ xs: 1, sm: 2 }} gap="base">
      {TEMPLATE_OPTIONS.map((template) => (
        <button
          key={template.value}
          type="button"
          onClick={() => onSelect(template.value)}
          style={{
            textAlign: 'left',
            borderRadius: 14,
            border:
              selected === template.value
                ? '2px solid var(--p-color-border-strong)'
                : '1px solid var(--p-color-border-subdued)',
            padding: '18px 20px',
            background: '#fff',
            cursor: 'pointer',
            boxShadow:
              selected === template.value ? '0 6px 16px rgba(15, 23, 42, 0.08)' : '0 1px 2px rgba(15, 23, 42, 0.03)'
          }}
        >
          <BlockStack gap="tight">
            <Text variant="bodyMd" fontWeight="semibold">
              {template.label}
            </Text>
            <Text variant="bodySm" tone="subdued">
              {template.description}
            </Text>
          </BlockStack>
        </button>
      ))}
    </InlineGrid>
  );
}

const MarketplaceCustomizationSettings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [customization, setCustomization] = useState(DEFAULT_CUSTOMIZATION);
  const [original, setOriginal] = useState(DEFAULT_CUSTOMIZATION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const response = await marketplaceCustomizationAPI.getSettings();
        if (response.success && response.customization) {
          const normalized = normalizeCustomization(response.customization);
          setCustomization(normalized);
          setOriginal(normalized);
          setError('');
        } else {
          throw new Error(response.message || 'Failed to load marketplace customization');
        }
      } catch (err) {
        console.error('Failed to load marketplace customization', err);
        setError(err.message || 'Failed to load marketplace customization');
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const handleTemplateSelect = (value) => {
    setCustomization((prev) => ({ ...prev, template: value }));
  };

  const handleFontChange = (value) => {
    setCustomization((prev) => ({ ...prev, font: value }));
  };

  const handleColorChange = (key, value) => {
    if (!/^#[0-9A-F]{6}$/.test(value)) {
      return;
    }
    setCustomization((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        [key]: value
      }
    }));
  };

  const toggleGradient = () => {
    setCustomization((prev) => ({
      ...prev,
      gradientEnabled: !prev.gradientEnabled
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      const payload = {
        template: customization.template,
        font: customization.font,
        colors: customization.colors,
        gradientEnabled: customization.gradientEnabled
      };
      const response = await marketplaceCustomizationAPI.saveSettings(payload);
      if (response.success && response.customization) {
        const normalized = normalizeCustomization(response.customization);
        setCustomization(normalized);
        setOriginal(normalized);
        setToast({ content: 'Marketplace theme saved', tone: 'success' });
      } else {
        throw new Error(response.message || 'Failed to save marketplace customization');
      }
    } catch (err) {
      console.error('Failed to save marketplace customization', err);
      setError(err.message || 'Failed to save marketplace customization');
      setToast({ content: err.message || 'Failed to save marketplace customization', tone: 'critical' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setCustomization(original);
  };

  const resetToDefaults = () => {
    setCustomization(DEFAULT_CUSTOMIZATION);
  };

  const dirty = useMemo(() => JSON.stringify(customization) !== JSON.stringify(original), [customization, original]);

  if (loading) {
    return (
      <Frame>
        <Page title="Marketplace customization" backAction={{ content: 'Back', onAction: () => navigate(-1) }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
            <Spinner size="large" />
          </div>
        </Page>
      </Frame>
    );
  }

  return (
    <Frame>
      {toast && (
        <Toast
          content={toast.content}
          tone={toast.tone}
          onDismiss={() => setToast(null)}
        />
      )}
      <Page
        title="Marketplace customization"
        subtitle="Control the typography, template, and color system for the public auction marketplace."
        backAction={{ content: 'Back', onAction: () => navigate(-1) }}
        primaryAction={{
          content: 'Save changes',
          onAction: handleSave,
          loading: saving,
          disabled: !dirty || saving
        }}
        secondaryActions={[
          {
            content: 'Reset to applied',
            onAction: handleReset,
            disabled: !dirty || saving
          },
          {
            content: 'Restore defaults',
            onAction: resetToDefaults,
            disabled: saving
          }
        ]}
      >
        <Layout>
          <Layout.Section>
            {error && (
              <Banner tone="critical" title="Marketplace customization unavailable">
                <p>{error}</p>
              </Banner>
            )}
            <Card title="Design foundation" sectioned>
              <BlockStack gap="loose">
                <div>
                  <Text variant="headingSm" fontWeight="semibold">
                    Choose template
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    Templates control spacing, radius, and depth. They apply instantly to every screen in the customer flow.
                  </Text>
                </div>
                <TemplateSelector selected={customization.template} onSelect={handleTemplateSelect} />
                <div>
                  <Select
                    label="Font family"
                    options={FONT_OPTIONS}
                    value={customization.font}
                    onChange={handleFontChange}
                  />
                </div>
                <div>
                  <Button onClick={toggleGradient} variant="secondary">
                    {customization.gradientEnabled ? 'Disable gradient background' : 'Enable gradient background'}
                  </Button>
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card title="Color palette" sectioned>
              <BlockStack gap="base">
                <Text tone="subdued" variant="bodySm">
                  Every UI element in the marketplace references these tokens. Update them to match your storefront.
                </Text>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="loose">
                  {COLOR_FIELDS.map((field) => (
                    <ColorInput
                      key={field.key}
                      field={field}
                      value={customization.colors[field.key]}
                      onChange={handleColorChange}
                    />
                  ))}
                </InlineGrid>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card title="Live preview" sectioned>
              <MarketplacePreview customization={customization} />
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
};

export default MarketplaceCustomizationSettings;
