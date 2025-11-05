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

const Login = ({ onLogin }) => {
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
      let response;
      if (isRegistering) {
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
                          'Authentication failed';
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
            <Text variant="headingLg" as="h1">🔐 Bidly Admin Login</Text>
            <Text variant="bodyMd" color="subdued">
              {isRegistering ? 'Create a new admin account' : 'Sign in to your admin account'}
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
                  label="Username"
                  value={username}
                  onChange={setUsername}
                  placeholder="Enter username"
                  required
                  disabled={loading}
                />
              )}

              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="Enter email"
                required
                disabled={loading}
              />

              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="Enter password"
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
                  {loading ? 'Please wait...' : (isRegistering ? 'Register' : 'Login')}
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
                  {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
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
              <strong>Demo Credentials:</strong><br />
              Email: test@example.com<br />
              Password: password123
            </Text>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Login;
