const MARKETPLACE_FONT_STACKS = {
  Inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  Roboto: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  Poppins: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  Montserrat: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
};

const MARKETPLACE_FONT_IMPORTS = {
  Inter: 'Inter:wght@400;500;600;700',
  Roboto: 'Roboto:wght@400;500;700',
  Poppins: 'Poppins:wght@400;500;600;700',
  Montserrat: 'Montserrat:wght@400;500;600;700'
};

const TEMPLATE_PRESETS = {
  Classic: {
    radius: 6,
    shadow: '0 2px 4px 0 rgba(15, 23, 42, 0.08)',
    spacing: '1.25rem',
    buttonPadding: '0.625rem 1.25rem'
  },
  Modern: {
    radius: 12,
    shadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
    spacing: '1.5rem',
    buttonPadding: '0.75rem 1.5rem'
  },
  Minimal: {
    radius: 4,
    shadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
    spacing: '1rem',
    buttonPadding: '0.5rem 1rem'
  },
  Bold: {
    radius: 18,
    shadow: '0 18px 35px rgba(15, 23, 42, 0.18)',
    spacing: '2rem',
    buttonPadding: '1rem 2rem'
  }
};

const DEFAULT_COLORS = {
  primary: '#007bff',
  background: '#f5f5f5',
  surface: '#ffffff',
  textPrimary: '#222222',
  textSecondary: '#666666',
  border: '#dddddd',
  accent: '#00b894',
  success: '#00c851',
  error: '#ff4444',
  button: '#1f2933',
  buttonText: '#ffffff',
  gradient1: '#007bff',
  gradient2: '#0056b3'
};

export const DEFAULT_MARKETPLACE_THEME = {
  template: 'Classic',
  font: 'Inter',
  colors: { ...DEFAULT_COLORS },
  gradientEnabled: true
};

export function normalizeMarketplaceTheme(theme = {}) {
  const template = TEMPLATE_PRESETS[theme.template] ? theme.template : DEFAULT_MARKETPLACE_THEME.template;
  const font = MARKETPLACE_FONT_STACKS[theme.font] ? theme.font : DEFAULT_MARKETPLACE_THEME.font;
  const normalizedColors = {
    ...DEFAULT_COLORS,
    ...(theme.colors || {})
  };

  const gradientEnabled =
    typeof theme.gradientEnabled === 'boolean' ? theme.gradientEnabled : DEFAULT_MARKETPLACE_THEME.gradientEnabled;

  return {
    template,
    font,
    colors: normalizedColors,
    gradientEnabled
  };
}

