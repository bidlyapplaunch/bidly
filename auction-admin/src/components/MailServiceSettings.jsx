import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Text,
  Banner,
  TextField,
  Checkbox,
  Button,
  Spinner,
  FormLayout,
  ChoiceList
} from '@shopify/polaris';
import { emailSettingsAPI } from '../services/emailSettingsApi';

const TEMPLATE_METADATA = [
  { key: 'bidConfirmation', title: 'Bid confirmation' },
  { key: 'outbidNotification', title: 'Outbid notification' },
  { key: 'winnerNotification', title: 'Winner notification' },
  { key: 'auctionEndingSoon', title: 'Auction ending soon' },
  { key: 'adminNotification', title: 'Admin notification' }
];

const TEMPLATE_DEFAULTS = {
  bidConfirmation: {
    subject: 'Your bid on {{auction_title}} has been received',
    mode: 'html',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">🎯 Bid Confirmation</h2>
        <p>Hello {{display_name}},</p>
        <p>Your bid has been successfully placed!</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">Auction Details</h3>
          <p><strong>Item:</strong> {{auction_title}}</p>
          <p><strong>Your Bid:</strong> ${'$'}{{current_bid}}</p>
          <p><strong>Auction Ends:</strong> {{auction_end_time}}</p>
          <p><strong>Current Status:</strong> Active</p>
        </div>
        <p>You will be notified if someone outbids you or if you win the auction.</p>
        <p style="color: #7f8c8d; font-size: 14px;">
          Best regards,<br />
          The {{store_name}} Team
        </p>
      </div>
    `
  },
  outbidNotification: {
    subject: 'You have been outbid on {{auction_title}}',
    mode: 'html',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e74c3c;">⚠️ You've Been Outbid</h2>
        <p>Hello {{display_name}},</p>
        <p>Someone has placed a higher bid on the auction you were participating in.</p>
        <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c;">
          <h3 style="color: #721c24; margin-top: 0;">Auction Update</h3>
          <p><strong>Item:</strong> {{auction_title}}</p>
          <p><strong>New Highest Bid:</strong> ${'$'}{{current_bid}}</p>
          <p><strong>Time Remaining:</strong> {{time_remaining}}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{cta_url}}"
             style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Place a New Bid
          </a>
        </div>
        <p style="color: #7f8c8d; font-size: 14px;">
          Best regards,<br />
          The {{store_name}} Team
        </p>
      </div>
    `
  },
  winnerNotification: {
    subject: 'You won the auction for {{auction_title}}!',
    mode: 'html',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #27ae60;">🎉 Congratulations! You Won the Auction!</h2>
        <p>Dear {{display_name}},</p>
        <p>Congratulations! You have successfully won the auction for <strong>"{{auction_title}}"</strong> with a winning bid of <strong>${'$'}{{winning_bid}}</strong>.</p>
        <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
          <h3 style="color: #155724; margin-top: 0;">🏆 Auction Details</h3>
          <p><strong>Product:</strong> {{auction_title}}</p>
          <p><strong>Winning Bid:</strong> ${'$'}{{winning_bid}}</p>
          <p><strong>Auction Ended:</strong> {{auction_end_time}}</p>
        </div>
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3 style="color: #856404; margin-top: 0;">📧 Next Steps</h3>
          <p>You will receive an invoice from us shortly with a link to complete your purchase. Please wait for the invoice email which will contain all the details you need to claim your win.</p>
          <p><strong>You have 30 minutes to claim your win</strong>, or the second highest bidder will receive the win instead.</p>
        </div>
        <p style="color: #7f8c8d; font-size: 14px;">
          Best regards,<br />
          The {{store_name}} Team
        </p>
      </div>
    `
  },
  auctionEndingSoon: {
    subject: '⏰ {{auction_title}} is ending soon',
    mode: 'html',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f39c12;">⏰ Auction Ending Soon!</h2>
        <p>Hello {{display_name}},</p>
        <p>The auction you're participating in is ending soon!</p>
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f39c12;">
          <h3 style="color: #856404; margin-top: 0;">Auction Details</h3>
          <p><strong>Item:</strong> {{auction_title}}</p>
          <p><strong>Current Bid:</strong> ${'$'}{{current_bid}}</p>
          <p><strong>Time Remaining:</strong> {{time_remaining}}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{cta_url}}"
             style="background-color: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Place Your Final Bid
          </a>
        </div>
        <p style="color: #7f8c8d; font-size: 14px;">
          Best regards,<br />
          The {{store_name}} Team
        </p>
      </div>
    `
  },
  adminNotification: {
    subject: 'Admin Notification: {{subject_override}}',
    mode: 'html',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Admin Notification for {{store_name}}</h2>
        <p>{{message}}</p>
        {{#if auction_title}}
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">Auction Details</h3>
          <p><strong>Item:</strong> {{auction_title}}</p>
          <p><strong>Status:</strong> {{auction_status}}</p>
          <p><strong>Current Bid:</strong> ${'$'}{{current_bid}}</p>
          <p><strong>Bid Count:</strong> {{bid_count}}</p>
        </div>
        {{/if}}
        <p style="color: #7f8c8d; font-size: 14px;">
          Auction System Admin Panel
        </p>
      </div>
    `
  }
};

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

const createDefaultSettings = (templateDefaults = TEMPLATE_DEFAULTS) => ({
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
    const defaults = templateDefaults[template.key] || TEMPLATE_DEFAULTS[template.key];
    acc[template.key] = {
      enabled: true,
      subject: defaults?.subject || '',
      html: defaults?.html || '',
      mode: defaults?.mode || 'text'
    };
    return acc;
  }, {})
});

const DEFAULT_SETTINGS = createDefaultSettings();

function mergeSettings(serverSettings = {}, templateDefaults = TEMPLATE_DEFAULTS) {
  const merged = createDefaultSettings(templateDefaults);
  merged.enabled = serverSettings.enabled ?? merged.enabled;
  merged.useCustomSmtp = serverSettings.useCustomSmtp ?? merged.useCustomSmtp;
  merged.smtp = {
    ...merged.smtp,
    ...(serverSettings.smtp || {})
  };
  TEMPLATE_METADATA.forEach(({ key }) => {
    const defaults = templateDefaults[key] || TEMPLATE_DEFAULTS[key];
    const serverTemplate = serverSettings.templates?.[key] || {};
    merged.templates[key] = {
      enabled: serverTemplate.enabled ?? merged.templates[key].enabled,
      subject: serverTemplate.subject?.trim()
        ? serverTemplate.subject
        : defaults?.subject || '',
      html: serverTemplate.html?.trim()
        ? serverTemplate.html
        : defaults?.html || '',
      mode:
        typeof serverTemplate.mode === 'string'
          ? serverTemplate.mode
          : merged.templates[key].mode || defaults?.mode || 'text'
    };
  });
  return merged;
}

function MailServiceSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null);
  const [defaultTemplates, setDefaultTemplates] = useState(TEMPLATE_DEFAULTS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [planContext, setPlanContext] = useState({ plan: 'free', canCustomize: false });
  const [testEmail, setTestEmail] = useState('');
  const [templateTestEmail, setTemplateTestEmail] = useState('');
  const [templateTestLoading, setTemplateTestLoading] = useState(null);
  const [activeFieldContext, setActiveFieldContext] = useState({ templateKey: null, field: null });
  const [isWideLayout, setIsWideLayout] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 1100;
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await emailSettingsAPI.getSettings();
        if (!mounted) return;
        const templateDefaults = response?.defaults?.templates || TEMPLATE_DEFAULTS;
        setDefaultTemplates(templateDefaults);
        setSettings(mergeSettings(response.settings, templateDefaults));
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

  useEffect(() => {
    const handleResize = () => {
      setIsWideLayout(window.innerWidth >= 1100);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const disabled = useMemo(() => !planContext.canCustomize, [planContext]);

  const layoutStyles = useMemo(
    () => ({
      container: {
        display: 'flex',
        flexDirection: isWideLayout ? 'row' : 'column',
        gap: isWideLayout ? 24 : 16,
        alignItems: 'flex-start'
      },
      mainColumn: {
        flex: 1,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 20
      },
      sidebar: {
        width: isWideLayout ? 300 : '100%',
        position: isWideLayout ? 'sticky' : 'static',
        top: isWideLayout ? 80 : 'auto',
        alignSelf: 'flex-start'
      }
    }),
    [isWideLayout]
  );

  const handleSmtpChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      smtp: {
        ...prev.smtp,
        [field]: value
      }
    }));
  };

  const handleTemplateFocus = (templateKey, field) => {
    setActiveFieldContext({ templateKey, field });
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

  const handleResetTemplate = (templateKey) => {
    if (disabled) return;
    const defaults = defaultTemplates[templateKey] || TEMPLATE_DEFAULTS[templateKey];
    if (!defaults) return;

    setSettings((prev) => ({
      ...prev,
      templates: {
        ...prev.templates,
        [templateKey]: {
          ...prev.templates[templateKey],
          subject: defaults.subject,
          html: defaults.html
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

  const handleSendTemplateTest = async (templateKey) => {
    if (disabled) {
      setMessage({
        tone: 'critical',
        content: 'Upgrade to a Pro or Enterprise plan to send template tests.'
      });
      return;
    }

    const recipient = templateTestEmail.trim();
    if (!recipient) {
      setMessage({ tone: 'critical', content: 'Enter a test email recipient.' });
      return;
    }

    const template = settings.templates[templateKey];
    if (!template) {
      setMessage({ tone: 'critical', content: 'Template not found.' });
      return;
    }

    try {
      setTemplateTestLoading(templateKey);
      await emailSettingsAPI.testTemplate({
        templateKey,
        to: recipient,
        overrides: {
          subject: template.subject,
          html: template.html
        }
      });
      setMessage({ tone: 'success', content: `Template test sent to ${recipient}.` });
    } catch (error) {
      console.error('Template test failed', error);
      setMessage({
        tone: 'critical',
        content: error?.response?.data?.message || error?.message || 'Template test failed.'
      });
    } finally {
      setTemplateTestLoading(null);
    }
  };

  const handleTokenClick = (token) => {
    if (disabled) return;
    const { templateKey, field } = activeFieldContext;
    if (!templateKey || !field) {
      setMessage({
        tone: 'warning',
        content: 'Select a template subject or HTML field to insert tokens.'
      });
      return;
    }

    setSettings((prev) => {
      const currentTemplate = prev.templates[templateKey];
      if (!currentTemplate) {
        return prev;
      }
      const currentValue = currentTemplate[field] || '';
      return {
        ...prev,
        templates: {
          ...prev.templates,
          [templateKey]: {
            ...currentTemplate,
            [field]: `${currentValue}${token}`
          }
        }
      };
    });
  };

  const renderFeedback = () => {
    if (!message) return null;
    return (
      <Banner tone={message.tone} onDismiss={() => setMessage(null)}>
        <p>{message.content}</p>
      </Banner>
    );
  };

  const renderTokenChips = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {TOKEN_LIST.map((token) => (
        <code
          key={token}
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            background: 'var(--p-color-bg-subdued)',
            cursor: disabled ? 'not-allowed' : 'pointer'
          }}
          role="button"
          tabIndex={0}
          aria-disabled={disabled}
          onClick={() => handleTokenClick(token)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleTokenClick(token);
            }
          }}
        >
          {token}
        </code>
      ))}
    </div>
  );

  const renderTokenPanel = () => (
    <div
      style={{
        background: 'var(--p-color-bg-surface, #fff)',
        border: '1px solid var(--p-color-border-subdued, #dfe3e8)',
        borderRadius: 12,
        padding: 16,
        boxShadow: '0 12px 30px rgba(24, 39, 75, 0.08)',
        maxHeight: isWideLayout ? 'calc(100vh - 120px)' : 'none',
        overflowY: 'auto'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Text variant="headingMd">Available tokens</Text>
        <Text tone="subdued" variant="bodySm">
          Click a token to insert it into the subject or HTML field you’re editing.
        </Text>
        {renderTokenChips()}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Spinner accessibilityLabel="Loading mail settings" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {renderFeedback()}
      {disabled && (
        <Banner tone="warning" title="Upgrade required">
          <p>Custom mail settings are available on Pro and Enterprise plans.</p>
        </Banner>
      )}

      <div style={layoutStyles.container}>
        {!isWideLayout && (
          <div style={{ width: '100%' }}>
            {renderTokenPanel()}
          </div>
        )}

        <div style={layoutStyles.mainColumn}>
          <Card sectioned>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <Text variant="headingMd">SMTP configuration</Text>
                <Text tone="subdued">
                  Connect your own email server to send notifications from your domain.
                </Text>
              </div>

              <Checkbox
                label="Use my own email server"
                checked={settings.useCustomSmtp}
                onChange={(value) => setSettings((prev) => ({ ...prev, useCustomSmtp: value }))}
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

          <Card sectioned>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <Text variant="headingMd">Email templates</Text>
                <Text tone="subdued">
                  Customize Bidly notification content. Use the token panel to pull in dynamic values like
                  bidder names or auction details.
                </Text>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <TextField
                  label="Test email recipient"
                  type="email"
                  value={templateTestEmail}
                  onChange={setTemplateTestEmail}
                  autoComplete="email"
                  placeholder="name@example.com"
                  disabled={disabled}
                />
                <Text tone="subdued" variant="bodySm">
                  This address is used by the “Send test using this template” buttons below.
                </Text>
              </div>

              <div>
                {TEMPLATE_METADATA.map(({ key, title }, index) => {
                  const template = settings.templates[key] || {
                    enabled: true,
                    subject: '',
                    html: '',
                    mode: 'text'
                  };
                  return (
                    <div
                      key={key}
                      style={{
                        padding: '16px 0',
                        borderTop: index === 0 ? 'none' : '1px solid var(--p-color-border-subdued, #dfe3e8)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12
                      }}
                    >
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
                          onFocus={() => handleTemplateFocus(key, 'subject')}
                          autoComplete="off"
                          disabled={disabled}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <Text variant="bodySm" fontWeight="bold">
                            Editor mode
                          </Text>
                          <ChoiceList
                            title="Editor mode"
                            titleHidden
                            choices={[
                              { label: 'Simple editor', value: 'text' },
                              { label: 'HTML editor', value: 'html' }
                            ]}
                            selected={[template.mode || 'text']}
                            onChange={(value) => handleTemplateChange(key, 'mode', value[0])}
                            allowMultiple={false}
                            disabled={disabled}
                          />
                        </div>
                        <TextField
                          label={template.mode === 'html' ? 'HTML content' : 'Message body'}
                          value={template.html}
                          onChange={(value) => handleTemplateChange(key, 'html', value)}
                          onFocus={() => handleTemplateFocus(key, 'html')}
                          multiline={template.mode === 'html' ? 8 : 6}
                          autoComplete="off"
                          disabled={disabled}
                          style={template.mode === 'html' ? { fontFamily: 'monospace' } : undefined}
                        />
                      </FormLayout>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <Button size="slim" onClick={() => handleResetTemplate(key)} disabled={disabled}>
                          Reset to default
                        </Button>
                        <Button
                          size="slim"
                          onClick={() => handleSendTemplateTest(key)}
                          disabled={disabled || !templateTestEmail.trim()}
                          loading={templateTestLoading === key}
                        >
                          Send test using this template
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button primary onClick={handleSave} loading={saving} disabled={disabled}>
              Save mail settings
            </Button>
          </div>
        </div>

        {isWideLayout && (
          <div style={layoutStyles.sidebar}>
            {renderTokenPanel()}
          </div>
        )}
      </div>
    </div>
  );
}

export default MailServiceSettings;

