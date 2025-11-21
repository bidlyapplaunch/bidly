import React, { useMemo, useEffect } from 'react';
import createApp from '@shopify/app-bridge';

const AppBridgeProvider = ({ children }) => {
  const host = new URLSearchParams(window.location.search).get('host') || '';
  const config = useMemo(
    () => ({
      apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
      host,
      forceRedirect: true
    }),
    [host]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!window.shopify) {
      window.shopify = createApp(config);
    }
  }, [config]);

  return <>{children}</>;
};

export default AppBridgeProvider;
