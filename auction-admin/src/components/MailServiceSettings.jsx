import { useEffect, useMemo, useState } from 'react';
import {
  Page,
  Layout,
  Card,
  Text,
  Banner,
  TextField,
  Checkbox,
  Button,
  BlockStack,
  InlineGrid,
  Spinner,
  Frame,
  Toast,
  InlineStack
} from '@shopify/polaris';
import { emailSettingsAPI } from '../services/emailSettingsApi';

const TEMPLATE_METADATA = [
  { key: 'bidConfirmation', title: 'Bid confirmation' },
  { key: 'outbidNotification', title: 'Outbid notification' },
  { key: 'winnerNotification', title: 'Winner notification' },
  { key: 'auctionEndingSoon', title: 'Auction ending soon' },
  { key: 'adminNotification', title: 'Admin notification' }
];

const TOKEN_LIST = [
  '{{customer_name}}',
  '{{display_name}}',
  '{{auction_title}}',
  '{{product_title}}',
  '{{current_bid}}',
  '{{winning_bid}}',
  '{{buy_now_price}}',
  '{{auction_end_time}}',
  '{{time_remaining}}',
  '{{store_name}}',
  '{{cta_url}}'
];

const DEFAULT_SETTINGS = {
  enabled: true,
  useCustomSmtp: false,
  smtp: {
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    fromName: '',
    fromEmail: ''
  },
  templates: TEMPLATE_METADATA.reduce((acc, template) => {
    acc[template.key] = { enabled: true, subject: '', html: '' };
    return acc;
  }, {})
};

function mergeSettings(serverSettings = {}) {
  const merged = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  merged.enabled = serverSettings.enabled ?? merged.enabled;
  merged.useCustomSmtp = serverSettings.useCustomSmtp ?? merged.useCustomSmtp;
  merged.smtp = {
    ...merged.smtp,
    ...(serverSettings.smtp || {})
  };
  TEMPLATE_METADATA.forEach(({ key }) => {
    merged.templates[key] = {
      ...merged.templates[key],
      ...(serverSettings.templates?.[key] || {})
    };
  });
  return merged;
}

function MailServiceSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState({ active: false, content: '' });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [planContext, setPlanContext] = useState({ plan: 'free', canCustomize: false });
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await emailSettingsAPI.getSettings();
        if (!mounted) return;
        setSettings(mergeSettings(response.settings));
        setPlanContext({
          plan: response.plan,
          canCustomize: response.canCustomize
        });
      } catch (error) {
        console.error('Failed to load mail settings', error);
        setToast({ active: true, content: 'Failed to load mail settings' });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const disabled = useMemo(() => !planContext.canCustomize, [planContext]);

  const handleSmtpChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      smtp: {
        ...prev.smtp,
        [field]: value
      }
    }));
  };

  const handleTemplateChange = (templateKey, field, value) => {
    setSettings((prev) => ({
      ...prev,
      templates: {
        ...prev.templates,
        [templateKey]: {
          ...prev.templates[templateKey],
          [field]: value
        }
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await emailSettingsAPI.saveSettings(settings);
      setToast({ active: true, content: 'Mail settings saved' });
    } catch (error) {
      console.error('Failed to save mail settings', error);
      setToast({ active: true, content: 'Failed to save mail settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    try {
      setTesting(true);
      await emailSettingsAPI.testSmtp({
        smtp: settings.smtp,
        testEmail
      });
      setToast({ active: true, content: 'Test email sent' });
    } catch (error) {
      console.error('SMTP test failed', error);
      const message =
        error?.response?.data?.message || error?.message || 'SMTP test failed';
      setToast({ active: true, content: message });
    } finally {
      setTesting(false);
    }
  };

  const toastMarkup = toast.active ? (
    <Toast
      content={toast.content}
      onDismiss={() => setToast({ active: false, content: '' })}
    />
  ) : null;

  return (
    <Frame>
      {toastMarkup}
      <Page
        title="Mail service"
        primaryAction={{
          content: 'Save',
          onAction: handleSave,
          loading: saving,
          disabled: disabled
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 80 }}>
            <Spinner accessibilityLabel="Loading mail settings" />
          </div>
        ) : (
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              {disabled && (
                <Banner
                  title="Upgrade required"
                  tone="warning"
                >
                  <p>Custom mail settings are available on Pro and Enterprise plans.</p>
                </Banner>
              )}

              <Card title="SMTP configuration" sectioned>
                <BlockStack gap="300">
                  <Checkbox
                    label="Use my own email server"
                    checked={settings.useCustomSmtp}
                    onChange={(value) => setSettings((prev) => ({ ...prev, useCustomSmtp: value }))}
                    disabled={disabled}
                  />

                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                    <TextField
                      label="Host"
                      value={settings.smtp.host}
                      onChange={(value) => handleSmtpChange('host', value)}
                      autoComplete="off"
                      disabled={disabled || !settings.useCustomSmtp}
                    />
                    <TextField
                      label="Port"
                      type="number"
                      value={String(settings.smtp.port ?? '')}
                      onChange={(value) => handleSmtpChange('port', value)}
                      autoComplete="off"
                      disabled={disabled || !settings.useCustomSmtp}
                    />
                    <TextField
                      label="Username"
                      value={settings.smtp.user}
                      onChange={(value) => handleSmtpChange('user', value)}
                      autoComplete="off"
                      disabled={disabled || !settings.useCustomSmtp}
                    />
                    <TextField
                      label="Password / app password"
                      type="password"
                      value={settings.smtp.pass}
                      onChange={(value) => handleSmtpChange('pass', value)}
                      autoComplete="off"
                      disabled={disabled || !settings.useCustomSmtp}
                    />
                  </InlineGrid>

                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                    <TextField
                      label="From name"
                      value={settings.smtp.fromName}
                      onChange={(value) => handleSmtpChange('fromName', value)}
                      autoComplete="off"
                      disabled={disabled || !settings.useCustomSmtp}
                    />
                    <TextField
                      label="From email"
                      value={settings.smtp.fromEmail}
                      onChange={(value) => handleSmtpChange('fromEmail', value)}
                      autoComplete="off"
                      disabled={disabled || !settings.useCustomSmtp}
                    />
                  </InlineGrid>

                  <Checkbox
                    label="Use secure connection (TLS)"
                    checked={!!settings.smtp.secure}
                    onChange={(value) => handleSmtpChange('secure', value)}
                    disabled={disabled || !settings.useCustomSmtp}
                  />

                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                    <TextField
                      label="Test email recipient"
                      value={testEmail}
                      onChange={setTestEmail}
                      autoComplete="off"
                      disabled={disabled || !settings.useCustomSmtp}
                    />
                    <InlineStack align="end">
                      <Button
                        onClick={handleTestSmtp}
                        loading={testing}
                        disabled={disabled || !settings.useCustomSmtp}
                      >
                        Send test email
                      </Button>
                    </InlineStack>
                  </InlineGrid>
                </BlockStack>
              </Card>

              <Card title="Email templates" sectioned>
                <BlockStack gap="400">
                  <div>
                    <Text as="span" tone="subdued">
                      Available tokens:
                    </Text>
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {TOKEN_LIST.map((token) => (
                        <code
                          key={token}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            background: 'var(--p-color-bg-subdued)',
                            fontSize: 12
                          }}
                        >
                          {token}
                        </code>
                      ))}
                    </div>
                  </div>
                  {TEMPLATE_METADATA.map(({ key, title }) => {
                    const template = settings.templates[key] || { enabled: true, subject: '', html: '' };
                    return (
                      <Card.Section key={key}>
                        <BlockStack gap="200">
                          <InlineStack align="space-between" blockAlign="center">
                            <Text variant="headingMd">{title}</Text>
                            <Checkbox
                              label="Enabled"
                              checked={template.enabled}
                              onChange={(value) => handleTemplateChange(key, 'enabled', value)}
                              disabled={disabled}
                            />
                          </InlineStack>
                          <TextField
                            label="Subject"
                            value={template.subject}
                            onChange={(value) => handleTemplateChange(key, 'subject', value)}
                            autoComplete="off"
                            disabled={disabled}
                          />
                          <TextField
                            label="HTML content"
                            value={template.html}
                            onChange={(value) => handleTemplateChange(key, 'html', value)}
                            multiline={6}
                            autoComplete="off"
                            disabled={disabled}
                          />
                        </BlockStack>
                      </Card.Section>
                    );
                  })}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
        )}
      </Page>
    </Frame>
  );
}

export default MailServiceSettings;

