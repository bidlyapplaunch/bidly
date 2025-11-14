import { buildMarketplaceCSS, normalizeMarketplaceTheme, DEFAULT_MARKETPLACE_THEME } from '@shared/marketplaceTheme.js';

const getShopFromURL = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('shop') || 'ezza-auction.myshopify.com';
};

const resolveBackendUrl = (shopDomain) => {
  if (window.BidlyBackendConfig && typeof window.BidlyBackendConfig.getBackendUrl === 'function') {
    return window.BidlyBackendConfig.getBackendUrl(shopDomain);
  }
  return 'https://bidly-auction-backend.onrender.com';
};

class ThemeService {
  constructor() {
    this.theme = normalizeMarketplaceTheme(DEFAULT_MARKETPLACE_THEME);
    this.themeLoaded = false;
  }

  async loadTheme(shopDomain) {
    try {
      const shop = shopDomain || getShopFromURL();
      const backendUrl = resolveBackendUrl(shop);
      const response = await fetch(`${backendUrl}/api/marketplace-customization?shop=${encodeURIComponent(shop)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.customization) {
          const theme = normalizeMarketplaceTheme(data.customization);
          this.applyTheme(theme);
          this.themeLoaded = true;
          console.log('ThemeService: Marketplace theme loaded');
          return theme;
        }
      }
    } catch (error) {
      console.error('ThemeService: Failed to load marketplace theme', error);
    }
    console.warn('ThemeService: Falling back to default marketplace theme');
    const fallbackTheme = normalizeMarketplaceTheme(DEFAULT_MARKETPLACE_THEME);
    this.applyTheme(fallbackTheme);
    return fallbackTheme;
  }

  applyTheme(theme) {
    this.theme = theme;
    this.themeLoaded = true;

    document.body.classList.add('bidly-marketplace-root');
    document.body.setAttribute('data-bidly-marketplace-template', theme.template || 'Classic');
    document.body.setAttribute('data-bidly-marketplace-gradient', theme.gradientEnabled ? '1' : '0');

    const css = buildMarketplaceCSS(theme);
    this.injectStyle(css);
  }

  injectStyle(css) {
    const existingTheme = document.getElementById('bidly-marketplace-theme');
    if (existingTheme) {
      existingTheme.remove();
    }

    const style = document.createElement('style');
    style.id = 'bidly-marketplace-theme';
    style.textContent = css;
    document.head.appendChild(style);
  }

  isThemeLoaded() {
    return this.themeLoaded;
  }

  getCurrentTheme() {
    return this.theme;
  }
}

export default new ThemeService();

