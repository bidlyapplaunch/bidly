import React, { useEffect, useState } from 'react';
import { Banner, Spinner, Text } from '@shopify/polaris';

/**
 * App Bridge Provider Component
 * Wraps the app with Shopify App Bridge functionality
 * Handles authentication and iframe communication
 */
const AppBridgeWrapper = ({ children }) => {
  const [appBridgeConfig, setAppBridgeConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
                             window.location.hostname.includes('ngrok') ||
                             window.location.hostname.includes('trycloudflare');
        
        if (isDevelopment) {
          console.log('🔧 Development mode: No shop parameter, using default config');
          setAppBridgeConfig({
            apiKey: '1f94308027df312cd5f038e7fb75cc16', // Your API key
            shopOrigin: 'ezza-auction.myshopify.com',
            forceRedirect: false // Don't force redirect in development
          });
          setLoading(false);
          return;
        }
        setError('No shop parameter found in URL');
        setLoading(false);
        return;
      }

      // For embedded apps, use the parameters directly from Shopify
      if (embedded === '1' && idToken && host) {
        console.log('🔐 Using Shopify embedded app authentication');
        setAppBridgeConfig({
          apiKey: '1f94308027df312cd5f038e7fb75cc16', // Your API key
          shopOrigin: `https://${shop}`,
          forceRedirect: true,
          // Shopify embedded app specific config
          host: host,
          idToken: idToken
        });
      } else {
        // Fallback to hardcoded configuration (bypass backend for now)
        console.log('🔧 Using hardcoded App Bridge config for shop:', shop);
        setAppBridgeConfig({
          apiKey: '4d6fd182c13268701d61dc45f76c735e', // New client ID
          shopOrigin: `https://${shop}`,
          forceRedirect: true
        });
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
