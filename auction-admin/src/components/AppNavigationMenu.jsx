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
    navigationMenu.dispatch(NavigationMenu.Action.SET, {
      items: [
        { label: 'Dashboard', destination: '/'},
        { label: 'Widget styles', destination: '/customization/widget'},
        { label: 'Marketplace styles', destination: '/customization/marketplace'},
        { label: 'Plans', destination: '/plans'}
      ],
      active: location.pathname
    });
  }, [app, location]);

  return null;
};

export default AppNavigationMenu;

