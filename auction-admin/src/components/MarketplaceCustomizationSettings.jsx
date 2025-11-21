import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Page, Layout, Card, Text, Banner, Button, Select, Spinner } from '@shopify/polaris';
import { useLocation, useNavigate } from 'react-router-dom';
import { marketplaceCustomizationAPI, billingAPI } from '../services/api';
import { normalizeMarketplaceTheme, DEFAULT_MARKETPLACE_THEME } from '@shared/marketplaceTheme.js';
import MarketplacePreview from './MarketplacePreview.jsx';
import { useAppBridgeActions } from '../hooks/useAppBridge';
import authService from '../services/auth';
import useAdminI18n from '../hooks/useAdminI18n';

const FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter' },
  { label: 'Roboto', value: 'Roboto' },
  { label: 'Poppins', value: 'Poppins' },
  { label: 'Montserrat', value: 'Montserrat' }
];

const TEMPLATE_OPTIONS = [
  { value: 'Classic', key: 'classic' },
  { value: 'Modern', key: 'modern' },
  { value: 'Minimal', key: 'minimal' },
  { value: 'Bold', key: 'bold' }
];

const COLOR_FIELDS = [
  'primary',
  'background',
  'surface',
  'textPrimary',
  'textSecondary',
  'buttonText',
  'button',
  'border',
  'accent',
  'success',
  'error',
  'gradient1',
  'gradient2'
];

const DEFAULT_CUSTOMIZATION = {
  template: DEFAULT_MARKETPLACE_THEME.template,
  font: DEFAULT_MARKETPLACE_THEME.font,
  colors: { ...DEFAULT_MARKETPLACE_THEME.colors },
  gradientEnabled: DEFAULT_MARKETPLACE_THEME.gradientEnabled
};

const createStackStyle = (gap = 12) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: typeof gap === 'number' ? `${gap}px` : gap
});

const ALLOWED_MARKETPLACE_PLANS = new Set(['pro', 'enterprise']);
const formatShopName = (value) => {
  if (!value) {
    return '';
  }
  const cleaned = value.replace('.myshopify.com', '').replace(/[-_]/g, ' ');
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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

function ColorInput({ field, value, onChange, disabled = false }) {
  const handleTextChange = (event) => {
    const next = sanitizeHex(event.target.value);
    if (/^#[0-9A-F]{0,6}$/.test(next)) {
      onChange(field.key, next);
    }
  };

  return (
    <div style={createStackStyle(6)}>
      <div style={createStackStyle(4)}>
        <Text variant="bodyMd" fontWeight="medium">
          {field.label}
        </Text>
        <Text variant="bodySm" tone="subdued">
          {field.description}
        </Text>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: disabled ? 0.45 : 1 }}>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(field.key, event.target.value.toUpperCase())}
          disabled={disabled}
          style={{
            width: 48,
            height: 36,
            borderRadius: 8,
            border: '1px solid var(--p-color-border-subdued)',
            background: '#fff',
            cursor: disabled ? 'not-allowed' : 'pointer'
          }}
        />
        <input
          value={value}
          onChange={handleTextChange}
          maxLength={7}
          disabled={disabled}
          style={{
            width: 110,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--p-color-border-subdued)',
            fontFamily: 'monospace',
            fontSize: 13,
            background: disabled ? 'var(--p-color-bg-surface-disabled, #f6f6f7)' : '#fff',
            cursor: disabled ? 'not-allowed' : 'text'
          }}
        />
      </div>
    </div>
  );
}

function TemplateSelector({ selected, onSelect, options }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
      }}
    >
      {options.map((template) => (
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
          <div style={createStackStyle(6)}>
            <Text variant="bodyMd" fontWeight="semibold">
              {template.label}
            </Text>
            <Text variant="bodySm" tone="subdued">
              {template.description}
            </Text>
          </div>
        </button>
      ))}
    </div>
  );
}

