import React, { useState, useEffect } from 'react';
import { AppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { I18nContext, I18nManager } from '@shopify/react-i18n';
import { useAppBridge } from '@shopify/app-bridge-react';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import OAuthSetup from './components/OAuthSetup';
import AppBridgeProvider from './components/AppBridgeProvider';
import authService from './services/auth';
import MarketplaceCustomizationSettings from './components/MarketplaceCustomizationSettings';
import WidgetCustomizationSettings from './components/WidgetCustomizationSettings';
import MailServicePage from './pages/MailServicePage';
import PlansPage from './components/PlansPage';
import AppNavigationMenu from './components/AppNavigationMenu';
import OnboardingPage from './components/OnboardingPage';
import { onboardingAPI } from './services/api';
import { isRtlLocale } from './locales';
import useAdminI18n from './hooks/useAdminI18n';
import en from '../locales/en.default.json';
import pl from '../locales/pl.json';
import de from '../locales/de.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import it from '../locales/it.json';
import nl from '../locales/nl.json';
import ar from '../locales/ar.json';
import ja from '../locales/ja.json';
import ko from '../locales/ko.json';

const translations = { en, pl, de, es, fr, it, nl, ar, ja, ko };

function detectLocale(appBridge) {
  try {
    const locale = appBridge?.localization?.language;
    if (locale) {
      return locale.split('-')[0];
    }
  } catch {
    console.warn('App Bridge not ready yet for locale detection');
  }

  const browserLocale = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return (browserLocale || 'en').split('-')[0];
}

function LocaleAwareApp() {
  const appBridge = useAppBridge();
  const [locale, setLocale] = useState(() => detectLocale(appBridge));
  const [i18nManager] = useState(
    () =>
      new I18nManager({
        locale: 'en',
        fallbackLocale: 'en'
      })
  );

  useEffect(() => {
    const abLocale = appBridge?.localization?.language;
    if (abLocale) {
      setLocale(abLocale.split('-')[0]);
    } else {
      setLocale(detectLocale(appBridge));
    }
  }, [appBridge]);

  useEffect(() => {
    i18nManager.update({ locale });

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('dir', isRtlLocale(locale) ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', locale);
    }
  }, [locale, i18nManager]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleLanguageChange = () => setLocale(detectLocale(appBridge));
    window.addEventListener('languagechange', handleLanguageChange);
    return () => window.removeEventListener('languagechange', handleLanguageChange);
  }, [appBridge]);

  const polarisTranslations = translations[locale] || translations.en;

  return (
    <I18nContext.Provider value={i18nManager}>
      <AppProvider i18n={polarisTranslations}>
        <AppContent />
      </AppProvider>
    </I18nContext.Provider>
  );
}

function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [oauthComplete, setOauthComplete] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState(null);
  const i18n = useAdminI18n();

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

  const loadingMarkupStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontFamily: 'Inter, sans-serif',
    color: '#1f2937'
  };

  if (loading) {
    content = (
      <div style={loadingMarkupStyle}>
        {i18n.translate('admin.common.loadingApp')}
      </div>
    );
  } else if (!user) {
    content = <Login onLogin={handleLogin} />;
  } else if (!oauthComplete) {
    content = <OAuthSetup onComplete={handleOAuthComplete} />;
  } else if (onboardingLoading || !onboardingStatus) {
    content = (
      <div style={loadingMarkupStyle}>
        {i18n.translate('admin.common.preparingDashboard')}
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
        <Route path="/mail-service" element={<MailServicePage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  const showNavigation =
    !loading && !!user && oauthComplete && onboardingStatus?.onboardingComplete;

  return (
    <BrowserRouter>
      {showNavigation && <AppNavigationMenu />}
      {content}
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AppBridgeProvider>
      <LocaleAwareApp />
    </AppBridgeProvider>
  );
}