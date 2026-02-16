// Admin app entry point
// Use window.console directly to bypass debug filter
if (typeof window !== 'undefined' && window.console) {
  window.console.warn('🚀🚀🚀 App.jsx MODULE LOADING 🚀🚀🚀');
}
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
  // Try multiple sources for locale detection
  let detectedLocale = null;

  // 1. Try App Bridge localization (if available)
  try {
    if (appBridge?.localization?.language) {
      detectedLocale = appBridge.localization.language;
    }
  } catch (e) {
    // App Bridge might not be ready
  }

  // 2. Try App Bridge state
  try {
    if (!detectedLocale && appBridge?.getState) {
      const state = appBridge.getState();
      if (state?.localization?.language) {
        detectedLocale = state.localization.language;
      }
    }
  } catch (e) {
    // State might not be available
  }

  // 3. Try window.Shopify.locale (Shopify admin context)
  if (!detectedLocale && typeof window !== 'undefined') {
    if (window.Shopify?.locale) {
      detectedLocale = window.Shopify.locale;
    }
    // Also try parent window (for embedded apps in iframe)
    try {
      if (window.parent && window.parent !== window && window.parent.Shopify?.locale) {
        detectedLocale = window.parent.Shopify.locale;
      }
    } catch (e) {
      // Cross-origin restriction, ignore
    }
  }

  // 3.5. Try URL parameters (Shopify might pass locale)
  if (!detectedLocale && typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const urlLocale = urlParams.get('locale') || urlParams.get('lang');
    if (urlLocale) {
      detectedLocale = urlLocale;
    }
  }

  // 4. Try document language attribute
  if (!detectedLocale && typeof document !== 'undefined') {
    const docLang = document.documentElement.getAttribute('lang');
    if (docLang) {
      detectedLocale = docLang;
    }
  }

  // 5. Try navigator language
  if (!detectedLocale && typeof navigator !== 'undefined') {
    detectedLocale = navigator.language;
  }

  // Extract base language code (e.g., 'es' from 'es-ES')
  const baseLocale = detectedLocale ? detectedLocale.split('-')[0].toLowerCase() : 'en';
  
  // Normalize to supported locale
  const supportedLocales = ['en', 'pl', 'de', 'es', 'fr', 'it', 'nl', 'ar', 'ja', 'ko'];
  return supportedLocales.includes(baseLocale) ? baseLocale : 'en';
}

function LocaleAwareApp() {
  const appBridge = useAppBridge();
  const initialLocale = detectLocale(appBridge);
  const [locale, setLocale] = useState(initialLocale);
  const [i18nManager] = useState(
    () =>
      new I18nManager({
        locale: initialLocale,
        fallbackLocale: 'en'
      })
  );

  useEffect(() => {
    // Re-detect locale when App Bridge becomes available
    const newLocale = detectLocale(appBridge);
    if (newLocale !== locale) {
      console.log(`🌐 Locale detected: ${newLocale} (was: ${locale})`);
      setLocale(newLocale);
    }
  }, [appBridge, locale]);

  useEffect(() => {
    console.log(`🔄 Updating I18nManager with locale: ${locale}`);
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
  console.log(`🎨 Using Polaris translations for locale: ${locale}`, Object.keys(polarisTranslations).length > 0 ? '✅' : '❌');

  return (
    <I18nContext.Provider value={i18nManager}>
      <AppProvider i18n={polarisTranslations} locale={locale}>
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
          // Ensure response has expected structure
          setOnboardingStatus({
            success: response?.success !== false,
            onboardingComplete: response?.onboardingComplete || response?.data?.onboardingComplete || true,
            widgetActive: response?.widgetActive || response?.data?.widgetActive || false,
            ...response
          });
        }
      } catch (error) {
        console.error('Failed to load onboarding status', error);
        if (isMounted) {
          // Default to completed so dashboard can load
          setOnboardingStatus({ 
            success: true,
            onboardingComplete: true,
            widgetActive: false
          });
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

  // Use window.console directly to bypass debug filter
  if (typeof window !== 'undefined' && window.console) {
    window.console.warn('🔴 App.jsx render state:', { loading, user: !!user, oauthComplete, onboardingLoading, onboardingStatus: !!onboardingStatus });
  }

  if (loading) {
    if (typeof window !== 'undefined' && window.console) {
      window.console.warn('🔴 App.jsx: Showing loading screen');
    }
    content = (
      <div style={loadingMarkupStyle}>
        {i18n.translate('admin.common.loadingApp')}
      </div>
    );
  } else if (!user) {
    if (typeof window !== 'undefined' && window.console) {
      window.console.warn('🔴 App.jsx: Showing login screen');
    }
    content = <Login onLogin={handleLogin} />;
  } else if (!oauthComplete) {
    if (typeof window !== 'undefined' && window.console) {
      window.console.warn('🔴 App.jsx: Showing OAuth setup');
    }
    content = <OAuthSetup onComplete={handleOAuthComplete} />;
  } else if (onboardingLoading || !onboardingStatus) {
    if (typeof window !== 'undefined' && window.console) {
      window.console.warn('🔴 App.jsx: Showing preparing dashboard (onboardingLoading:', onboardingLoading, 'onboardingStatus:', onboardingStatus, ')');
    }
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