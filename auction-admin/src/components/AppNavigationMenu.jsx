import { useEffect, useMemo, useState } from 'react';
import createApp from '@shopify/app-bridge';
import { useLocation } from 'react-router-dom';
import { NavigationMenu } from '@shopify/app-bridge/actions';

const ensureNavigationMenu = (app) => {
  if (!app) {
    return null;
  }

  if (!window.__APP_BRIDGE_NAV_MENU__) {
    window.__APP_BRIDGE_NAV_MENU__ = NavigationMenu.create(app);
    console.log('🧭 Created App Bridge navigation menu');
  }

  return window.__APP_BRIDGE_NAV_MENU__;
};

const resolveDestination = (path) => path;

const AppNavigationMenu = () => {
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), [location.search]);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const app = window.__APP_BRIDGE_APP__;
    if (!app) {
      const config = window.__APP_BRIDGE_CONFIG__;
      if (config) {
        try {
          const newApp = createApp(config);
          window.__APP_BRIDGE_APP__ = newApp;
          console.log('ℹ️ App Bridge app lazily created for navigation');
          setRetryCount((prev) => prev + 1);
          return;
        } catch (error) {
          console.warn('Failed to lazily create App Bridge app', error);
        }
      }

      const timeout = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
      }, 200);
      return () => clearTimeout(timeout);
    }

    const items = [
      { label: 'Dashboard', destination: resolveDestination('/') },
      { label: 'Widget styles', destination: resolveDestination('/customization/widget') },
      { label: 'Marketplace styles', destination: resolveDestination('/customization/marketplace') },
      { label: 'Plans', destination: resolveDestination('/plans') }
    ];

    const navigationMenu = ensureNavigationMenu(app);
    if (!navigationMenu) {
      console.warn('Navigation menu not available even after ensureNavigationMenu');
      return;
    }

    const activeItem = items.find((item) => {
      try {
        const destinationUrl = new URL(item.destination, window.location.origin);
        return destinationUrl.pathname === location.pathname;
      } catch (error) {
        console.warn('Failed to parse navigation destination', item.destination, error);
        return false;
      }
    });

    navigationMenu.dispatch(NavigationMenu.Action.SET, {
      items,
      active: activeItem ? activeItem.destination : undefined
    });
    console.log('🧭 Navigation menu updated', {
      items,
      active: activeItem ? activeItem.destination : undefined
    });

    window.__APP_BRIDGE_NAV_MENU__ = navigationMenu;
  }, [location, searchParams, retryCount]);

  return null;
};

export default AppNavigationMenu;

