/**
 * Theme Service
 * Handles dynamic theming for the customer frontend
 */

class ThemeService {
  constructor() {
    this.theme = null;
    this.themeLoaded = false;
  }

  /**
   * Load theme configuration from backend
   */
  async loadTheme(shopDomain) {
    try {
      if (!shopDomain) {
        console.warn('ThemeService: No shop domain provided');
        return this.getDefaultTheme();
      }

      const backendUrl = 'https://bidly-auction-backend.onrender.com';
      const response = await fetch(`${backendUrl}/api/marketplace-customization/theme?shop=${encodeURIComponent(shopDomain)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'text/css'
        }
      });

      if (response.ok) {
        const css = await response.text();
        this.applyTheme(css);
        this.themeLoaded = true;
        console.log('ThemeService: Theme loaded successfully');
        return true;
      } else {
        console.warn('ThemeService: Failed to load theme, using defaults');
        return this.getDefaultTheme();
      }
    } catch (error) {
      console.error('ThemeService: Error loading theme:', error);
      return this.getDefaultTheme();
    }
  }

  /**
   * Apply theme CSS to the document
   */
  applyTheme(css) {
    // Remove existing theme style if it exists
    const existingTheme = document.getElementById('bidly-theme');
    if (existingTheme) {
      existingTheme.remove();
    }

    // Create new style element
    const style = document.createElement('style');
    style.id = 'bidly-theme';
    style.textContent = css;
    document.head.appendChild(style);

    console.log('ThemeService: Theme applied to document');
  }

  /**
   * Get default theme configuration
   */
  getDefaultTheme() {
    const defaultCSS = `
      :root {
        --bidly-marketplace-color-primary: #007bff;
        --bidly-marketplace-color-background: #f5f5f5;
        --bidly-marketplace-color-surface: #ffffff;
        --bidly-marketplace-color-text-primary: #222222;
        --bidly-marketplace-color-text-secondary: #666666;
        --bidly-marketplace-color-border: #dddddd;
        --bidly-marketplace-color-accent: #00b894;
        --bidly-marketplace-color-success: #00c851;
        --bidly-marketplace-color-error: #ff4444;
        --bidly-marketplace-color-hover: #0056b3;
        --bidly-marketplace-font-family: 'Inter', sans-serif;
        --bidly-marketplace-template: 'Classic';
        --bidly-marketplace-border-radius: 6px;
        --bidly-marketplace-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
        --bidly-marketplace-spacing: 1.25rem;
        --bidly-marketplace-button-padding: 0.625rem 1.25rem;
        --bidly-marketplace-primary-hover: color-mix(in srgb, var(--bidly-marketplace-color-primary) 80%, black);
        --bidly-marketplace-primary-light: color-mix(in srgb, var(--bidly-marketplace-color-primary) 90%, white);
      }
    `;
    
    this.applyTheme(defaultCSS);
    return true;
  }

  /**
   * Check if theme is loaded
   */
  isThemeLoaded() {
    return this.themeLoaded;
  }

  /**
   * Get current theme configuration
   */
  getCurrentTheme() {
    return this.theme;
  }
}

export default new ThemeService();
