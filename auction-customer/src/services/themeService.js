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

const FONT_IMPORTS = {
  Inter: 'Inter:wght@400;500;600;700',
  Poppins: 'Poppins:wght@400;500;600;700',
  Roboto: 'Roboto:wght@400;500;700',
  Lato: 'Lato:wght@400;500;700'
};

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
    template: (theme.template || DEFAULT_THEME.template || 'A').toUpperCase(),
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
  const googleFont = FONT_IMPORTS[theme.font] || FONT_IMPORTS[DEFAULT_THEME.font];
  const fontImport = googleFont ? `@import url('https://fonts.googleapis.com/css2?family=${googleFont}&display=swap');` : '';

  return `
${fontImport}

.bidly-marketplace-root {
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
  --bidly-marketplace-font-family: '${font}', Poppins, Inter, Roboto, Lato, -apple-system, BlinkMacSystemFont, sans-serif;
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

.bidly-marketplace-root,
.bidly-marketplace-root * {
  font-family: var(--bidly-marketplace-font-family);
}

.bidly-marketplace-root {
  background: var(--bidly-color-background);
  color: var(--bidly-color-text-primary);
  min-height: 100vh;
  padding-bottom: 40px;
  transition: background 200ms ease, color 200ms ease;
}

.bidly-marketplace-root[data-bidly-marketplace-gradient="1"] {
  background: linear-gradient(140deg, var(--bidly-marketplace-gradient-start), var(--bidly-marketplace-gradient-end));
  background-attachment: fixed;
}

.bidly-marketplace-root .Polaris-Frame {
  background: transparent;
}

.bidly-marketplace-root .Polaris-Page {
  background: transparent;
}

.bidly-marketplace-root .Polaris-Page__Content,
.bidly-marketplace-root .Polaris-Page__Header {
  max-width: 1120px;
  margin-inline: auto;
}

.bidly-marketplace-root .Polaris-Card {
  background: var(--bidly-color-surface);
  border-radius: var(--bidly-marketplace-radius);
  border: 1px solid var(--bidly-color-border);
  box-shadow: var(--bidly-marketplace-shadow);
  transition: box-shadow 150ms ease, transform 150ms ease;
}

.bidly-marketplace-root .Polaris-Card:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.1);
}

.bidly-marketplace-root .Polaris-Text--subdued,
.bidly-marketplace-root .Polaris-Labelled__HelpText,
.bidly-marketplace-root .Polaris-Text--toneSubdued {
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

.bidly-marketplace-root .Polaris-Button {
  border-radius: calc(var(--bidly-marketplace-radius) - 4px);
}

.bidly-marketplace-root .Polaris-Badge--statusSuccess,
.bidly-marketplace-root .Polaris-Badge--statusInfo,
.bidly-marketplace-root .Polaris-Badge--statusAttention {
  background: var(--bidly-color-accent);
  color: #ffffff;
  border: none;
  box-shadow: none;
}

.bidly-marketplace-root .Polaris-Badge--statusCritical {
  background: var(--bidly-color-error);
  color: #ffffff;
  border: none;
}

.bidly-marketplace-root .Polaris-Layout {
  gap: 24px;
}

.bidly-marketplace-root .Polaris-Layout__Section {
  min-width: 0;
}

.bidly-marketplace-root .Polaris-Text--headingLg,
.bidly-marketplace-root .Polaris-Text--headingMd,
.bidly-marketplace-root .Polaris-Text--headingSm {
  color: var(--bidly-color-text-primary);
}

.bidly-marketplace-root .Polaris-Text--bodyMd,
.bidly-marketplace-root .Polaris-Text--bodySm,
.bidly-marketplace-root .Polaris-Text--bodyLg {
  color: var(--bidly-color-text-secondary);
}

.bidly-marketplace-root .Polaris-Button:disabled {
  opacity: 0.5;
}

/* Template adjustments */
.bidly-marketplace-root[data-bidly-marketplace-template="A"] .Polaris-Card {
  border: 1px solid rgba(148, 163, 184, 0.28);
}

.bidly-marketplace-root[data-bidly-marketplace-template="B"] {
  --bidly-marketplace-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
}

.bidly-marketplace-root[data-bidly-marketplace-template="B"] .Polaris-Card {
  backdrop-filter: blur(18px);
  border: 1px solid rgba(148, 163, 184, 0.22);
}

.bidly-marketplace-root[data-bidly-marketplace-template="C"] .Polaris-Card {
  border-radius: calc(var(--bidly-marketplace-radius) + 6px);
  border: none;
}

.bidly-marketplace-root[data-bidly-marketplace-template="D"] .Polaris-Card {
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 24px 55px rgba(15, 23, 42, 0.12);
}

.bidly-marketplace-root[data-bidly-marketplace-template="D"] .Polaris-Button--primary {
  border-radius: 999px;
}

/* Auth modal + bid forms */
.bidly-marketplace-root .Polaris-Modal-Dialog__Modal.Polaris-Modal-Dialog__Modal--sizeLarge {
  border-radius: calc(var(--bidly-marketplace-radius) + 4px);
}

.bidly-marketplace-root .Polaris-Modal-Section {
  background: var(--bidly-color-surface);
}

.bidly-marketplace-root .Polaris-TextField {
  border-color: var(--bidly-color-border);
}

.bidly-marketplace-root .Polaris-ResourceItem {
  border-bottom: 1px solid rgba(148, 163, 184, 0.24);
}

.bidly-marketplace-root .Polaris-Toast {
  border-radius: calc(var(--bidly-marketplace-radius) - 6px);
}

.bidly-marketplace-root .Polaris-Spinner {
  --pc-spinner-color: var(--bidly-color-accent);
}

@media (max-width: 768px) {
  .bidly-marketplace-root .Polaris-Page__Header {
    padding-inline: 16px;
  }

  .bidly-marketplace-root .Polaris-Card {
    border-radius: calc(var(--bidly-marketplace-radius) - 4px);
  }
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
      const fallbackTheme = normalizeTheme(DEFAULT_THEME);
      this.applyTheme(fallbackTheme);
      return fallbackTheme;
    } catch (error) {
      console.error('ThemeService: Failed to load marketplace theme', error);
      const fallbackTheme = normalizeTheme(DEFAULT_THEME);
      this.applyTheme(fallbackTheme);
      return fallbackTheme;
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

