import { Page } from '@shopify/polaris';
import { useLocation, useNavigate } from 'react-router-dom';
import MailServiceSettings from '../components/MailServiceSettings';
import useAdminI18n from '../hooks/useAdminI18n';

export default function MailServicePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = location.search || '';
  const i18n = useAdminI18n();

  return (
    <Page
      title={i18n.translate('admin.mail_service.page.title')}
      backAction={{
        content: i18n.translate('admin.common.back'),
        onAction: () => navigate(`/${query}`)
      }}
    >
      <MailServiceSettings />
    </Page>
  );
}

