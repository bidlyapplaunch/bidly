import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppBridge } from '@shopify/app-bridge-react';
import { NavigationMenu } from '@shopify/app-bridge/actions';

const AppNavigationMenu = () => {
  const app = useAppBridge();
  const location = useLocation();

  useEffect(() => {
    if (!app) return;
    const navigationMenu = NavigationMenu.create(app);

    const query = window.location.search || '';
    const withQuery = (path) => `${path}${query}`;

    const items = [
      { label: 'Dashboard', destination: withQuery('/') },
      { label: 'Widget styles', destination: withQuery('/customization/widget') },
      { label: 'Marketplace styles', destination: withQuery('/customization/marketplace') },
      { label: 'Plans', destination: withQuery('/plans') }
    ];

    const activeDestination = `${location.pathname}${query}`;

    navigationMenu.dispatch(NavigationMenu.Action.SET, {
      items,
      active: activeDestination
    });

    console.log('🧭 Navigation menu dispatched', { items, active: activeDestination });
  }, [app, location]);

  return null;
};

export default AppNavigationMenu;

