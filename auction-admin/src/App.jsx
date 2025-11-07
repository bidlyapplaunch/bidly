import React, { useState, useEffect } from 'react';
import { AppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import OAuthSetup from './components/OAuthSetup';
import AppBridgeProvider from './components/AppBridgeProvider';
import authService from './services/auth';
import MarketplaceCustomizationSettings from './components/MarketplaceCustomizationSettings';
import WidgetCustomizationSettings from './components/WidgetCustomizationSettings';
import PlansPage from './components/PlansPage';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [oauthComplete, setOauthComplete] = useState(false);

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = () => {
      authService.initializeAuth();
      if (authService.isAuthenticated()) {
        setUser(authService.getUser());
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
  };

  const handleOAuthComplete = () => {
    setOauthComplete(true);
  };

  if (loading) {
    return (
      <AppProvider>
        <AppBridgeProvider>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh' 
          }}>
            <div>Loading...</div>
          </div>
        </AppBridgeProvider>
      </AppProvider>
    );
  }

  if (!user) {
    return (
      <AppProvider>
        <AppBridgeProvider>
          <Login onLogin={handleLogin} />
        </AppBridgeProvider>
      </AppProvider>
    );
  }

  // Check OAuth completion after user is authenticated
  if (!oauthComplete) {
    return (
      <AppProvider>
        <AppBridgeProvider>
          <OAuthSetup onComplete={handleOAuthComplete} />
        </AppBridgeProvider>
      </AppProvider>
    );
  }

  return (
    <AppProvider>
      <AppBridgeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard onLogout={handleLogout} />} />
            <Route path="/customization/marketplace" element={<MarketplaceCustomizationSettings />} />
            <Route path="/customization/widget" element={<WidgetCustomizationSettings />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppBridgeProvider>
    </AppProvider>
  );
}

export default App;