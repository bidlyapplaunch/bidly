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
      const response = await fetch(`${backendUrl}/api/customization/theme?shop=${encodeURIComponent(shopDomain)}`, {
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
        --bidly-color-primary: #007bff;
        --bidly-color-background: #f5f5f5;
        --bidly-color-surface: #ffffff;
        --bidly-color-text-primary: #222222;
        --bidly-color-text-secondary: #666666;
        --bidly-color-border: #dddddd;
        --bidly-color-accent: #00b894;
        --bidly-color-success: #00c851;
        --bidly-color-error: #ff4444;
        --bidly-color-hover: #0056b3;
        --bidly-font-family: 'Inter', sans-serif;
        --bidly-template: 'Classic';
        --bidly-border-radius: 6px;
        --bidly-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
        --bidly-spacing: 1.25rem;
        --bidly-button-padding: 0.625rem 1.25rem;
        --bidly-primary-hover: color-mix(in srgb, var(--bidly-color-primary) 80%, black);
        --bidly-primary-light: color-mix(in srgb, var(--bidly-color-primary) 90%, white);
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
