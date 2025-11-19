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
import MailServiceSettings from './components/MailServiceSettings';
import PlansPage from './components/PlansPage';
import AppNavigationMenu from './components/AppNavigationMenu';
import OnboardingPage from './components/OnboardingPage';
import { onboardingAPI } from './services/api';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [oauthComplete, setOauthComplete] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState(null);

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

  useEffect(() => {
    let isMounted = true;
    const loadOnboardingStatus = async () => {
      if (!user || !oauthComplete) {
        return;
      }
      setOnboardingLoading(true);
      try {
        const response = await onboardingAPI.getStatus();
        if (isMounted) {
          setOnboardingStatus(response);
        }
      } catch (error) {
        console.error('Failed to load onboarding status', error);
        if (isMounted) {
          setOnboardingStatus({ onboardingComplete: true });
        }
      } finally {
        if (isMounted) {
          setOnboardingLoading(false);
        }
      }
    };

    loadOnboardingStatus();

    return () => {
      isMounted = false;
    };
  }, [user, oauthComplete]);

  let content = null;

  if (loading) {
    content = (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontFamily: 'Inter, sans-serif',
          color: '#1f2937'
        }}
      >
        Loading Bidly…
      </div>
    );
  } else if (!user) {
    content = <Login onLogin={handleLogin} />;
  } else if (!oauthComplete) {
    content = <OAuthSetup onComplete={handleOAuthComplete} />;
  } else if (onboardingLoading || !onboardingStatus) {
    content = (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontFamily: 'Inter, sans-serif',
          color: '#1f2937'
        }}
      >
        Preparing your dashboard…
      </div>
    );
  } else if (!onboardingStatus.onboardingComplete) {
    content = (
      <OnboardingPage
        initialStatus={onboardingStatus}
        onComplete={() => {
          setOnboardingStatus((prev) => ({
            ...(prev || {}),
            onboardingComplete: true
          }));
        }}
      />
    );
  } else {
    content = (
      <Routes>
        <Route path="/" element={<Dashboard onLogout={handleLogout} />} />
        <Route path="/customization/marketplace" element={<MarketplaceCustomizationSettings />} />
        <Route path="/customization/widget" element={<WidgetCustomizationSettings />} />
        <Route path="/mail-service" element={<MailServiceSettings />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  const showNavigation =
    !loading && !!user && oauthComplete && onboardingStatus?.onboardingComplete;

  return (
    <AppBridgeProvider>
      <AppProvider>
        <BrowserRouter>
          {showNavigation && <AppNavigationMenu />}
          {content}
        </BrowserRouter>
      </AppProvider>
    </AppBridgeProvider>
  );
}

export default App;