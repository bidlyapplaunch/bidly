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
  Spinner,
  FormLayout
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
  const [message, setMessage] = useState(null);
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
        setMessage({ tone: 'critical', content: 'Failed to load mail settings.' });
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
      setMessage({ tone: 'success', content: 'Mail settings saved successfully.' });
    } catch (error) {
      console.error('Failed to save mail settings', error);
      setMessage({ tone: 'critical', content: 'Failed to save mail settings.' });
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
      setMessage({ tone: 'success', content: 'Test email sent.' });
    } catch (error) {
      console.error('SMTP test failed', error);
      setMessage({
        tone: 'critical',
        content: error?.response?.data?.message || error?.message || 'SMTP test failed.'
      });
    } finally {
      setTesting(false);
    }
  };

  const renderFeedback = () => {
    if (!message) return null;
    return (
      <Banner tone={message.tone} onDismiss={() => setMessage(null)}>
        <p>{message.content}</p>
      </Banner>
    );
  };

  const renderTokens = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {TOKEN_LIST.map((token) => (
        <code
          key={token}
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            background: 'var(--p-color-bg-subdued)'
          }}
        >
          {token}
        </code>
      ))}
    </div>
  );

  return (
    <Page
      title="Mail service"
      primaryAction={{
        content: 'Save',
        onAction: handleSave,
        loading: saving,
        disabled
      }}
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <Spinner accessibilityLabel="Loading mail settings" />
        </div>
      ) : (
        <Layout>
          <Layout.Section>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {renderFeedback()}
              {disabled && (
                <Banner tone="warning" title="Upgrade required">
                  <p>Custom mail settings are available on Pro and Enterprise plans.</p>
                </Banner>
              )}

              <Card title="SMTP configuration" sectioned>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Checkbox
                    label="Use my own email server"
                    checked={settings.useCustomSmtp}
                    onChange={(value) =>
                      setSettings((prev) => ({ ...prev, useCustomSmtp: value }))
                    }
                    disabled={disabled}
                  />

                  <FormLayout>
                    <FormLayout.Group condensed>
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
                    </FormLayout.Group>

                    <FormLayout.Group condensed>
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
                    </FormLayout.Group>

                    <FormLayout.Group condensed>
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
                    </FormLayout.Group>

                    <Checkbox
                      label="Use secure connection (TLS)"
                      checked={!!settings.smtp.secure}
                      onChange={(value) => handleSmtpChange('secure', value)}
                      disabled={disabled || !settings.useCustomSmtp}
                    />

                    <FormLayout.Group condensed>
                      <TextField
                        label="Test email recipient"
                        value={testEmail}
                        onChange={setTestEmail}
                        autoComplete="off"
                        disabled={disabled || !settings.useCustomSmtp}
                      />
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <Button
                          onClick={handleTestSmtp}
                          disabled={disabled || !settings.useCustomSmtp}
                          loading={testing}
                        >
                          Send test email
                        </Button>
                      </div>
                    </FormLayout.Group>
                  </FormLayout>
                </div>
              </Card>

              <Card title="Email templates" sectioned>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <Text as="span" tone="subdued">
                      Available tokens:
                    </Text>
                    <div style={{ marginTop: 8 }}>{renderTokens()}</div>
                  </div>

                  {TEMPLATE_METADATA.map(({ key, title }) => {
                    const template = settings.templates[key] || {
                      enabled: true,
                      subject: '',
                      html: ''
                    };
                    return (
                      <Card.Section key={key}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 12
                            }}
                          >
                            <Text variant="headingMd">{title}</Text>
                            <Checkbox
                              label="Enabled"
                              checked={template.enabled}
                              onChange={(value) => handleTemplateChange(key, 'enabled', value)}
                              disabled={disabled}
                            />
                          </div>
                          <FormLayout>
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
                          </FormLayout>
                        </div>
                      </Card.Section>
                    );
                  })}
                </div>
              </Card>
            </div>
          </Layout.Section>
        </Layout>
      )}
    </Page>
  );
}

export default MailServiceSettings;

