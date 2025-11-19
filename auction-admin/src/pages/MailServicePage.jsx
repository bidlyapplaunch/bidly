import { Page } from '@shopify/polaris';
import { useLocation, useNavigate } from 'react-router-dom';
import MailServiceSettings from '../components/MailServiceSettings';

export default function MailServicePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = location.search || '';

  return (
    <Page
      title="Mail Service"
      backAction={{
        content: 'Back',
        onAction: () => navigate(`/${query}`),
      }}
    >
      <MailServiceSettings />
    </Page>
  );
}

