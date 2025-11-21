import React, { useEffect, useState } from 'react';
import createApp from '@shopify/app-bridge';
import useAdminI18n from '../hooks/useAdminI18n';

const AppBridgeProvider = ({ children }) => {
  const i18n = useAdminI18n();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const shop = urlParams.get('shop');
      const host = urlParams.get('host');

      console.log('🔍 App Bridge initialization:', {
        shop,
        host,
        url: window.location.href,
        isInIframe: window !== window.top
      });

      const isDevelopment =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('onrender.com') ||
        window.location.hostname.includes('trycloudflare');

      if (!shop && !isDevelopment) {
        setError(i18n.translate('admin.common.appBridge.missingShop'));
        setLoading(false);
        return;
      }

      if (!shop && isDevelopment) {
        const devConfig = {
          apiKey: '1f94308027df312cd5f038e7fb75cc16',
          host,
          shopOrigin: 'https://ezza-auction.myshopify.com',
          forceRedirect: false
        };
        window.__APP_BRIDGE_CONFIG__ = devConfig;
        setConfig(devConfig);
        setLoading(false);
        return;
      }

      const resolvedConfig = {
        apiKey: '4d6fd182c13268701d61dc45f76c735e',
        host,
        shopOrigin: `https://${shop}`,
        forceRedirect: !!host
      };

      window.__APP_BRIDGE_CONFIG__ = resolvedConfig;
      setConfig(resolvedConfig);
      setLoading(false);
    } catch (err) {
      console.error('❌ App Bridge initialization error:', err);
      setError(err.message || i18n.translate('admin.common.appBridge.initializationFailed'));
      setLoading(false);
    }
  }, [i18n]);

  useEffect(() => {
    if (!config || typeof window === 'undefined') {
      return;
    }

    if (ready) {
      return;
    }

    try {
      // If Shopify already injected an app bridge instance, reuse it
      if (window.shopify && typeof window.shopify.dispatch === 'function') {
        setReady(true);
        return;
      }

      if (!config.host) {
        console.warn('⚠️ App Bridge host parameter missing; skipping initialization');
        setReady(true);
        return;
      }

      const app = createApp(config);
      // Expose the app instance for libraries like @shopify/app-bridge-react
      window.shopify = app;
      setReady(true);
    } catch (err) {
      console.warn('⚠️ Shopify App Bridge unavailable in this context:', err);
      setReady(true);
    }
  }, [config, ready]);

  const fullHeightMessageStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontFamily: 'Inter, sans-serif',
    color: '#1f2937'
  };

  if (loading) {
    return (
      <div style={fullHeightMessageStyle}>
        {i18n.translate('admin.common.appBridge.initializing')}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '24px',
        maxWidth: '600px',
        margin: '80px auto',
        border: '1px solid #fca5a5',
        borderRadius: '12px',
        background: '#fef2f2',
        color: '#991b1b',
        fontFamily: 'Inter, sans-serif'
      }}>
        <h2 style={{ marginTop: 0 }}>{i18n.translate('admin.common.appBridge.errorTitle')}</h2>
        <p>{error}</p>
        <p>{i18n.translate('admin.common.appBridge.openFromAdmin')}</p>
      </div>
    );
  }

  if (!config) {
    return null;
  }

  if (!ready) {
    return (
      <div style={fullHeightMessageStyle}>
        {i18n.translate('admin.common.appBridge.connecting')}
      </div>
    );
  }

  return <>{children}</>;
};

export default AppBridgeProvider;
