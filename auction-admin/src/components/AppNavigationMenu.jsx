import { useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppBridge } from '@shopify/app-bridge-react';
import { NavigationMenu } from '@shopify/app-bridge/actions';
import useAdminI18n from '../hooks/useAdminI18n';

const AppNavigationMenu = () => {
  const i18n = useAdminI18n();
  const app = useAppBridge();
  const location = useLocation();
  const navigate = useNavigate();

  const bindLogoNavigation = useCallback(() => {
    const logoSelector =
      '.Polaris-TopBar__Logo a, .Polaris-TopBar__Logo button, .Polaris-Breadcrumbs__IconWrapper, .Polaris-Breadcrumbs__BreadcrumbImageWrapper';
    let detachHandlers = [];

    const attach = () => {
      if (detachHandlers.length) {
        detachHandlers.forEach((cleanup) => cleanup());
        detachHandlers = [];
      }

      const elements = document.querySelectorAll(logoSelector);
      if (!elements.length) {
        return;
      }

      const handleLogoClick = (event) => {
        event.preventDefault();
        const search = window.location.search || '';
        const target = search ? `/${search}` : '/';
        navigate(target);
      };

      elements.forEach((element) => {
        element.addEventListener('click', handleLogoClick);
        detachHandlers.push(() => element.removeEventListener('click', handleLogoClick));
      });
    };

    attach();

    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      detachHandlers.forEach((cleanup) => cleanup());
      detachHandlers = [];
    };
  }, [navigate]);

  useEffect(() => bindLogoNavigation(), [bindLogoNavigation]);

  useEffect(() => {
    if (!app) return;
    const navigationMenu = NavigationMenu.create(app);

    const query = window.location.search || '';
    const withQuery = (path) => `${path}${query}`;

    const items = [
      { label: i18n.translate('admin.nav.dashboard'), destination: withQuery('/') },
      { label: i18n.translate('admin.nav.widgetStyles'), destination: withQuery('/customization/widget') },
      { label: i18n.translate('admin.nav.marketplaceStyles'), destination: withQuery('/customization/marketplace') },
      { label: i18n.translate('admin.nav.mailService'), destination: withQuery('/mail-service') },
      { label: i18n.translate('admin.nav.plans'), destination: withQuery('/plans') }
    ];

    const activeDestination = `${location.pathname}${query}`;

    navigationMenu.dispatch(NavigationMenu.Action.SET, {
      items,
      active: activeDestination
    });

    console.log('🧭 Navigation menu dispatched', { items, active: activeDestination });
  }, [app, i18n, location]);

  return null;
};

export default AppNavigationMenu;

