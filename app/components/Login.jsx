import React, { useState } from 'react';
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
      setError(error.response?.data?.message || 'Authentication failed');
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
      <s-card>
        <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <s-text variant="headingLg" as="h1">🔐 Bidly Admin Login</s-text>
            <s-text variant="bodyMd" tone="subdued">
              {isRegistering ? 'Create a new admin account' : 'Sign in to your admin account'}
            </s-text>
          </div>

          {error && (
            <div style={{ marginBottom: '16px' }}>
              <s-banner status="critical">
                <s-text variant="bodyMd">{error}</s-text>
              </s-banner>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isRegistering && (
                <div>
                  <s-text variant="bodyMd" fontWeight="semibold">Username</s-text>
                  <s-text-field
                    value={username}
                    onChange={setUsername}
                    placeholder="Enter username"
                    required
                    disabled={loading}
                  />
                </div>
              )}

              <div>
                <s-text variant="bodyMd" fontWeight="semibold">Email</s-text>
                <s-text-field
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="Enter email"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <s-text variant="bodyMd" fontWeight="semibold">Password</s-text>
                <s-text-field
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter password"
                  required
                  disabled={loading}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <s-button
                  variant="primary"
                  type="submit"
                  loading={loading}
                  disabled={!email || !password || (isRegistering && !username)}
                >
                  {loading ? 'Please wait...' : (isRegistering ? 'Register' : 'Login')}
                </s-button>
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <s-button
                  variant="plain"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError('');
                  }}
                  disabled={loading}
                >
                  {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
                </s-button>
              </div>
            </div>
          </form>

          <div style={{ 
            marginTop: '24px', 
            padding: '16px', 
            backgroundColor: '#f6f6f7', 
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            <s-text variant="bodySm" tone="subdued">
              <strong>Demo Credentials:</strong><br />
              Email: test@example.com<br />
              Password: password123
            </s-text>
          </div>
        </div>
      </s-card>
    </div>
  );
};

export default Login;
