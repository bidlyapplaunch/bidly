import React, { useState } from 'react';
import {
  Card,
  FormLayout,
  TextField,
  Button,
  Banner,
  Text
} from '@shopify/polaris';
import authService from '../services/auth';
import useAdminI18n from '../hooks/useAdminI18n';

const Login = ({ onLogin }) => {
  const i18n = useAdminI18n();
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('testuser');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate registration fields
      if (isRegistering) {
        if (!username || !username.trim()) {
          setError(i18n.translate('admin.auth.errors.usernameRequired'));
          setLoading(false);
          return;
        }
        if (!email || !email.trim()) {
          setError(i18n.translate('admin.auth.errors.emailRequired'));
          setLoading(false);
          return;
        }
        if (!password || password.length < 6) {
          setError(i18n.translate('admin.auth.errors.passwordLength'));
          setLoading(false);
          return;
        }
      }

      let response;
      if (isRegistering) {
        console.log('📝 Registering with:', { username, email, passwordLength: password.length });
        response = await authService.register(username, email, password);
      } else {
        response = await authService.login(email, password);
      }
      
      onLogin(response.data.user);
    } catch (error) {
      console.error('Auth error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.errors?.map(e => e.message || e.msg).join(', ') ||
                          error.message || 
                          i18n.translate('admin.auth.errors.generic');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      padding: '20px'
    }}>
      <Card sectioned>
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Text variant="headingLg" as="h1">{i18n.translate('admin.auth.title')}</Text>
            <Text variant="bodyMd" color="subdued">
              {isRegistering
                ? i18n.translate('admin.auth.subtitles.register')
                : i18n.translate('admin.auth.subtitles.login')}
            </Text>
          </div>

          {error && (
            <div style={{ marginBottom: '16px' }}>
              <Banner status="critical">
                <Text variant="bodyMd">{error}</Text>
              </Banner>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <FormLayout>
              {isRegistering && (
                <TextField
                  label={i18n.translate('admin.auth.fields.username')}
                  value={username}
                  onChange={setUsername}
                  placeholder={i18n.translate('admin.auth.fields.usernamePlaceholder')}
                  required
                  disabled={loading}
                />
              )}

              <TextField
                label={i18n.translate('admin.auth.fields.email')}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder={i18n.translate('admin.auth.fields.emailPlaceholder')}
                required
                disabled={loading}
              />

              <TextField
                label={i18n.translate('admin.auth.fields.password')}
                type="password"
                value={password}
                onChange={setPassword}
                placeholder={i18n.translate('admin.auth.fields.passwordPlaceholder')}
                required
                disabled={loading}
              />

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Button
                  primary
                  submit
                  loading={loading}
                  disabled={!email || !password || (isRegistering && !username)}
                >
                  {loading
                    ? i18n.translate('admin.auth.actions.loading')
                    : isRegistering
                      ? i18n.translate('admin.auth.actions.register')
                      : i18n.translate('admin.auth.actions.login')}
                </Button>
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <Button
                  plain
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError('');
                  }}
                  disabled={loading}
                >
                  {isRegistering
                    ? i18n.translate('admin.auth.toggle.login')
                    : i18n.translate('admin.auth.toggle.register')}
                </Button>
              </div>
            </FormLayout>
          </form>

          <div style={{ 
            marginTop: '24px', 
            padding: '16px', 
            backgroundColor: '#f6f6f7', 
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            <Text variant="bodySm" color="subdued">
              <strong>{i18n.translate('admin.auth.demo.title')}</strong><br />
              {i18n.translate('admin.auth.demo.email', { value: 'test@example.com' })}<br />
              {i18n.translate('admin.auth.demo.password', { value: 'password123' })}
            </Text>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Login;
