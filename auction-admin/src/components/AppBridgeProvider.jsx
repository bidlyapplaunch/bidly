import React, { useEffect, useState } from 'react';
import { Banner, Spinner, Text } from '@shopify/polaris';
import createApp from '@shopify/app-bridge';

/**
 * App Bridge Provider Component
 * Wraps the app with Shopify App Bridge functionality
 * Handles authentication and iframe communication
 */
const AppBridgeWrapper = ({ children }) => {
  const [appBridgeConfig, setAppBridgeConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [appInstance, setAppInstance] = useState(null);

  useEffect(() => {
    initializeAppBridge();
  }, []);

  const initializeAppBridge = async () => {
    try {
      // Get parameters from URL
      const urlParams = new URLSearchParams(window.location.search);
      const shop = urlParams.get('shop');
      const embedded = urlParams.get('embedded');
      const hmac = urlParams.get('hmac');
      const host = urlParams.get('host');
      const idToken = urlParams.get('id_token');
      const session = urlParams.get('session');
      
      console.log('🔍 App Bridge initialization:', {
        shop,
        embedded,
        hasHmac: !!hmac,
        hasHost: !!host,
        hasIdToken: !!idToken,
        hasSession: !!session,
        url: window.location.href,
        isInIframe: window !== window.top
      });
      
      if (!shop) {
        // For development, allow running without shop parameter
               const isDevelopment = window.location.hostname === 'localhost' || 
                                  window.location.hostname === '127.0.0.1' ||
                                  window.location.hostname.includes('onrender.com') ||
                                  window.location.hostname.includes('trycloudflare');
        
        if (isDevelopment) {
          console.log('🔧 Development mode: No shop parameter, using default config');
          const devConfig = {
            apiKey: '1f94308027df312cd5f038e7fb75cc16',
            host,
            shopOrigin: 'https://ezza-auction.myshopify.com',
            forceRedirect: false
          };
          setAppBridgeConfig(devConfig);
          if (host) {
            const app = createApp({
              apiKey: devConfig.apiKey,
              host,
              forceRedirect: devConfig.forceRedirect
            });
            window.__APP_BRIDGE_APP__ = app;
            setAppInstance(app);
          }
          setLoading(false);
          return;
        }
        setError('No shop parameter found in URL');
        setLoading(false);
        return;
      }

      // Always use hardcoded configuration (bypass backend completely)
      console.log('🔧 Using hardcoded App Bridge config for shop:', shop);
      const config = {
        apiKey: '4d6fd182c13268701d61dc45f76c735e',
        host,
        shopOrigin: `https://${shop}`,
        forceRedirect: true
      };
      setAppBridgeConfig(config);

      if (host) {
        const app = createApp({
          apiKey: config.apiKey,
          host,
          forceRedirect: true
        });
        window.__APP_BRIDGE_APP__ = app;
        setAppInstance(app);
      } else {
        console.warn('Shopify host parameter missing. App Bridge navigation will not initialize.');
      }

      console.log('✅ App Bridge initialized for shop:', shop);
      setLoading(false);
    } catch (err) {
      console.error('❌ App Bridge initialization error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <Spinner size="large" />
        <Text variant="bodyMd">Initializing Shopify App Bridge...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <Banner status="critical" title="App Initialization Error">
          <p>{error}</p>
          <p>Please ensure you're accessing this app through the Shopify admin panel.</p>
        </Banner>
      </div>
    );
  }

  if (!appBridgeConfig) {
    return (
      <div style={{ padding: '20px' }}>
        <Banner status="warning" title="Configuration Error">
          <p>Unable to load app configuration. Please try refreshing the page.</p>
        </Banner>
      </div>
    );
  }

  // For now, just render children directly since Provider is not available
  // App Bridge will be initialized in individual components as needed
  return <>{children}</>;
};

export default AppBridgeWrapper;
