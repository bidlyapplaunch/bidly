import { useCallback, useEffect, useState } from 'react';
import { Page } from '@shopify/polaris';
import { useLocation, useNavigate } from 'react-router-dom';
import MailServiceSettings from '../components/MailServiceSettings';
import CustomerListTab from '../components/CustomerListTab';
import BlastEmailTab from '../components/BlastEmailTab';
import { emailSettingsAPI } from '../services/emailSettingsApi';
import useAdminI18n from '../hooks/useAdminI18n';

const TABS = [
  { id: 'templates', label: 'Email Templates' },
  { id: 'customers', label: 'Customer List' },
  { id: 'blast', label: 'Blast Emails' }
];

export default function MailServicePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = location.search || '';
  const i18n = useAdminI18n();
  const [activeTab, setActiveTab] = useState('templates');
  const [recipientSelection, setRecipientSelection] = useState({ selectAll: true, recipientIds: [] });
  const [canCustomize, setCanCustomize] = useState(false);

  // Load plan context to determine if blast emails are available
  useEffect(() => {
    emailSettingsAPI.getSettings()
      .then(res => setCanCustomize(res.canCustomize ?? false))
      .catch(() => {});
  }, []);

  const handleComposeBlast = useCallback((selection) => {
    setRecipientSelection(selection);
    setActiveTab('blast');
  }, []);

  const handleEditRecipients = useCallback(() => {
    setActiveTab('customers');
  }, []);

  return (
    <Page
      title={i18n.translate('admin.mail_service.page.title')}
      backAction={{
        content: i18n.translate('admin.common.back'),
        onAction: () => navigate(`/${query}`)
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Tab bar */}
        <div style={{
          display: 'flex',
          gap: 0,
          borderBottom: '2px solid var(--p-color-border-subdued, #dfe3e8)'
        }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 20px',
                border: 'none',
                borderBottom: activeTab === tab.id
                  ? '2px solid var(--p-color-bg-fill-brand, #008060)'
                  : '2px solid transparent',
                marginBottom: -2,
                background: 'transparent',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id
                  ? 'var(--p-color-text, #202223)'
                  : 'var(--p-color-text-subdued, #6d7175)',
                fontSize: 14,
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'templates' && <MailServiceSettings />}
        {activeTab === 'customers' && (
          <CustomerListTab onComposeBlast={handleComposeBlast} />
        )}
        {activeTab === 'blast' && (
          <BlastEmailTab
            recipientSelection={recipientSelection}
            onEditRecipients={handleEditRecipients}
            disabled={!canCustomize}
          />
        )}
      </div>
    </Page>
  );
}