export function buildMarketplaceCSS(themeInput = DEFAULT_MARKETPLACE_THEME) {
  const theme = normalizeMarketplaceTheme(themeInput);
  const templateTokens = TEMPLATE_PRESETS[theme.template];
  const fontStack = MARKETPLACE_FONT_STACKS[theme.font];
  const googleFont = MARKETPLACE_FONT_IMPORTS[theme.font];
  const fontImport = googleFont ? `@import url('https://fonts.googleapis.com/css2?family=${googleFont}&display=swap');\n` : '';

  const css = `
${fontImport}
:root {
  --bidly-marketplace-color-primary: ${theme.colors.primary};
  --bidly-marketplace-color-background: ${theme.colors.background};
  --bidly-marketplace-color-surface: ${theme.colors.surface};
  --bidly-marketplace-color-text-primary: ${theme.colors.textPrimary};
  --bidly-marketplace-color-text-secondary: ${theme.colors.textSecondary};
  --bidly-marketplace-color-border: ${theme.colors.border};
  --bidly-marketplace-color-accent: ${theme.colors.accent};
  --bidly-marketplace-color-success: ${theme.colors.success};
  --bidly-marketplace-color-error: ${theme.colors.error};
  --bidly-marketplace-color-button: ${theme.colors.button};
  --bidly-marketplace-color-button-text: ${theme.colors.buttonText};
  --bidly-marketplace-color-gradient1: ${theme.colors.gradient1};
  --bidly-marketplace-color-gradient2: ${theme.colors.gradient2};
  --bidly-marketplace-font-family: ${fontStack};
  --bidly-marketplace-border-radius: ${templateTokens.radius}px;
  --bidly-marketplace-shadow: ${templateTokens.shadow};
  --bidly-marketplace-spacing: ${templateTokens.spacing};
  --bidly-marketplace-button-padding: ${templateTokens.buttonPadding};
  --bidly-marketplace-template: '${theme.template}';
  --bidly-marketplace-gradient-enable: ${theme.gradientEnabled ? 1 : 0};
  --bidly-marketplace-primary-hover: color-mix(in srgb, ${theme.colors.primary} 85%, #000000);
  --bidly-marketplace-primary-light: color-mix(in srgb, ${theme.colors.primary} 90%, #ffffff);
  --bidly-marketplace-gradient: linear-gradient(140deg, ${theme.colors.gradient1}, ${theme.colors.gradient2});
  --pc-box-background: ${theme.colors.primary};
}

.bidly-marketplace-root,
.bidly-marketplace-root * {
  font-family: var(--bidly-marketplace-font-family);
}

.bidly-marketplace-root {
  background: var(--bidly-marketplace-color-background);
  color: var(--bidly-marketplace-color-text-primary);
  min-height: 100vh;
  padding-bottom: calc(var(--bidly-marketplace-spacing) * 2);
  transition: background 200ms ease, color 200ms ease;
  --pc-box-background: var(--bidly-marketplace-color-primary);
}

.bidly-marketplace-root .Polaris-Card .Polaris-Box {
  --pc-box-background: var(--bidly-marketplace-color-primary);
  background: var(--bidly-marketplace-color-primary);
}

.bidly-marketplace-root[data-bidly-marketplace-gradient="1"] {
  background: var(--bidly-marketplace-gradient);
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
  background: var(--bidly-marketplace-color-surface);
  border-radius: var(--bidly-marketplace-border-radius);
  border: 1px solid var(--bidly-marketplace-color-border);
  box-shadow: var(--bidly-marketplace-shadow);
  transition: box-shadow 150ms ease, transform 150ms ease;
}

.bidly-marketplace-root .Polaris-Card:hover {
  transform: translateY(-2px);
  box-shadow: 0 25px 45px rgba(15, 23, 42, 0.12);
}

.bidly-marketplace-root .Polaris-Text--subdued,
.bidly-marketplace-root .Polaris-Labelled__HelpText,
.bidly-marketplace-root .Polaris-Text--toneSubdued {
  color: var(--bidly-marketplace-color-text-secondary);
}

.bidly-marketplace-root .Polaris-Button--primary {
  background: var(--bidly-marketplace-color-primary);
  border-color: var(--bidly-marketplace-color-primary);
  color: #ffffff;
  padding: var(--bidly-marketplace-button-padding);
  border-radius: calc(var(--bidly-marketplace-border-radius) - 4px);
}

.bidly-marketplace-root .Polaris-Button--primary:hover,
.bidly-marketplace-root .Polaris-Button--primary:focus {
  background: var(--bidly-marketplace-primary-hover);
  border-color: var(--bidly-marketplace-primary-hover);
}

.bidly-marketplace-root .Polaris-Button.Polaris-Button--variantSecondary {
  background: var(--bidly-marketplace-color-button);
  border-color: var(--bidly-marketplace-color-button);
  color: var(--bidly-marketplace-color-button-text);
}

.bidly-marketplace-root .Polaris-Button.Polaris-Button--variantSecondary:hover,
.bidly-marketplace-root .Polaris-Button.Polaris-Button--variantSecondary:focus {
  background: color-mix(in srgb, var(--bidly-marketplace-color-button) 90%, #000000);
  border-color: color-mix(in srgb, var(--bidly-marketplace-color-button) 85%, #000000);
}

.bidly-marketplace-root .Polaris-Button {
  border-radius: calc(var(--bidly-marketplace-border-radius) - 6px);
}

.bidly-marketplace-root .Polaris-Badge--statusSuccess,
.bidly-marketplace-root .Polaris-Badge--statusInfo,
.bidly-marketplace-root .Polaris-Badge--statusAttention {
  background: var(--bidly-marketplace-color-accent);
  color: #ffffff;
  border: none;
}

.bidly-marketplace-root .Polaris-Badge--statusCritical {
  background: var(--bidly-marketplace-color-error);
  color: #ffffff;
  border: none;
}

.bidly-marketplace-root .Polaris-Layout {
  gap: var(--bidly-marketplace-spacing);
}

.bidly-marketplace-root .Polaris-Text--root.Polaris-Text--headingLg,
.bidly-marketplace-root .Polaris-Text--root.Polaris-Text--headingLg.Polaris-Text--bold,
.bidly-marketplace-root .Polaris-Text--root.Polaris-Text--bodyMd.Polaris-Text--bold {
  color: var(--bidly-marketplace-color-text-primary);
}

.bidly-marketplace-root .Polaris-Text--root.Polaris-Text--bodyLg,
.bidly-marketplace-root .Polaris-Text--root.Polaris-Text--bodySm {
  color: var(--bidly-marketplace-color-text-secondary);
}

.bidly-marketplace-root .Polaris-Text--root.Polaris-Text--bodySm.Polaris-Text--medium {
  color: var(--bidly-marketplace-color-button-text);
}

.bidly-marketplace-root[data-bidly-marketplace-template="Classic"] .Polaris-Card {
  border: 1px solid rgba(148, 163, 184, 0.28);
}

.bidly-marketplace-root[data-bidly-marketplace-template="Modern"] .Polaris-Card {
  border: 1px solid rgba(148, 163, 184, 0.22);
}

.bidly-marketplace-root[data-bidly-marketplace-template="Bold"] .Polaris-Button--primary {
  border-radius: 999px;
}

.bidly-marketplace-root .Polaris-Modal-Dialog__Modal.Polaris-Modal-Dialog__Modal--sizeLarge {
  border-radius: calc(var(--bidly-marketplace-border-radius) + 4px);
}

.bidly-marketplace-root .Polaris-Modal-Section {
  background: var(--bidly-marketplace-color-surface);
}

.bidly-marketplace-root .Polaris-TextField {
  border-color: var(--bidly-marketplace-color-border);
}

.bidly-marketplace-root .Polaris-Toast {
  border-radius: calc(var(--bidly-marketplace-border-radius) - 6px);
  background: var(--bidly-marketplace-color-surface);
  color: var(--bidly-marketplace-color-text-primary);
}

.bidly-marketplace-root .Polaris-Spinner {
  --pc-spinner-color: var(--bidly-marketplace-color-accent);
}

@media (max-width: 768px) {
  .bidly-marketplace-root .Polaris-Page__Header {
    padding-inline: 16px;
  }

  .bidly-marketplace-root .Polaris-Card {
    border-radius: calc(var(--bidly-marketplace-border-radius) - 4px);
  }
}
`;

  return css;
}

export default {
  DEFAULT_MARKETPLACE_THEME,
  normalizeMarketplaceTheme,
  buildMarketplaceCSS
};

