const BOX_SHADOWS = {
  none: 'none',
  subtle: '0 6px 18px rgba(15, 23, 42, 0.08)',
  medium: '0 18px 45px rgba(15, 23, 42, 0.14)'
};

const DEFAULT_THEME = {
  template: 'A',
  font: 'Inter',
  colors: {
    accent: '#2563eb',
    text: '#111827',
    bg_solid: '#f9fafb',
    bg_gradient_start: '#e0f2fe',
    bg_gradient_end: '#c7d2fe',
    button_bg: '#2563eb',
    button_hover: '#1d4ed8',
    button_text: '#ffffff',
    border: '#d4d8dd'
  },
  borderRadius: 16,
  boxShadow: 'subtle',
  gradientEnabled: false
};

const DEFAULT_ERROR_COLOR = '#ef4444';

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

const withAlpha = (hexColor, alpha) => {
  if (!hexColor || typeof hexColor !== 'string') {
    return hexColor;
  }
  const value = hexColor.replace('#', '');
  if (value.length !== 6) {
    return hexColor;
  }
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const normalizeTheme = (theme = {}) => {
  const normalized = {
    template: theme.template || DEFAULT_THEME.template,
    font: theme.font || DEFAULT_THEME.font,
    borderRadius: theme.borderRadius || DEFAULT_THEME.borderRadius,
    boxShadow: theme.boxShadow || DEFAULT_THEME.boxShadow,
    gradientEnabled: typeof theme.gradientEnabled === 'boolean'
      ? theme.gradientEnabled
      : DEFAULT_THEME.gradientEnabled
  };

  normalized.colors = Object.assign({}, DEFAULT_THEME.colors, theme.colors || {});
  return normalized;
};

const buildMarketplaceCSS = (theme) => {
  const colors = theme.colors;
  const textSecondary = withAlpha(colors.text, 0.65);
  const boxShadow = BOX_SHADOWS[theme.boxShadow] || BOX_SHADOWS[DEFAULT_THEME.boxShadow];
  const font = (theme.font || DEFAULT_THEME.font).replace(/'/g, "\\'");

  return `
:root {
  --bidly-color-text-primary: ${colors.text};
  --bidly-color-text-secondary: ${textSecondary};
  --bidly-color-surface: ${colors.bg_solid};
  --bidly-color-background: ${colors.bg_solid};
  --bidly-color-border: ${colors.border};
  --bidly-color-accent: ${colors.accent};
  --bidly-color-success: ${colors.accent};
  --bidly-color-error: ${DEFAULT_ERROR_COLOR};
  --bidly-color-button-bg: ${colors.button_bg};
  --bidly-color-button-hover: ${colors.button_hover};
  --bidly-color-button-text: ${colors.button_text};
  --bidly-marketplace-font-family: '${font}', sans-serif;
  --bidly-marketplace-shadow: ${boxShadow};
  --bidly-marketplace-radius: ${theme.borderRadius}px;
  --bidly-marketplace-gradient-start: ${colors.bg_gradient_start};
  --bidly-marketplace-gradient-end: ${colors.bg_gradient_end};
  --bidly-marketplace-gradient-enable: ${theme.gradientEnabled ? 1 : 0};

  --p-color-text: var(--bidly-color-text-primary);
  --p-color-text-subdued: var(--bidly-color-text-secondary);
  --p-color-bg-surface: var(--bidly-color-surface);
  --p-color-border: var(--bidly-color-border);
  --p-color-bg-primary: var(--bidly-color-button-bg);
  --p-color-bg-primary-hover: var(--bidly-color-button-hover);
  --p-color-text-on-primary: var(--bidly-color-button-text);
}

.bidly-marketplace-root {
  background: var(--bidly-color-background);
  color: var(--bidly-color-text-primary);
  min-height: 100vh;
  padding-bottom: 40px;
  font-family: var(--bidly-marketplace-font-family);
}

.bidly-marketplace-root .Polaris-Page {
  background: transparent;
}

.bidly-marketplace-root .Polaris-Card {
  background: var(--bidly-color-surface);
  border-radius: var(--bidly-marketplace-radius);
  border: 1px solid var(--bidly-color-border);
  box-shadow: var(--bidly-marketplace-shadow);
}

.bidly-marketplace-root .Polaris-Text--subdued,
.bidly-marketplace-root .Polaris-Labelled__HelpText {
  color: var(--bidly-color-text-secondary);
}

.bidly-marketplace-root .Polaris-Button--primary {
  background: var(--bidly-color-button-bg);
  border-color: var(--bidly-color-button-bg);
  color: var(--bidly-color-button-text);
}

.bidly-marketplace-root .Polaris-Button--primary:hover,
.bidly-marketplace-root .Polaris-Button--primary:focus {
  background: var(--bidly-color-button-hover);
  border-color: var(--bidly-color-button-hover);
  color: var(--bidly-color-button-text);
}

.bidly-marketplace-root .Polaris-Badge--statusSuccess {
  background: var(--bidly-color-success);
  color: #ffffff;
}

.bidly-marketplace-root .Polaris-Badge--statusInfo {
  background: var(--bidly-color-accent);
  color: #ffffff;
}

.bidly-marketplace-root[data-bidly-marketplace-gradient="1"] .bidly-marketplace-hero {
  background: linear-gradient(135deg, var(--bidly-marketplace-gradient-start), var(--bidly-marketplace-gradient-end));
  color: var(--bidly-color-button-text);
}

.bidly-marketplace-root[data-bidly-marketplace-gradient="0"] .bidly-marketplace-hero {
  background: var(--bidly-color-surface);
  color: var(--bidly-color-text-primary);
}
`;
};

class ThemeService {
  constructor() {
    this.theme = normalizeTheme(DEFAULT_THEME);
    this.themeLoaded = false;
  }

  async loadTheme(shopDomain) {
    try {
      const shop = shopDomain || getShopFromURL();
      const backendUrl = resolveBackendUrl(shop);
      const response = await fetch(`${backendUrl}/api/customization/marketplace?shop=${encodeURIComponent(shop)}`);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.settings) {
          const theme = normalizeTheme(data.settings);
          this.applyTheme(theme);
          this.themeLoaded = true;
          console.log('ThemeService: Marketplace theme loaded');
          return theme;
        }
      }

      console.warn('ThemeService: Falling back to default marketplace theme');
      this.applyTheme(normalizeTheme(DEFAULT_THEME));
      return DEFAULT_THEME;
    } catch (error) {
      console.error('ThemeService: Failed to load marketplace theme', error);
      this.applyTheme(normalizeTheme(DEFAULT_THEME));
      return DEFAULT_THEME;
    }
  }

  applyTheme(theme) {
    this.theme = theme;
    this.themeLoaded = true;

    document.body.classList.add('bidly-marketplace-root');
    document.body.setAttribute('data-bidly-marketplace-template', theme.template || 'A');
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