const MarketplaceCustomizationSettings = () => {
  const i18n = useAdminI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { getShopInfo } = useAppBridgeActions();
  const templateOptions = useMemo(
    () =>
      TEMPLATE_OPTIONS.map(({ value, key }) => ({
        value,
        label: i18n.translate(`admin.marketplace.sections.design.templates.${key}.label`),
        description: i18n.translate(`admin.marketplace.sections.design.templates.${key}.description`)
      })),
    [i18n]
  );
  const colorFields = useMemo(
    () =>
      COLOR_FIELDS.map((key) => ({
        key,
        label: i18n.translate(`admin.marketplace.colors.${key}.label`),
        description: i18n.translate(`admin.marketplace.colors.${key}.description`)
      })),
    [i18n]
  );
  const shopNameFallback = i18n.translate('admin.marketplace.preview.shopNameFallback');
  const [customization, setCustomization] = useState(DEFAULT_CUSTOMIZATION);
  const [original, setOriginal] = useState(DEFAULT_CUSTOMIZATION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [planStatus, setPlanStatus] = useState({ loading: true, plan: 'free', allowed: false });
  const backgroundDisabled = customization.gradientEnabled;
  const planRequiredMessage = i18n.translate('admin.marketplace.planGate.defaultMessage');
  const spinnerLabel = i18n.translate('admin.marketplace.status.loading');
  const saveSuccessMessage = i18n.translate('admin.marketplace.messages.saveSuccess');
  const saveErrorMessage = i18n.translate('admin.marketplace.messages.saveError');
  const loadErrorMessage = i18n.translate('admin.marketplace.messages.loadError');
  const [shopDomainState, setShopDomainState] = useState(() => {
    const sessionUser = authService.getUser();
    if (sessionUser?.shopDomain) {
      return sessionUser.shopDomain;
    }
    const info = getShopInfo();
    return info?.shop || '';
  });
  const [shopDisplayName, setShopDisplayName] = useState(() => {
    const sessionUser = authService.getUser();
    if (sessionUser?.storeName) {
      return sessionUser.storeName;
    }
    const info = getShopInfo();
    const domain = sessionUser?.shopDomain || info?.shop || '';
    return formatShopName(domain) || shopNameFallback;
  });
  const search = location.search || '';
  const goToPlans = () => navigate(`/plans${search}`);

  const updateShopIdentity = useCallback(
    (domain, label) => {
      if (domain) {
        setShopDomainState(domain);
      }
      if (label) {
        setShopDisplayName(label);
        return;
      }
      if (domain) {
        setShopDisplayName((prev) => {
          if (!prev || prev === shopNameFallback) {
            return formatShopName(domain) || shopNameFallback;
          }
          return prev;
        });
      }
    },
    [shopNameFallback]
  );

  useEffect(() => {
    if (!shopDisplayName && shopDomainState) {
      setShopDisplayName(formatShopName(shopDomainState) || shopNameFallback);
    }
  }, [shopDisplayName, shopDomainState, shopNameFallback]);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await marketplaceCustomizationAPI.getSettings();
      if (response.success && response.customization) {
        const normalized = normalizeCustomization(response.customization);
        setCustomization(normalized);
        setOriginal(normalized);
        updateShopIdentity(response.customization.shopDomain, response.customization.storeName);
        setError('');
      } else {
        throw new Error(response.message || loadErrorMessage);
      }
    } catch (err) {
      console.error('Failed to load marketplace customization', err);
      setError(err.message || loadErrorMessage);
    } finally {
      setLoading(false);
    }
  }, [updateShopIdentity, loadErrorMessage]);

  useEffect(() => {
    let isMounted = true;
    const loadPlan = async () => {
      try {
        const response = await billingAPI.getCurrentPlan();
        if (!isMounted) {
          return;
        }
        const planKey = (response.plan || 'free').toLowerCase();
        const allowed = ALLOWED_MARKETPLACE_PLANS.has(planKey);
        setPlanStatus({ loading: false, plan: planKey, allowed });
        updateShopIdentity(response.shopDomain, response.storeName);
        if (!allowed) {
          setLoading(false);
        }
      } catch (err) {
        if (!isMounted) {
          return;
        }
        console.error('Failed to load plan info for marketplace customization', err);
        setPlanStatus({ loading: false, plan: 'free', allowed: false });
        setLoading(false);
      }
    };
    loadPlan();
    return () => {
      isMounted = false;
    };
  }, [updateShopIdentity]);

  useEffect(() => {
    if (planStatus.loading || !planStatus.allowed) {
      return;
    }
    fetchSettings();
  }, [planStatus.loading, planStatus.allowed, fetchSettings]);

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
        setToast({ content: saveSuccessMessage, tone: 'success' });
      } else {
        throw new Error(response.message || saveErrorMessage);
      }
    } catch (err) {
      console.error('Failed to save marketplace customization', err);
      const fallbackMessage = err.message || saveErrorMessage;
      setError(fallbackMessage);
      setToast({ content: fallbackMessage, tone: 'critical' });
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

  const showLoadingState = planStatus.loading || (planStatus.allowed && loading);

  if (showLoadingState) {
    return (
      <Page
        title={i18n.translate('admin.marketplace.page.title')}
        backAction={{ content: i18n.translate('admin.common.back'), onAction: () => navigate(-1) }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <Spinner size="large" accessibilityLabel={spinnerLabel} />
        </div>
      </Page>
    );
  }

  if (!planStatus.loading && !planStatus.allowed) {
    return (
      <Page
        title={i18n.translate('admin.marketplace.page.title')}
        subtitle={i18n.translate('admin.marketplace.planGate.subtitle')}
        backAction={{ content: i18n.translate('admin.common.back'), onAction: () => navigate(-1) }}
      >
        <Layout>
          <Layout.Section>
            <Banner
              tone="info"
              title={i18n.translate('admin.marketplace.planGate.bannerTitle')}
              action={{ content: i18n.translate('admin.common.viewPlans'), onAction: goToPlans }}
            >
              <p>{planRequiredMessage}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      fullWidth
      title={i18n.translate('admin.marketplace.page.title')}
      subtitle={i18n.translate('admin.marketplace.page.subtitle')}
      backAction={{ content: i18n.translate('admin.common.back'), onAction: () => navigate(-1) }}
      primaryAction={{
        content: i18n.translate('admin.marketplace.actions.save'),
        onAction: handleSave,
        loading: saving,
        disabled: !dirty || saving
      }}
      secondaryActions={[
        {
          content: i18n.translate('admin.marketplace.actions.resetApplied'),
          onAction: handleReset,
          disabled: !dirty || saving
        },
        {
          content: i18n.translate('admin.marketplace.actions.resetDefaults'),
          onAction: resetToDefaults,
          disabled: saving
        }
      ]}
    >
      {toast && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone={toast.tone === 'success' ? 'success' : 'critical'} onDismiss={() => setToast(null)}>
            <p>{toast.content}</p>
          </Banner>
        </div>
      )}
        <style>{`
          .marketplace-customization-grid {
            width: 100%;
            max-width: 1600px;
            margin: 0 auto;
            display: grid;
            gap: 32px;
            grid-template-columns: 1fr;
          }
          @media (min-width: 1280px) {
            .marketplace-customization-grid {
              grid-template-columns: 1fr 500px;
              align-items: flex-start;
            }
          }
          .marketplace-customization-grid__preview {
            position: relative;
          }
          @media (min-width: 1280px) {
            .marketplace-customization-grid__preview {
              position: sticky;
              top: 80px;
            }
          }
          .marketplace-customization-grid__previewCard {
            width: 100%;
            max-width: 500px;
            margin-left: auto;
            margin-right: auto;
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
            border-radius: 26px;
          }
          .marketplace-customization-grid__previewBody {
            padding: 0;
          }
        `}</style>
        <div className="marketplace-customization-grid">
          <div className="marketplace-customization-grid__controls">
            {error && (
              <Banner tone="critical" title={i18n.translate('admin.marketplace.errors.unavailable')}>
                <p>{error}</p>
              </Banner>
            )}
            <Card title={i18n.translate('admin.marketplace.sections.design.title')} sectioned>
              <div style={createStackStyle(20)}>
                <div style={createStackStyle(8)}>
                  <Text variant="headingSm" fontWeight="semibold">
                    {i18n.translate('admin.marketplace.sections.design.heading')}
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    {i18n.translate('admin.marketplace.sections.design.description')}
                  </Text>
                </div>
                <TemplateSelector
                  selected={customization.template}
                  onSelect={handleTemplateSelect}
                  options={templateOptions}
                />
                <div>
                  <Select
                    label={i18n.translate('admin.marketplace.sections.design.fontLabel')}
                    options={FONT_OPTIONS}
                    value={customization.font}
                    onChange={handleFontChange}
                  />
                </div>
              </div>
            </Card>

            <Card title={i18n.translate('admin.marketplace.sections.palette.title')} sectioned>
              <div style={createStackStyle(16)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <Text tone="subdued" variant="bodySm">
                    {i18n.translate('admin.marketplace.sections.palette.description')}
                  </Text>
                  <Button
                    size="slim"
                    pressed={customization.gradientEnabled}
                    onClick={toggleGradient}
                    accessibilityLabel={i18n.translate('admin.marketplace.sections.palette.gradientToggleLabel')}
                  >
                    {customization.gradientEnabled
                      ? i18n.translate('admin.marketplace.sections.palette.gradientEnabled')
                      : i18n.translate('admin.marketplace.sections.palette.gradientDisabled')}
                  </Button>
                </div>
                {customization.gradientEnabled && (
                  <Banner tone="info">
                    {i18n.translate('admin.marketplace.sections.palette.gradientInfo')}
                  </Banner>
                )}
                <div
                  style={{
                    display: 'grid',
                    gap: 20,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
                  }}
                >
                  {colorFields.map((field) => (
                    <ColorInput
                      key={field.key}
                      field={field}
                      value={customization.colors[field.key]}
                      onChange={handleColorChange}
                      disabled={backgroundDisabled && field.key === 'background'}
                    />
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div className="marketplace-customization-grid__preview">
            <Card
              title={i18n.translate('admin.marketplace.previewCard.title')}
              sectioned
              className="marketplace-customization-grid__previewCard"
            >
              <div className="marketplace-customization-grid__previewBody">
                <MarketplacePreview
                  customization={customization}
                  shopName={shopDisplayName || shopNameFallback}
                />
              </div>
            </Card>
          </div>
        </div>
      </Page>
    );
};

export default MarketplaceCustomizationSettings;
